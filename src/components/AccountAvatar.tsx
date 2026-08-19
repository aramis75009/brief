"use client";

/**
 * AccountAvatar — cercle avec initiales, anneau.
 * 46px par défaut, couleur de fond paramétrable.
 */

export function AccountAvatar({
  initials,
  size = 46,
  bg = "var(--color-task-100)",
  color = "var(--color-task-700)",
  onClick,
  className = "",
}: {
  initials: string;
  size?: number;
  bg?: string;
  color?: string;
  onClick?: () => void;
  className?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      aria-label={onClick ? "Compte et réglages" : undefined}
      className={`relative flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: 99,
        border: "none",
        background: bg,
        cursor: onClick ? "pointer" : "default",
        fontFamily: "inherit",
      }}
    >
      <span
        className="font-extrabold"
        style={{
          fontSize: size * 0.35,
          color,
          letterSpacing: "-0.02em",
        }}
      >
        {initials}
      </span>
      <span
        className="absolute rounded-full"
        style={{
          inset: -3,
          border: "2px solid rgba(16,16,16,.12)",
        }}
      />
    </Tag>
  );
}