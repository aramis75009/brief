# Refonte Brief v2 — spec de conception

**Date** : 2026-09-07 · **Agent** : Claude Code (Opus 5) · **Branche** : `feat/refonte-v2`

Source visuelle : `docs/brief-refonte-v2.dc.html`, importé du projet Claude Design
`de78eee2-0a67-4d78-8ed2-f8f84c12affb` (fichier « Brief Refonte.dc.html »).
Décision d'Aramis : ce prototype **est** la cible. On construit tout, on corrige
ensuite — pas de livraison lot par lot avec attente entre chaque.

---

## 1. Ce que la refonte change

La nav horizontale à sept onglets devient une **sidebar à cinq entrées**, et les
écrans Calendrier / Kanban / Idées / Objectifs cessent d'être des destinations
pour devenir des **vues** d'un contenu unique.

| Sidebar | Contenu |
|---|---|
| Accueil | 1ʳᵉ tuile + donut/avancement semaine **conservés de la v1**, widgets déplaçables autour |
| Boîte de réception | onglets **Activité** (journal) et **À trier** (les idées) |
| Mes tâches | Liste · Tableau · Calendrier · Tableau de bord · Fichiers |
| Portefeuilles | groupes de projets **+ objectifs** |
| Graphe | inchangé ; amélioration objectifs/n8n différée (lot 8) |
| *Projets* (liste) | mêmes vues **+ Chronologie** |

---

## 2. Modèle de données

### 2.1 `Item.startDate` — le seul ajout structurant

Le proto affiche des **plages** (« Aujourd'hui – 8 sep ») dans la Liste, sur les
cartes du Tableau, en bandes sur le Calendrier et en barres sur la Chronologie.
Brief n'a que `due` + `durationMinutes` : quatre vues sur six sont impossibles à
rendre honnêtement sans borne basse.

```ts
/** Borne basse d'une plage. `null`/absent = la tâche n'a qu'une échéance. */
startDate?: string | null;
```

Correspondance CalDAV : DTSTART d'un VTODO (DUE reste `due`), DTSTART d'un VEVENT
(DTEND reste dérivé de `durationMinutes`). Aucune régression pour un item sans
`startDate`.

**Invariant hérité** : `startDate` obéit à la même règle que `due` — une chaîne
non parseable devient `undefined`, jamais une date approchée.

### 2.2 Additifs sans risque

```ts
export type Attachment = { id, name, mime, sizeBytes, addedAt };  // Item.attachments[]
export type Portfolio  = { id, name, projectIds[], createdAt, archived? };  // portfolios.json
export type InboxEvent = { id, kind, title, body, at, readAt, itemId?, projectId? };  // inbox.json
```

`InboxEventKind` : `reminder` | `caldav` | `unblocked` | `capture` | `objective`.

### 2.3 Le statut est DÉRIVÉ, jamais stocké

Le proto montre *Dans les délais / À risque / En retard* comme une donnée. Stocké,
ce champ pourrit : une tâche marquée « Dans les délais » dont l'échéance est passée
hier s'afficherait en vert. Dérivé, il est juste en permanence.

`src/lib/status.ts` :

- `done` — `doneAt` posé ;
- `late` — échéance **effective** (override appliqué) dépassée ;
- `atrisk` — échéance dans les 48 h **et** bloquée par une dépendance non faite,
  **ou** échéance dans les 24 h avec des sous-tâches restantes ;
- `ontrack` — sinon.

Comparaisons de durée uniquement : aucune méthode locale de `Date`
(invariant `AGENTS.md`).

### 2.4 Priorité — on garde l'échelle existante

`Priority = 1|2|3|4`, **1 = la plus haute** (RFC 5545). Le proto n'a que trois
libellés ; on en affiche **quatre** — Urgente / Élevée / Moyenne / Faible — avec
les pastels du proto étendus. Aucune seconde échelle, aucune conversion.

### 2.5 Les « sections » du proto sont le Kanban existant

Le proto groupe par *À faire / En cours / Terminé* dans la Liste **et** en colonnes
dans le Tableau : une seule donnée vue deux fois. C'est `KanbanColumn` +
`Item.columnId`, déjà en place. On les unifie plutôt que d'ajouter un champ
`section` parallèle — glisser une carte dans le Tableau déplace la ligne dans la
Liste, sans code supplémentaire.

Hors projet, « Mes tâches » groupe par temps (`src/lib/buckets.ts`, déjà servi
par `/api/overview`).

---

## 3. Ce qui reste hors périmètre, et pourquoi

**Le partage de projet entre comptes.** Brief est multi-compte depuis le 31/08,
mais `storeForUser(userId)` lit `users/<userId>/` : aucune donnée n'est visible
d'un compte à l'autre. Le but d'Aramis (travailler à trois sur un projet) demande
une couche de partage qui n'existe pas. Elle n'est pas dans cette refonte ; le
champ « Responsable » affiche le titulaire du compte et est façonné pour accueillir
un membre plus tard.

---

## 4. Lots

1. Squelette (sidebar + onglets de vues) + vue Liste + vue Tableau
2. Fiche latérale (452 px + focus plein écran) + priorités + statut
3. Calendrier + Chronologie
4. Accueil (tuile + donut conservés) + Tableau de bord
5. Portefeuilles + Objectifs fusionnés
6. Boîte de réception (Activité + À trier) + pièces jointes / Fichiers
7. Mobile revu (hero 34 px, 4 tuiles, groupes temporels, Projets)
8. Graphe ↔ objectifs façon n8n — **différé, demandé par Aramis**

## 5. Vérifications

`npx eslint .`, `npx tsc --noEmit`, `npx vitest run` avant chaque commit. Aucun
bouton mort : ce qui est à l'écran est câblé ou n'y est pas. Recette authentifiée
sur le compte agent Supabase (`.env.local`, `BRIEF_AGENT_*`).
