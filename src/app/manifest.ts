import type { MetadataRoute } from "next";

/**
 * Servi par Next à /manifest.webmanifest avec le Content-Type
 * `application/manifest+json`. C'est ce fichier qui rend l'app installable en
 * standalone depuis Safari iOS.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Brief — ton organisation, dictée",
    short_name: "Brief",
    description: "Dicte ta note, Brief la range.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Alignés sur --color-page (DESIGN.md). Le manifest n'accepte qu'une seule
    // valeur : on prend celle du mode clair, le mode sombre étant géré par la
    // balise theme-color du layout.
    background_color: "#F5F3F0",
    theme_color: "#F5F3F0",
    lang: "fr",
    dir: "ltr",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
