import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie autonome : le conteneur embarque le serveur et ses seules
  // dépendances utiles, sans node_modules complet. Indispensable pour une
  // image légère sur le VPS.
  //
  // ⚠️ MAIS INCOMPATIBLE AVEC VERCEL. En mode standalone, Next range ses
  // fichiers de traçage dans `.next/standalone/` et n'émet plus
  // `.next/next-server.js.nft.json`. Le builder Vercel va le chercher là dans
  // son étape `onBuildComplete` et échoue sur :
  //     ENOENT: no such file or directory, open '.next/next-server.js.nft.json'
  //
  // Piège vicieux : `npm run build` réussit en local, parce que cette étape
  // est propre à Vercel. L'échec n'apparaît qu'une fois poussé.
  //
  // `VERCEL` vaut "1" dans leurs builds. Le VPS, lui, n'a pas cette variable et
  // garde donc la sortie autonome dont le Dockerfile a besoin.
  output: process.env.VERCEL ? undefined : "standalone",

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
      {
        // `/` est une page statique (aucun `dynamic`/`revalidate`) : Next émet
        // par défaut `s-maxage=31536000` (1 AN — doc `cdn-caching.md`), pensé
        // pour un CDN qui purge au déploiement (Vercel). Le VPS n'a pas ce
        // CDN : Traefik transmet l'en-tête tel quel, et le téléphone d'Aramis
        // (PWA iOS) le prend au pied de la lettre — il peut garder indéfiniment
        // le shell d'un ancien build (ancien design, écran PIN d'avant le
        // 17/08) sans jamais revoir un nouveau déploiement. On force la
        // sémantique « page dynamique » de Next au niveau HTTP, sans changer
        // le rendu côté serveur (toujours pré-rendu/rapide) : le navigateur
        // revalide systématiquement au lieu de faire confiance à un cache
        // vieux d'un an.
        source: "/",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, no-store, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
