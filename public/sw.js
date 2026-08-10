/* ---------------------------------------------------------------------------
 * Service worker — chemin de la notification.
 *
 * Servi depuis public/ et NON généré par le bundler (la doc Next propose
 * `new URL('../lib/service-worker.js', import.meta.url)`). Raison : un service
 * worker ne contrôle que son propre répertoire et ceux du dessous. Un script
 * émis sous /_next/static/ n'obtient la portée « / » qu'avec un en-tête
 * `Service-Worker-Allowed`, que rien ne garantit ici. Depuis /sw.js la portée
 * racine est acquise sans condition. Ne pas « moderniser » ce choix sans
 * vérifier la portée effective dans l'inspecteur.
 *
 * iOS ne livre les push qu'aux PWA AJOUTÉES À L'ÉCRAN D'ACCUEIL. En onglet
 * Safari, l'abonnement peut réussir et aucune notification n'arrivera jamais.
 * ------------------------------------------------------------------------ */

self.addEventListener("install", () => {
  // Prend la main sans attendre la fermeture des onglets ouverts.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  // `userVisibleOnly: true` est imposé à l'abonnement : un push reçu SANS
  // notification affichée fait révoquer l'abonnement par le navigateur. Donc
  // toujours afficher quelque chose, même si la charge utile est illisible.
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: "Brief", body: event.data.text() };
    }
  }

  const title = payload.title || "Brief";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Deux rappels du même item se remplacent au lieu de s'empiler.
    tag: payload.tag || undefined,
    renotify: !!payload.tag,
    data: { url: payload.url || "/", id: payload.id || null },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Réutilise la fenêtre déjà ouverte plutôt que d'en empiler une seconde.
      for (const client of list) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
