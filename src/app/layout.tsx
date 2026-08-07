import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  applicationName: "Brief",
  title: "Brief",
  description: "Dicte ta note, elle part en Quick Add Todoist.",
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
  themeColor: "#FAF8F5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Indispensable pour que env(safe-area-inset-*) soit non nul.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${outfit.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
