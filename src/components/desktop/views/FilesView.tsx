"use client";

/**
 * La vue Fichiers — lecture transverse des pièces jointes et des dictées.
 *
 * Elle ne possède rien : chaque ligne appartient à un item, et cliquer la
 * ligne ouvre cet item. C'est ce qui évite le piège classique d'une
 * bibliothèque de fichiers orpheline — un fichier qu'on ne sait plus relier à
 * quoi que ce soit.
 */

import { useMemo, useRef, useState } from "react";
import { attachmentUrl } from "@/lib/api";
import { EmptyView } from "../ui";
import { C, R } from "../tokens";
import type { Attachment, Item } from "@/lib/types";

type Row = {
  key: string;
  name: string;
  ext: string;
  meta: string;
  size: string;
  href: string;
  itemId: string;
  attachmentId: string | null;
  pastel: { background: string; color: string };
};

const PASTELS = [
  { background: "var(--color-task-100)", color: "var(--color-task-700)" },
  { background: "var(--color-meet-100)", color: "var(--color-meet-700)" },
  { background: "var(--color-idea-100)", color: "var(--color-idea-700)" },
];

/** `1,2 Mo` — l'unité change au seuil, pas « 0,00 Go » pour 12 Ko. */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

function extOf(a: Attachment): string {
  const fromName = a.name.includes(".") ? a.name.split(".").pop() : null;
  return (fromName || a.mime.split("/").pop() || "fic").slice(0, 4).toUpperCase();
}

export function FilesView({
  items,
  onOpenTask,
  onUpload,
  onDelete,
}: {
  items: Item[];
  onOpenTask: (id: string) => void;
  /** `null` quand aucun item n'est ouvert pour recevoir un dépôt. */
  onUpload: ((file: File) => Promise<void>) | null;
  onDelete: (attachmentId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const it of items) {
      for (const a of it.attachments ?? []) {
        out.push({
          key: a.id,
          name: a.name,
          ext: extOf(a),
          meta: it.title,
          size: humanSize(a.sizeBytes),
          href: attachmentUrl(a.id),
          itemId: it.id,
          attachmentId: a.id,
          pastel: PASTELS[out.length % PASTELS.length],
        });
      }
      // La dictée d'origine est un fichier comme un autre du point de vue de
      // cette vue — c'est même le seul que Brief produit tout seul.
      if (it.audioId) {
        out.push({
          key: `audio-${it.audioId}`,
          name: `${it.audioId}.audio`,
          ext: "VOIX",
          meta: `Dictée d'origine · ${it.title}`,
          size: it.audioOrigin ? `${Math.round(it.audioOrigin.durationSec)} s` : "—",
          href: `/api/audio/${it.audioId}`,
          itemId: it.id,
          attachmentId: null,
          pastel: { background: "var(--color-ink)", color: "var(--color-task-100)" },
        });
      }
    }
    return out;
  }, [items]);

  const pick = async (file: File | undefined) => {
    if (!file || !onUpload) return;
    setBusy(true);
    try {
      await onUpload(file);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {onUpload && (
        <div>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 font-bold"
            style={{
              height: 32,
              padding: "0 13px",
              borderRadius: R.chip,
              border: `1px solid ${C.hairline2}`,
              background: "none",
              fontFamily: "inherit",
              fontSize: 13,
              cursor: busy ? "progress" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
            <span>{busy ? "Envoi…" : "Joindre un fichier"}</span>
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyView
          title="Aucun fichier"
          hint={
            onUpload
              ? "Joins un fichier à une tâche — il apparaîtra ici, rattaché à elle."
              : "Ouvre une tâche pour y joindre un fichier. Les dictées apparaissent ici automatiquement."
          }
        />
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.hairline2}`, borderRadius: R.card, overflow: "hidden" }}>
          {rows.map((r) => (
            <div
              key={r.key}
              className="flex items-center gap-3.5 hover:bg-[var(--color-bg)]"
              style={{ padding: "14px 18px", borderBottom: `1px solid ${C.hairline}` }}
            >
              <span
                className="flex flex-none items-center justify-center font-mono font-semibold"
                style={{ width: 38, height: 38, borderRadius: R.md, fontSize: 10, ...r.pastel }}
                aria-hidden="true"
              >
                {r.ext}
              </span>
              <div className="min-w-0 flex-1">
                <a
                  href={r.href}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-[14px] font-bold hover:underline"
                  style={{ color: C.ink }}
                >
                  {r.name}
                </a>
                <button
                  type="button"
                  onClick={() => onOpenTask(r.itemId)}
                  className="truncate text-left text-[12px] hover:underline"
                  style={{ border: "none", background: "none", padding: 0, color: C.inkMuted, fontFamily: "inherit", cursor: "pointer", marginTop: 2 }}
                >
                  {r.meta}
                </button>
              </div>
              <span className="tnum flex-none text-[12px]" style={{ color: C.inkFaint }}>
                {r.size}
              </span>
              {r.attachmentId && (
                <button
                  type="button"
                  aria-label={`Supprimer ${r.name}`}
                  onClick={() => onDelete(r.attachmentId!)}
                  className="flex-none"
                  style={{ border: "none", background: "none", color: C.inkFaint, cursor: "pointer", fontSize: 15 }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
