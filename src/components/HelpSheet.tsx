"use client";

import { InfoSheet } from "./InfoSheet";

/**
 * HelpSheet — contenu du bouton Aide.
 * Cinq sections : Comment ça marche, Capturer, Rendez-vous, Rappels, Idées.
 */

function HelpSection({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-[15px] font-bold">{title}</h3>
      <p className="text-[13px] font-medium text-ink-muted">{body}</p>
    </div>
  );
}

export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <InfoSheet open={open} title="Aide" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <HelpSection
          title="Comment ça marche"
          body="Tu dictes, Whisper transcrit, l'IA découpe ta note en tâches et rendez-vous, tu relis, Brief range."
        />
        <HelpSection
          title="Capturer"
          body="Touche le micro ou écris. L'IA structure ta note en tâches et rendez-vous datés."
        />
        <HelpSection
          title="Rendez-vous"
          body="Brief synchronise avec ton calendrier Apple iCloud. Ce que tu édites dans Calendrier écrase Brief."
        />
        <HelpSection
          title="Rappels"
          body="Les notifications partent du serveur. Ajoute Brief à ton écran d'accueil pour les recevoir."
        />
        <HelpSection
          title="Idées"
          body="Capture sans ranger. Convertis en tâche quand tu veux."
        />
      </div>
    </InfoSheet>
  );
}