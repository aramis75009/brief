"use client";

/**
 * Écran Réglages desktop — compte, chaîne, destinations, étiquettes.
 *
 * On y accède par l'AVATAR du bandeau, plus par un onglet de la nav (décision
 * Aramis du 2026-08-30). L'écran reste un écran plein en deux colonnes : les
 * Destinations et les Étiquettes sont de vraies interfaces de gestion, elles
 * deviendraient inutilisables dans un sheet.
 *
 * **Toutes les bascules agissent.** Elles ne sont plus décoratives depuis le
 * 2026-08-30 : « Calendrier Apple » et « Digest Telegram » écrivent dans
 * `settings.json` par `PATCH /api/settings` et coupent réellement le service
 * correspondant ; « Rappels push » suit le même chemin que
 * `NotificationsSheet`. Le serveur fait foi — une bascule refusée revient
 * toute seule à sa position réelle. `AccountSheet` (mobile) porte encore ses
 * bascules décoratives : chantier à part, voir `TODOS.md`.
 */

import { useState, useEffect, useCallback } from "react";
import { skinFor, shapeFor } from "@/lib/projects";
import { calendarForProjectName } from "@/lib/calendarMapping";
import {
  fetchTags, createTag, deleteTag, updateTag,
  fetchSettings, updateSettings, fetchAccount, requestPasswordReset, fetchCalDavStatus,
} from "@/lib/api";
import { relativeSyncLabel } from "@/lib/syncLabel";
import type { Settings } from "@/lib/settings";
import type { Overview, Project, Tag } from "@/lib/types";

import { TAG_COLOR_MAP } from "@/lib/tagColors";
const COLOR_LABELS: Record<string, string> = {
  yellow: "Jaune", orange: "Orange", red: "Rouge", purple: "Violet",
  blue: "Bleu", green: "Vert", teal: "Turquoise", brown: "Marron",
  pink: "Rose", sky: "Bleu ciel",
};
const COLOR_KEYS = Object.keys(COLOR_LABELS);

function ColorPicker({ value, onChange, compact }: { value: string; onChange: (c: string) => void; compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5" style={{ maxWidth: compact ? 180 : 280 }}>
      {COLOR_KEYS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          title={COLOR_LABELS[c]}
          style={{
            width: compact ? 22 : 28,
            height: compact ? 22 : 28,
            borderRadius: 99,
            background: TAG_COLOR_MAP[c] ?? TAG_COLOR_MAP.blue,
            border: value === c ? "2px solid var(--color-ink)" : "2px solid rgba(16,16,16,.1)",
            cursor: "pointer",
            padding: 0,
            flex: "none",
          }}
        />
      ))}
    </div>
  );
}

const C = {
  bg: "var(--color-bg)",
  surface: "var(--color-surface)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-muted)",
  inkFaint: "var(--color-ink-faint)",
} as const;

function ToggleRow({ label, desc, on, onClick, busy }: { label: string; desc: string; on: boolean; onClick: () => void; busy?: boolean }) {
  return (
    <div className="flex items-center gap-3.5" style={{ padding: "12px 0", borderBottom: "1px solid rgba(16,16,16,.06)" }}>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[13px] font-bold tracking-[-0.01em]">{label}</span>
        <span className="text-[11px] font-medium" style={{ color: C.inkMuted }}>{desc}</span>
      </span>
      {/* Un seul élément interactif — un `<button>` enveloppant sans taille
          propre s'effondre à 0×0 au lieu d'hériter de son contenu. */}
      <button
        onClick={onClick}
        disabled={busy}
        role="switch"
        aria-checked={on}
        aria-label={label}
        className="relative flex-none"
        style={{ width: 48, height: 28, borderRadius: 99, border: "none", padding: 0, cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1, background: on ? C.ink : "#EDEDEA", transition: "background .22s, opacity .22s" }}
      >
        <span
          className="absolute"
          style={{ top: 3, width: 22, height: 22, borderRadius: 99, background: "#fff", boxShadow: "0 2px 6px rgba(16,16,16,.2)", transition: "left .22s cubic-bezier(.4,0,.2,1)", left: on ? 23 : 3 }}
        />
      </button>
    </div>
  );
}

/**
 * Les réglages serveur, avec bascule optimiste et retour en arrière.
 *
 * L'état optimiste n'est pas du confort : `PATCH /api/settings` passe par le
 * disque, et une bascule qui attendrait la réponse aurait l'air cassée. En
 * revanche c'est TOUJOURS la réponse du serveur qui gagne à l'arrivée — sans
 * ça, une bascule refusée resterait affichée dans la mauvaise position et
 * l'utilisateur croirait la synchro éteinte alors qu'elle tourne.
 */
function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const s = await fetchSettings();
        if (alive) setSettings(s);
      } catch { /* silencieux — les bascules restent inertes, elles ne mentent pas */ }
    })();
    return () => { alive = false; };
  }, []);

  const toggle = useCallback(async (key: keyof Settings) => {
    if (!settings || busy) return;
    const optimistic = { ...settings, [key]: !settings[key] };
    setSettings(optimistic);
    setBusy(true);
    try {
      setSettings(await updateSettings({ [key]: optimistic[key] }));
    } catch {
      setSettings(settings); // le serveur fait foi : on revient à l'état connu
    } finally {
      setBusy(false);
    }
  }, [settings, busy]);

  return { settings, busy, toggle };
}

/**
 * Compte — remplace l'ancienne ligne « Verrou PIN », morte depuis la
 * suppression du PIN le 2026-08-26.
 *
 * Elle promettait un verrou qui n'existe plus. Ce bloc met à la place les
 * seules actions de compte réelles, dont la déconnexion : jusqu'ici, le
 * desktop n'avait AUCUN moyen de terminer sa session (seul le sheet mobile en
 * avait un), alors que le cookie est httpOnly et se rafraîchit tout seul.
 */
function AccountBlock({ onLogout }: { onLogout: () => void }) {
  const [email, setEmail] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const account = await fetchAccount();
        if (alive) setEmail(account.email);
      } catch { /* silencieux — le bloc s'affiche sans l'adresse */ }
    })();
    return () => { alive = false; };
  }, []);

  const sendReset = async () => {
    if (!email || sending) return;
    setSending(true);
    try {
      const { message } = await requestPasswordReset(email);
      setResetMsg(message);
    } catch {
      setResetMsg("Envoi impossible. Réessaie dans un instant.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-none flex-col gap-1" style={{ padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 24, boxShadow: "0 6px 20px rgba(16,16,16,.07)" }}>
      <span className="text-[17px] font-bold tracking-[-0.02em]" style={{ marginBottom: 6 }}>Compte</span>

      <div className="flex items-center gap-3.5" style={{ padding: "12px 0", borderBottom: "1px solid rgba(16,16,16,.06)" }}>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13px] font-bold tracking-[-0.01em]">Connecté</span>
          <span className="truncate text-[11px] font-medium" style={{ color: C.inkMuted }}>
            {email ?? "…"}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-3.5" style={{ padding: "12px 0", borderBottom: "1px solid rgba(16,16,16,.06)" }}>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13px] font-bold tracking-[-0.01em]">Mot de passe</span>
          <span className="text-[11px] font-medium" style={{ color: C.inkMuted }}>
            {resetMsg ?? "Un lien de changement part sur cette adresse."}
          </span>
        </span>
        <button
          onClick={sendReset}
          disabled={!email || sending}
          className="flex-none text-[12px] font-bold"
          style={{ padding: "7px 14px", background: C.bg, border: "1px solid rgba(16,16,16,.1)", borderRadius: 99, cursor: !email || sending ? "default" : "pointer", opacity: !email || sending ? 0.5 : 1, fontFamily: "inherit", color: C.ink }}
        >
          {sending ? "Envoi…" : "Changer"}
        </button>
      </div>

      <div className="flex items-center gap-3.5" style={{ padding: "12px 0" }}>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13px] font-bold tracking-[-0.01em]">Se déconnecter</span>
          <span className="text-[11px] font-medium" style={{ color: C.inkMuted }}>
            Termine la session sur cet appareil.
          </span>
        </span>
        <button
          onClick={onLogout}
          className="flex-none text-[12px] font-bold"
          style={{ padding: "7px 14px", background: C.ink, color: "#fff", border: "none", borderRadius: 99, cursor: "pointer", fontFamily: "inherit" }}
        >
          Déconnexion
        </button>
      </div>
    </div>
  );
}

function TagManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("blue");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  useEffect(() => {
    (async () => {
      try { setTags(await fetchTags()); } catch { /* silencieux */ }
    })();
  }, []);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const tag = await createTag(name, newColor);
      setTags((t) => [...t, tag]);
      setNewName("");
    } catch { /* silencieux */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTag(id);
      setTags((t) => t.filter((tag) => tag.id !== id));
    } catch { /* silencieux */ }
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const patch: { name?: string; color?: string } = {};
      if (editName.trim()) patch.name = editName.trim();
      if (editColor) patch.color = editColor;
      await updateTag(id, patch);
      setTags((t) => t.map((tag) => tag.id === id ? { ...tag, name: patch.name ?? tag.name, color: (patch.color as Tag["color"]) ?? tag.color } : tag));
      setEditingId(null);
    } catch { /* silencieux */ }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Liste des tags existants */}
      {tags.length > 0 && (
        <div className="flex flex-col gap-2">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-3" style={{ padding: "8px 0" }}>
              {editingId === tag.id ? (
                <>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={tag.name} style={{ flex: 1, padding: "8px 12px", background: C.bg, border: "1px solid rgba(16,16,16,.1)", borderRadius: 12, fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: C.ink, outline: "none" }} />
                  <ColorPicker value={editColor || tag.color} onChange={setEditColor} compact />
                  <button onClick={() => handleSaveEdit(tag.id)} style={{ padding: "7px 14px", background: C.ink, color: "#fff", border: "none", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>OK</button>
                </>
              ) : (
                <>
                  <span style={{ width: 28, height: 10, borderRadius: 99, background: TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.blue, flex: "none" }} />
                  <span className="text-[14px] font-semibold" style={{ color: C.ink, flex: 1 }}>{tag.name}</span>
                  <button onClick={() => { setEditingId(tag.id); setEditName(tag.name); setEditColor(tag.color); setEditName(tag.name); }} className="text-[12px] font-bold" style={{ background: C.bg, border: "1px solid rgba(16,16,16,.06)", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", padding: "5px 10px", color: C.inkMuted }}>Modifier</button>
                  <button onClick={() => handleDelete(tag.id)} aria-label="Supprimer" style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint, fontSize: 16, padding: "2px 6px" }}>×</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {tags.length === 0 && <span className="text-[13px] font-medium" style={{ color: C.inkFaint }}>Aucune étiquette. Crée la première ci-dessous.</span>}

      {/* Création */}
      <div className="flex flex-col gap-2" style={{ paddingTop: 8, borderTop: tags.length > 0 ? "1px solid rgba(16,16,16,.06)" : "none" }}>
        <div className="flex items-center gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }} placeholder="Nouvelle étiquette…" style={{ flex: 1, padding: "10px 14px", background: C.bg, border: "1px solid rgba(16,16,16,.1)", borderRadius: 12, fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: C.ink, outline: "none" }} />
          <button onClick={handleCreate} style={{ padding: "10px 18px", background: C.ink, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, flex: "none" }}>Créer</button>
        </div>
        <ColorPicker value={newColor} onChange={setNewColor} />
      </div>
    </div>
  );
}

export function DesktopSettings({
  projects,
  overview,
  pushSubscribed,
  onEnablePush,
  onLogout,
}: {
  projects: Project[];
  overview: Overview | null;
  pushSubscribed: boolean;
  onEnablePush: () => void;
  onLogout: () => void;
}) {
  const { settings, busy, toggle } = useSettings();
  const byProject = new Map((overview?.byProject ?? []).map((p) => [p.id, p]));

  // L'âge du dernier passage CalDAV est demandé ICI, pas reçu en prop.
  // Il ne l'était que par `openAccount()` (le sheet mobile) : depuis que
  // l'avatar ouvre cet écran au lieu du sheet, plus personne n'allait le
  // chercher et l'écran affichait « jamais synchronisé » en permanence,
  // synchro en marche. Un écran va chercher ce qu'il affiche.
  const [calendarSyncAt, setCalendarSyncAt] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { lastSyncAt } = await fetchCalDavStatus();
        if (alive) setCalendarSyncAt(lastSyncAt);
      } catch { /* silencieux — le libellé reste « jamais synchronisé », qui est honnête */ }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="grid h-full gap-3" style={{ gridTemplateColumns: "1fr 1fr", animation: "fade .3s both" }}>
      <div className="flex h-full min-h-0 flex-col gap-3" style={{ padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 24, boxShadow: "0 6px 20px rgba(16,16,16,.07)", overflow: "hidden" }}>
        <span className="flex-none font-extrabold tracking-[-0.03em]" style={{ fontSize: 20 }}>Destinations</span>
        <span className="flex-none text-[12px] font-medium" style={{ color: C.inkMuted, lineHeight: 1.4 }}>
          Une teinte désigne un projet, elle ne décore jamais. La forme prend le relais quand les teintes ne suffisent plus — elle se lit sans couleur.
        </span>
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
        {projects.map((p) => {
          const skin = skinFor(p);
          const shape = shapeFor(p);
          const stats = byProject.get(p.id);
          const calName = calendarForProjectName(p.id);
          return (
            <div key={p.id} className="flex flex-col gap-2" style={{ padding: 16, background: C.bg, borderRadius: 20 }}>
              <div className="flex items-center gap-3">
                <span style={{ width: 18, height: 18, flex: "none", borderRadius: shape === "square" ? 5 : 99, background: skin.bg, boxShadow: "0 0 0 1px rgba(16,16,16,.04)" }} />
                <span className="text-[15px] font-bold tracking-[-0.02em]">{p.name}</span>
                <span className="ml-auto font-mono" style={{ fontSize: 10, letterSpacing: "0.06em", color: C.inkMuted }}>
                  {stats ? `${stats.total} ouverts · ${stats.overdue} en retard` : "aucun item ouvert"}
                </span>
              </div>
              <span className="text-[11px] font-medium" style={{ color: C.inkMuted, paddingLeft: 30 }}>
                → {calName}
              </span>
            </div>
          );
        })}
        </div>

        {/* Étiquettes */}
        <div className="flex flex-none flex-col gap-3" style={{ padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 24, boxShadow: "0 6px 20px rgba(16,16,16,.07)" }}>
          <span className="text-[17px] font-bold tracking-[-0.02em]">Étiquettes</span>
          <TagManager />
        </div>
      </div>

      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
        <div className="flex flex-none flex-col gap-1" style={{ padding: 18, background: C.surface, border: "1px solid rgba(16,16,16,.06)", borderRadius: 24, boxShadow: "0 6px 20px rgba(16,16,16,.07)" }}>
          <span className="text-[17px] font-bold tracking-[-0.02em]" style={{ marginBottom: 6 }}>Chaîne</span>
          <ToggleRow
            label="Calendrier Apple (CalDAV)"
            desc={settings?.caldavSync === false
              ? "Synchro en pause — Brief n'écrit plus rien dans le calendrier."
              : `Source de vérité des RDV — ${relativeSyncLabel(calendarSyncAt)}.`}
            on={settings?.caldavSync ?? true}
            busy={busy || !settings}
            onClick={() => void toggle("caldavSync")}
          />
          <ToggleRow
            label="Digest Telegram"
            desc={settings?.digest === false
              ? "Récap coupé côté Brief — n8n doit tester `enabled` pour ne rien envoyer."
              : "Récap du matin à 08:30 via n8n."}
            on={settings?.digest ?? true}
            busy={busy || !settings}
            onClick={() => void toggle("digest")}
          />
          <ToggleRow label="Rappels push" desc="Web Push sur iPhone et desktop." on={pushSubscribed} onClick={onEnablePush} />
        </div>

        <AccountBlock onLogout={onLogout} />
      </div>
    </div>
  );
}
