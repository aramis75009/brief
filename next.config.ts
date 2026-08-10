import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie autonome : le conteneur embarque le serveur et ses seules
  // dépendances utiles, sans node_modules complet. Indispensable pour une
  // image légère sur le VPS.
  output: "standalone",

  async headers() {
    return [
      {
        // Le service worker doit être revalidé à chaque chargement. Sans ça,
        // Safari peut resservir une version en cache pendant des heures et tu
        // débogues du code qui n'est plus celui du dépôt.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          // Portée racine explicite : le fichier est déjà servi depuis /, cet
          // en-tête protège le jour où il déménagerait.
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
