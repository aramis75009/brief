import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// ⚠️ La suite tourne en UTC, pas dans le fuseau de la machine.
//
// Les conteneurs de production n'ont pas de `TZ` : ils sont en UTC. Une suite
// verte sur un Mac réglé sur Europe/Paris ne dit donc rien de ce qui tournera
// sur le VPS. C'est ce qui a laissé passer le décalage de deux heures sur les
// échéances relatives, corrigé le 2026-08-14 — les tests le voyaient, mais
// seulement sur une machine en UTC.
//
// Forcer UTC ici fait échouer en local ce qui échouerait en production. Le code
// de `src/lib/due.ts` est indépendant du fuseau machine : la suite doit passer
// sous n'importe quel `TZ`, et `TZ=Europe/Paris npx vitest run` doit aussi
// être vert.
process.env.TZ = "UTC";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Voir test/server-only-stub.ts pour la raison.
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
});
