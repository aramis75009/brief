import "server-only";
import { formatDue } from "./due";
import { readSubscriptions } from "./push-store";
import { nextOccurrence } from "./rrule";
import { patchItems, readItems } from "./store";
import { sendPushToAll } from "./webpush";
import type { Item } from "./types";

/**
 * Planificateur de rappels — la raison d'être du serveur.
 *
 * iOS ne fournit aucune API de notification programmée à une application web :
 * ni Notification Triggers, ni Background Sync, ni Periodic Background Sync.
 * Une PWA ne peut pas se réveiller pour prévenir à 9 h. C'est donc ce module,
 * appelé chaque minute par un cron, qui décide de la seconde d'envoi.
 *
 * TROIS GARANTIES, dans l'ordre d'importance :
 *
 *   1. AUCUN DOUBLE ENVOI. `remindedAt` est écrit dans le même passage que
 *      l'envoi. Un item déjà notifié pour une échéance donnée ne l'est plus.
 *
 *   2. AUCUN RAPPEL PERDU. Si le cron n'a pas tourné pendant une heure — VPS
 *      redémarré, cron en panne — les échéances de cette heure sont rattrapées
 *      au passage suivant, dans la limite de GRACE_MS. Au-delà, on considère
 *      que le rappel n'a plus d'intérêt et on l'abandonne EXPLICITEMENT plutôt
 *      que de le faire sonner à contretemps.
 *
 *   3. LES RÉCURRENCES AVANCENT. Une fois notifié, un item récurrent voit son
 *      échéance déplacée à l'occurrence suivante. Une règle non comprise fait
 *      s'arrêter la série au lieu de la faire dériver.
 */

/** Au-delà, un rappel en retard est abandonné plutôt qu'envoyé à contretemps. */
const GRACE_MS = 6 * 60 * 60 * 1000;

export type ReminderRun = {
  checked: number;
  due: number;
  sent: number;
  skippedStale: number;
  advanced: number;
  /**
   * Occurrences rattrapées silencieusement à `seriesAnchor` sans notification
   * — voir le commentaire de `pendingReminders` ci-dessous.
   */
  correctedToAnchor: number;
  failures: { id: string; error: string }[];
};

/**
 * Les items dont l'échéance est atteinte et qui n'ont pas encore été notifiés.
 *
 * `beforeAnchor` : une échéance antérieure à `seriesAnchor` (quand il est
 * posé) est une occurrence FANTÔME — RFC 5545 interdit toute occurrence
 * avant DTSTART, et `seriesAnchor` EST ce DTSTART réellement écrit sur
 * iCloud (voir `src/lib/caldav.ts`). Elle n'a donc jamais existé sur le vrai
 * calendrier. Constaté le 19/08 au soir sur trois items migrés lors de la
 * session précédente : `due` traînait encore quelques jours en arrière de
 * l'ancre fraîchement figée, et Brief a sonné et affiché ces occurrences
 * comme si elles étaient réelles, jusqu'à ce que le rattrapage jour par jour
 * de `due` (plus bas) finisse par la rejoindre — plusieurs heures, plusieurs
 * faux rappels plus tard. `beforeAnchor` ferme ce trou : ni `ready` (aucun
 * push envoyé pour une occurrence qui n'existe pas), ni `stale` (elle n'est
 * pas ignorée, elle est corrigée) — `due` est réécrit sur `seriesAnchor`
 * directement par `runReminders`, sans notification, dès le prochain passage
 * (≤ 60 s) au lieu d'un rattrapage qui peut prendre des heures.
 */
export function pendingReminders(
  items: Item[],
  now: Date,
): { ready: Item[]; stale: Item[]; beforeAnchor: Item[] } {
  const ready: Item[] = [];
  const stale: Item[] = [];
  const beforeAnchor: Item[] = [];

  for (const item of items) {
    if (!item.due || item.doneAt) continue;

    const due = new Date(item.due);
    if (Number.isNaN(due.getTime())) continue;
    if (due > now) continue;

    if (item.seriesAnchor) {
      const anchor = new Date(item.seriesAnchor);
      if (!Number.isNaN(anchor.getTime()) && due < anchor) {
        beforeAnchor.push(item);
        continue;
      }
    }

    // Déjà notifié pour CETTE échéance : `remindedAt` postérieur à l'échéance.
    if (item.remindedAt && new Date(item.remindedAt) >= due) continue;

    if (now.getTime() - due.getTime() > GRACE_MS) stale.push(item);
    else ready.push(item);
  }

  return { ready, stale, beforeAnchor };
}

/** Corps de la notification. Le `tag` évite l'empilement de doublons visuels. */
function payloadFor(item: Item) {
  return {
    title: item.kind === "event" ? "Rendez-vous" : "Rappel",
    body: `${item.title} — ${formatDue(item.due, item.allDay)}`,
    tag: `item-${item.id}`,
    url: "/",
    id: item.id,
  };
}

/**
 * Un passage du planificateur. Ne lève jamais : renvoie un compte-rendu.
 * Un cron qui plante en silence est pire qu'un cron qui ne fait rien.
 */
export async function runReminders(now: Date = new Date()): Promise<ReminderRun> {
  const items = await readItems();
  const { ready, stale, beforeAnchor } = pendingReminders(items, now);

  const run: ReminderRun = {
    checked: items.length,
    due: ready.length,
    sent: 0,
    skippedStale: stale.length,
    advanced: 0,
    correctedToAnchor: beforeAnchor.length,
    failures: [],
  };

  // Les rappels trop en retard sont marqués comme traités, sinon ils seraient
  // réexaminés à chaque passage jusqu'à la fin des temps. Les occurrences
  // fantômes (avant `seriesAnchor`) sont rattrapées à l'ancre — pas de
  // `remindedAt` posé, ce n'est pas un rappel envoyé.
  const patches: { id: string; patch: Partial<Item> }[] = [
    ...stale.map((item) => ({ id: item.id, patch: { remindedAt: now.toISOString() } })),
    ...beforeAnchor.map((item) => ({ id: item.id, patch: { due: item.seriesAnchor! } })),
  ];

  if (ready.length) {
    const subs = await readSubscriptions();

    if (!subs.length) {
      // Aucun appareil abonné : on ne marque RIEN comme envoyé. Le rappel
      // repartira dès qu'un abonnement existera, tant qu'on est dans la grâce.
      run.failures.push({ id: "-", error: "Aucun abonnement push enregistré." });
    } else {
      for (const item of ready) {
        try {
          const outcomes = await sendPushToAll(subs, payloadFor(item));
          const delivered = outcomes.some((o) => o.ok);

          if (!delivered) {
            run.failures.push({
              id: item.id,
              error: outcomes.find((o) => !o.ok)?.error ?? "Envoi refusé.",
            });
            continue;
          }

          run.sent += 1;
          const patch: Partial<Item> = { remindedAt: now.toISOString() };

          if (item.rrule && item.due) {
            const next = nextOccurrence(new Date(item.due), item.rrule, now);
            if (next) {
              patch.due = next.toISOString();
              run.advanced += 1;
            } else {
              // Série terminée ou règle non comprise : on retire la récurrence
              // au lieu de la laisser dériver silencieusement.
              patch.rrule = null;
            }
          }

          patches.push({ id: item.id, patch });
        } catch (e) {
          run.failures.push({
            id: item.id,
            error: e instanceof Error ? e.message : "Échec inconnu.",
          });
        }
      }
    }
  }

  // Une seule écriture pour tout le passage : si le processus s'arrête ici,
  // soit tous les marquages sont posés, soit aucun — jamais la moitié.
  await patchItems(patches);

  return run;
}
