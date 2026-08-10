import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * General Sans (Fontshare) — famille unique de l'app.
 *
 * `next/font/local` et non `next/font/google` : General Sans n'est pas sur
 * Google Fonts. Les .woff2 sont versionnés dans le dépôt pour que le build ne
 * dépende pas de la disponibilité d'un CDN tiers.
 *
 * Choisie contre Outfit et Poppins pour une raison mesurable : ses ouvertures
 * plus serrées la gardent lisible à 13 px sur mobile, taille à laquelle les
 * géométriques classiques se referment. JetBrains Mono a été supprimée — les
 * chiffres alignés passent par `font-variant-numeric: tabular-nums`.
 */
const generalSans = localFont({
  variable: "--font-general-sans",
  display: "swap",
  src: [
    { path: "./fonts/GeneralSans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/GeneralSans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/GeneralSans-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/GeneralSans-700.woff2", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  applicationName: "Brief",
  title: "Brief",
  description: "Dicte ta note, Brief la range.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Brief",
    // `default` (et non black-translucent) : en standalone, iOS teinte alors la
    // zone de status bar avec le theme-color crème et choisit un texte sombre.
    // black-translucent forcerait un texte blanc, illisible sur #FAF8F5.
    statusBarStyle: "default",
  },
  other: {
    // Next 16 n'émet que la balise standard `mobile-web-app-capable` pour
    // appleWebApp.capable. Safari iOS lit encore la variante préfixée : sans
    // elle, « Sur l'écran d'accueil » crée un simple marque-page, pas une app
    // standalone. On l'ajoute donc explicitement (vérifié dans le HTML servi).
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  // Aligné sur --color-page. Deux valeurs pour que la barre de statut suive le
  // thème système au lieu de rester crème sur un fond sombre.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F3F0" },
    { media: "(prefers-color-scheme: dark)", color: "#0F0E0D" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Indispensable pour que env(safe-area-inset-*) soit non nul.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${generalSans.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
