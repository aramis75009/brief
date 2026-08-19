"use client";

import type { ItemType } from "@/lib/item-type";
import { typeLabel } from "@/lib/item-type";

/**
 * Sélecteur explicite Tâche / Rendez-vous / Idée — partagé par la capture
 * (choisir le type d'un brouillon avant envoi) et la fiche (changer le type
 * d'un item existant). Même pattern visuel que les filtres de
 * `SearchScreen.tsx` : pilule pleine `bg-ink` pour l'actif, contour sinon.
 */

const OPTIONS: ItemType[] = ["task", "event", "idea"];

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
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(t)}
            className={`flex-none rounded-full px-3.5 text-[12.5px] font-bold h-9 ${
              active ? "bg-ink text-white" : "border border-ink/[.1] bg-surface text-ink"
            }`}
          >
            {typeLabel(t)}
          </button>
        );
      })}
    </div>
  );
}
