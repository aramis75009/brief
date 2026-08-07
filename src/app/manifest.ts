import type { MetadataRoute } from "next";

/**
 * Servi par Next à /manifest.webmanifest avec le Content-Type
 * `application/manifest+json`. C'est ce fichier qui rend l'app installable en
 * standalone depuis Safari iOS.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Brief — dictée vers Todoist",
    short_name: "Brief",
    description: "Dicte ta note, elle part en Quick Add Todoist.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Alignés sur le fond crème de l'app pour que la status bar s'y fonde.
    background_color: "#FAF8F5",
    theme_color: "#FAF8F5",
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
