import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        ink: {
          DEFAULT: "var(--color-ink)",
          muted: "var(--color-ink-muted)",
          faint: "var(--color-ink-faint)",
        },
        task: {
          100: "var(--color-task-100)",
          700: "var(--color-task-700)",
        },
        meet: {
          100: "var(--color-meet-100)",
          700: "var(--color-meet-700)",
        },
        idea: {
          100: "var(--color-idea-100)",
          700: "var(--color-idea-700)",
        },
        danger: "var(--color-danger)",
        hairline: "var(--hairline)",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "-apple-system", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        12: "12px",
        18: "18px",
        20: "20px",
        24: "24px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        fab: "var(--shadow-fab)",
        nav: "var(--shadow-nav)",
        mic: "var(--shadow-mic)",
      },
      keyframes: {
        wave: {
          "0%, 100%": { transform: "scaleY(.28)" },
          "50%": { transform: "scaleY(1)" },
        },
        idle: {
          "0%, 100%": { transform: "scaleY(.4)" },
          "50%": { transform: "scaleY(.9)" },
        },
        collapse: {
          "0%": { transform: "scaleY(1)", opacity: "1" },
          "70%": { transform: "scaleY(.05)", opacity: ".5" },
          "100%": { transform: "scaleY(.04)", opacity: ".18" },
        },
        pop: {
          from: { opacity: "0", transform: "translateY(14px) scale(.97)" },
          to: { opacity: "1", transform: "none" },
        },
        rail: {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-220px 0" },
          "100%": { backgroundPosition: "calc(220px + 100%) 0" },
        },
        ping: {
          "0%": { transform: "scale(1)", opacity: ".35" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
        fade: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        sheet: {
          from: { transform: "translateY(30px)", opacity: ".6" },
          to: { transform: "none", opacity: "1" },
        },
      },
      animation: {
        wave: "wave .95s ease-in-out infinite",
        idle: "idle 1.6s ease-in-out infinite",
        collapse: "collapse .7s cubic-bezier(.4,0,.2,1) both",
        pop: "pop .45s cubic-bezier(.2,.9,.3,1) both",
        rail: "rail .5s cubic-bezier(.4,0,.2,1) both",
        shimmer: "shimmer 1.1s linear infinite",
        ping: "ping 1.4s ease-out infinite",
        fade: "fade .3s both",
        sheet: "sheet .3s cubic-bezier(.2,.9,.3,1) both",
      },
    },
  },
} satisfies Config;