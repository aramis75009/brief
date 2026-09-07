/**
 * Fabrication des événements du journal.
 *
 * **L'identifiant porte tout le dédoublonnage.** Les crons repassent toutes
 * les 60 secondes sur les mêmes items ; un id qui contiendrait l'heure de
 * l'écriture produirait une ligne par passage jusqu'à noyer le journal. Il est
 * donc construit à partir du FAIT (quel item, quelle occurrence) et de rien
 * d'autre — deux passages sur le même fait donnent le même id, et
 * `store.appendInbox` écarte le second.
 *
 * Ce module est pur : il ne lit ni n'écrit le disque. C'est ce qui permet de
 * vérifier le dédoublonnage sans faire tourner un cron.
 */

import type { InboxEvent, Item } from "./types";

/**
 * Un instant réduit à la minute, en clé d'identifiant.
 *
 * La minute est la bonne granularité : le cron passe à cette fréquence, donc
 * deux passages consécutifs sur le même rappel tombent sur la même clé. À la
 * seconde, le dédoublonnage ne servirait à rien.
 */
function minuteKey(iso: string): string {
  return iso.slice(0, 16).replace(/[-:T]/g, "");
}

/** « Rappel envoyé » — un pour chaque item dont le push est parti. */
export function reminderEvent(item: Item, at: Date): InboxEvent {
  return {
    id: `rem-${item.id}-${minuteKey(item.due ?? at.toISOString())}`,
    kind: "reminder",
    title: "Rappel envoyé",
    body: item.title,
    at: at.toISOString(),
    readAt: null,
    itemId: item.id,
    projectId: item.projectId,
  };
}

/**
 * « Apple Calendar a modifié… » — une édition adoptée depuis l'app Calendrier.
 *
 * C'est l'événement qui manquait le plus : une séance déplacée dans Apple
 * arrivait dans Brief sans que rien ne le dise, et la seule façon de s'en
 * apercevoir était de comparer les deux écrans.
 */
export function caldavEvent(item: Item, what: string, at: Date): InboxEvent {
  return {
    // `what` entre dans l'id : deux adoptions différentes sur le même item à
    // la même minute (l'heure ET le titre) sont deux faits, pas un doublon.
    id: `cal-${item.id}-${minuteKey(at.toISOString())}-${what.slice(0, 12)}`,
    kind: "caldav",
    title: "Modifié depuis Apple Calendar",
    body: `${item.title} — ${what}`,
    at: at.toISOString(),
    readAt: null,
    itemId: item.id,
    projectId: item.projectId,
  };
}

/** « Tâche débloquée » — sa dernière dépendance non faite vient d'être cochée. */
export function unblockedEvent(item: Item, at: Date): InboxEvent {
  return {
    id: `unb-${item.id}`,
    kind: "unblocked",
    title: "Tâche débloquée",
    body: `${item.title} n'attend plus aucune dépendance.`,
    at: at.toISOString(),
    readAt: null,
    itemId: item.id,
    projectId: item.projectId,
  };
}

/** « Dictée structurée » — une capture vocale vient de produire des items. */
export function captureEvent(items: Item[], at: Date): InboxEvent | null {
  if (items.length === 0) return null;
  const tasks = items.filter((it) => it.kind === "task").length;
  const events = items.length - tasks;
  const parts = [
    tasks > 0 ? `${tasks} tâche${tasks > 1 ? "s" : ""}` : null,
    events > 0 ? `${events} rendez-vous` : null,
  ].filter(Boolean);
  // Accord du participe : « tâche » est féminin, « rendez-vous » masculin, et
  // un mélange des deux impose le masculin pluriel.
  const agreed =
    events === 0
      ? `extraite${tasks > 1 ? "s" : ""}`
      : tasks === 0
        ? `extrait${events > 1 ? "s" : ""}`
        : "extraits";
  return {
    // L'id vient du PREMIER item créé : rejouer le même enregistrement (double
    // clic, file d'attente qui repart) réutilise les mêmes ids d'items, donc
    // produit le même id d'événement.
    id: `cap-${items[0].id}`,
    kind: "capture",
    title: "Dictée structurée",
    body: `${parts.join(" et ")} ${agreed} de ta capture.`,
    at: at.toISOString(),
    readAt: null,
    itemId: items[0].id,
    projectId: items[0].projectId,
  };
}

/**
 * Les tâches qui viennent d'être DÉBLOQUÉES par une écriture.
 *
 * Compare l'avant et l'après : une tâche est débloquée si elle avait au moins
 * une dépendance non faite avant, et n'en a plus aucune après. Sans la
 * comparaison, chaque passage annoncerait « débloquée » sur toutes les tâches
 * prêtes du compte.
 */
export function newlyUnblocked(before: Item[], after: Item[]): Item[] {
  const doneBefore = new Set(before.filter((it) => it.doneAt).map((it) => it.id));
  const doneAfter = new Set(after.filter((it) => it.doneAt).map((it) => it.id));

  const wasBlocked = (it: Item) =>
    (it.dependsOn ?? []).some((id) => !doneBefore.has(id));
  const isBlocked = (it: Item) => (it.dependsOn ?? []).some((id) => !doneAfter.has(id));

  const beforeById = new Map(before.map((it) => [it.id, it]));
  return after.filter((it) => {
    // Une tâche déjà faite n'est pas « débloquée » : elle n'attend plus rien
    // parce qu'elle est finie, pas parce que sa chaîne s'est libérée.
    if (it.doneAt) return false;
    if ((it.dependsOn ?? []).length === 0) return false;
    const prev = beforeById.get(it.id);
    // Une tâche qui n'existait pas avant n'a rien été débloquée : elle vient
    // de naître, éventuellement déjà prête.
    if (!prev) return false;
    return wasBlocked(prev) && !isBlocked(it);
  });
}
