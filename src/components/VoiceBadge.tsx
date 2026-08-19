"use client";

/**
 * VoiceBadge — marqueur "créé à la voix".
 * 3 barres verticales de hauteurs différentes, couleur gris.
 * Small (10px) pour les listes, Medium (16px) pour les détails.
 */

export function VoiceBadge({ size = "small" }: { size?: "small" | "medium" }) {
  const heights =
    size === "medium"
      ? [6, 12, 8, 15, 7] // 16px tall
      : [4, 9, 6]; // 10px tall

  return (
    <span
      className="flex items-end gap-[1.5px]"
      style={{ height: size === "medium" ? 16 : 10 }}
      title="Créée à la voix"
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full bg-ink/25"
          style={{ height: h }}
        />
      ))}
    </span>
  );
}