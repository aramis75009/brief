/**
 * Point d'entrée au démarrage du serveur.
 *
 * `register()` est appelé UNE FOIS quand une instance Next démarre, et doit se
 * terminer AVANT que le serveur accepte la première requête (doc Next 16 :
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`).
 * C'est la seule garantie du framework qui convienne à une migration de
 * fichiers : une route ne doit jamais lire un `items.json` à moitié déplacé.
 */
export async function register() {
  // `register` s'exécute aussi en runtime Edge, où `node:fs` n'existe pas.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { migrateToMultiUser } = await import("./lib/migrate-multiuser");
    const report = await migrateToMultiUser();

    switch (report.status) {
      case "migrated":
        console.log(
          `[migration] ${report.files.length} fichier(s) attribué(s) au compte ${report.userId} : ` +
            `${report.files.join(", ") || "aucun"} ` +
            `(+ ${report.audioFiles} enregistrement(s) vocal(aux)). ` +
            `Les originaux sont dans _pre-multiuser/.`,
        );
        break;
      case "blocked":
        console.error(`[migration] BLOQUÉE — ${report.reason}`);
        break;
      case "already-migrated":
      case "fresh-install":
        console.log(`[migration] rien à faire (${report.status})`);
        break;
    }
  } catch (e) {
    // Une exception ici empêcherait le serveur de démarrer, écran de connexion
    // compris — même raisonnement que le garde-fou de `src/proxy.ts`. Un
    // démarrage sans migration est récupérable ; un site éteint ne l'est pas.
    console.error("[migration] échec inattendu, démarrage poursuivi :", e);
  }
}
