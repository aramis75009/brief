"use client";

import type { ItemType } from "@/lib/item-type";
import { typeLabel } from "@/lib/item-type";

/**
 * Sélecteur explicite Tâche / Rendez-vous / Idée — partagé par la capture
 * (choisir le type d'un brouillon avant envoi) et la fiche (changer le type
 * d'un item existant).
 *
 * Chaque type porte sa couleur de destination du design system :
 * task = bleu, event = vert, idea = jaune. L'option active prend le fond
 * `100` et le texte `700` de sa teinte ; les inactives restent neutres.
 */

const OPTIONS: ItemType[] = ["task", "event", "idea"];

const TYPE_STYLES: Record<ItemType, { activeBg: string; activeText: string }> = {
  task: { activeBg: "var(--color-task-100)", activeText: "var(--color-task-700)" },
  event: { activeBg: "var(--color-meet-100)", activeText: "var(--color-meet-700)" },
  idea: { activeBg: "var(--color-idea-100)", activeText: "var(--color-idea-700)" },
};

export function TypeSegmented({
  value,
  onChange,
}: {
  value: ItemType;
  onChange: (t: ItemType) => void;
}) {
  return (
    <div className="flex gap-[7px]" role="radiogroup" aria-label="Type d'item">
      {OPTIONS.map((t) => {
        const active = t === value;
        const styles = TYPE_STYLES[t];
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(t)}
            className={`flex-none rounded-full px-3.5 text-[12.5px] font-bold h-9 transition-colors ${
              active ? "border-transparent" : "border border-ink/[.1] bg-surface text-ink"
            }`}
            style={active ? { background: styles.activeBg, color: styles.activeText } : undefined}
          >
            {typeLabel(t)}
          </button>
        );
      })}
    </div>
  );
}
