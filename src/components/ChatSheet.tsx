"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CloseIcon, ArrowRightIcon } from "./icons";

/**
 * ChatSheet — feuille modale de conversation avec l'assistant Brief.
 *
 * Reprend l'enveloppe d'InfoSheet (voile, feuille rounded-t-[30px], poignée,
 * titre, bouton fermer) mais remplace le contenu par une interface de chat :
 * liste de messages défilante + barre de saisie en bas.
 *
 * `onSend` est injecté par le parent (BriefApp) qui délègue l'appel réseau à
 * `chatWithAssistant` — ce composant n'accède pas à l'API directement, il ne
 * fait que tenir l'état de la conversation et déclencher l'envoi.
 */

type ChatMessage = { role: "user" | "assistant"; content: string };

const WELCOME: ChatMessage = {
  role: "assistant",
  content: "Bonjour Aramis, comment puis-je t'aider aujourd'hui ?",
};

export function ChatSheet({
  open,
  onClose,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (messages: { role: string; content: string }[]) => Promise<string>;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Réinitialise la conversation à chaque ouverture — une nouvelle session
  // repart du message d'accueil, sans traîner un historique obsolète.
  useEffect(() => {
    if (open) {
      setMessages([WELCOME]);
      setInput("");
      setLoading(false);
    }
  }, [open]);

  // Auto-scroll vers le bas à chaque nouveau message ou changement d'état.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    // L'historique envoyé au serveur inclut le message d'accueil assistant
    // et tous les échanges précédents, plus le message qui part maintenant.
    const history = [...messages, userMsg];

    setMessages(history);
    setInput("");
    setLoading(true);

    try {
      const reply = await onSend(
        history.map((m) => ({ role: m.role, content: m.content })),
      );
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Désolé, je n'ai pas pu répondre. Vérifie ta connexion et réessaie.",
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages, onSend]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Entrée sans Shift = envoi (Shift+Entrée laissé au comportement par
      // défaut, même si ce champ mono-ligne ne le gère pas réellement).
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void send();
      }
    },
    [send],
  );

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-90 flex flex-col justify-end"
      style={{ background: "rgba(16,16,16,.34)", animation: "fade .22s both" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Assistant"
    >
      <div
        className="flex max-h-[85vh] flex-col rounded-t-[30px] bg-surface px-5 pt-3 pb-8.5"
        style={{ animation: "sheet .3s cubic-bezier(.2,.9,.3,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mb-4 flex justify-center">
          <span className="h-[5px] w-[42px] rounded-full bg-ink/[.14]" />
        </div>

        {/* Title + close */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-bold tracking-[-0.02em]">Assistant</h2>
          <button
            aria-label="Fermer"
            onClick={onClose}
            className="flex size-11 flex-none items-center justify-center rounded-full bg-bg"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Messages list */}
        <div
          ref={scrollRef}
          className="flex flex-col gap-3 overflow-y-auto"
          style={{ maxHeight: "60vh" }}
        >
          {messages.map((m, i) => (
            <Bubble key={i} message={m} />
          ))}
          {loading && <TypingBubble />}
        </div>

        {/* Input bar */}
        <div className="mt-4 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Demande-moi quelque chose…"
            disabled={loading}
            className="flex-1 rounded-full border border-ink/[.06] bg-bg px-4 py-3 text-[15px] font-medium outline-none placeholder:text-ink-faint disabled:opacity-50"
            style={{ color: "var(--color-ink)" }}
          />
          <button
            aria-label="Envoyer"
            onClick={() => void send()}
            disabled={!input.trim() || loading}
            className="flex size-11 flex-none items-center justify-center rounded-full bg-ink text-white disabled:opacity-30"
          >
            <ArrowRightIcon size={18} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Bulle de message — alignée à droite (user) ou à gauche (assistant).
 * ------------------------------------------------------------------ */

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className="max-w-[80%] px-4 py-2.5 text-[14px] leading-snug"
        style={{
          borderRadius: 18,
          background: isUser ? "var(--color-ink)" : "var(--color-surface)",
          color: isUser ? "#fff" : "var(--color-ink)",
          border: isUser ? "none" : "1px solid rgba(16,16,16,.06)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {message.content}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Indicateur de saisie — trois points animés pendant l'attente.
 * ------------------------------------------------------------------ */

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div
        className="flex items-center gap-1 px-4 py-3"
        style={{
          borderRadius: 18,
          background: "var(--color-surface)",
          border: "1px solid rgba(16,16,16,.06)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block rounded-full"
            style={{
              width: 6,
              height: 6,
              background: "var(--color-ink-faint)",
              animation: `chatdot 1.2s ${i * 0.2}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>
    </div>
  );
}