# Brief devient un organiseur autonome

Généré par `/plan-ceo-review` le 2026-08-09, révisé le 2026-08-10.
Branche : `main` · Mode : SELECTIVE EXPANSION · Repo : aramis75009/brief

**Hébergement : VPS Hostinger, 24 h/24. Décidé, non rediscuté.**

## Le déclencheur

Todoist a sorti **Ramble** en disponibilité générale : dictée → tâches structurées
avec projet, date, échéance, priorité et étiquettes. Web, macOS, Windows, iOS,
Android, Wear OS. Plus de 40 langues, français compris. Correction vocale en direct.
Gratuit jusqu'à 10 sessions/mois, illimité sur Pro.

C'est la chaîne complète de Brief, livrée par le fournisseur dont Brief dépendait.
La prémisse « satellite de Todoist » est morte le jour de cette annonce.

## Le pivot

Brief cesse d'être un tuyau vers le système de quelqu'un d'autre et devient un
organiseur autonome : tâches, calendrier, rendez-vous, rappels. Sans plafond de
projets, hébergé sur le VPS, modifiable à volonté.

Ce que Brief garde pour lui : la capture vocale qui produit *plusieurs* items
structurés d'une seule dictée, le routage automatique par projet, et la **vision
globale de charge inter-projets** — la seule chose que ni Apple ni Todoist ne
fournissent.

## Le mur, et comment le VPS le franchit

iOS ne fournit **aucune** API de notification programmée à une PWA : pas de
Notification Triggers, pas de Background Sync, pas de Periodic Background Sync,
pas de Background Fetch. Une PWA ne peut pas se réveiller pour prévenir à 9 h.

**Un serveur allumé en permanence le peut.** Le VPS envoie un Web Push à l'instant
voulu ; iOS le livre aux PWA installées via APNs. C'est du push, pas de la
récupération périodique.

### Pourquoi pas CalDAV

Un compte CalDAV **tiers** sur iOS ne reçoit pas de push. La synchronisation suit
*Récupérer les données* : intervalle minimal 15 minutes, dégradé en économie
d'énergie. Un rappel à dix minutes ne sonnerait jamais. Ce plancher vient d'iOS,
pas de l'hébergeur — le VPS ne le corrige pas.

Écarter CalDAV supprime aussi tout un registre de pièges : `VTODO` contre `VEVENT`,
ancrage du `TRIGGER` (relatif à `DTSTART` par défaut, à `DUE` seulement avec
`RELATED=END`), `PRIORITY` 1-9 inversé par rapport à Todoist, collections homogènes
attendues par les clients Apple, sémantique de complétion d'un `VTODO` récurrent —
le coin le moins interopérable de la RFC 5545 — ETags, et modèle de conflits.

## Architecture

```
                    VPS Hostinger (24/7)
   ┌──────────────────────────────────────────────────┐
   │  Brief (Next.js)                                 │
   │    /api/transcribe ─▶ Groq Whisper               │
   │    /api/parse      ─▶ Groq LLM                   │
   │    /api/capture       route texte (Raccourci iOS)│
   │                                                  │
   │  Postgres  ← SOURCE DE VÉRITÉ                    │
   │    tâches · rendez-vous · projets · récurrences  │
   │                                                  │
   │  cron (chaque minute) ─▶ Web Push ──────────────┼──▶ notification
   │                                                  │     à la seconde près
   │  /calendar.ics  (flux abonnable, lecture seule) ─┼──▶ app Calendrier iOS
   └──────────────────────────────────────────────────┘
```

**Écrivain unique.** Brief est la seule source d'écriture, donc aucun conflit de
synchronisation n'est possible. C'est ce qui rend l'ensemble simple.

**Le flux `.ics` est un confort, pas un chemin critique.** Il donne tes rendez-vous
dans l'app Calendrier d'Apple. Son rafraîchissement est lent — sans importance,
puisque la notification passe par le Web Push.

**Ce que ça coûte :** tes tâches vivent dans Brief, pas dans l'app Rappels. Pas de
widget, pas de montre, pas de Mac. Il faut ouvrir Brief pour les voir.

## Risque numéro un — 20 minutes, avant tout code

Toute l'architecture repose sur la fiabilité du Web Push vers une PWA installée sur
iOS. Test : demander la permission, envoyer une notification depuis le VPS,
verrouiller le téléphone, attendre.

Cas à couvrir : téléphone verrouillé · mode économie d'énergie · application fermée ·
plusieurs heures après l'octroi de la permission (les abonnements push expirent et
doivent être rafraîchis) · après une désinstallation puis réinstallation de la PWA.

Contrairement au pic CalDAV envisagé précédemment, ce test ne peut pas donner de
faux positif : si le push arrive au bon moment téléphone verrouillé, la chaîne est
prouvée.

**Si le Web Push échoue** : repli sur un Raccourci iOS dont l'action « Ajouter un
rappel » écrit directement dans EventKit — notification garantie par construction,
mais Brief perd la lecture, donc la vision globale.

## Le chantier sous-estimé

**La résolution des dates françaises change de camp.** Aujourd'hui `systemPrompt()`
dans `src/app/api/parse/route.ts` n'injecte jamais la date du jour, et
`due_lang: "fr"` délègue **tout** le calcul à Todoist. Sans Todoist, Brief doit
résoudre « avant vendredi », « fin de mois », « demain 14h » en date absolue avec
fuseau — c'est ce que le cron interroge pour décider quand pousser.

C'est le poste de travail le plus lourd du pivot, et c'est un **bug latent dès
aujourd'hui** : injecter `now` dans le prompt est une amélioration valable
indépendamment du pivot.

## Périmètre accepté

**Noyau**
- Capture vocale produisant plusieurs items structurés d'une seule dictée
- Écran de revue avec classement **tâche / rendez-vous visible et modifiable**
- Résolution des dates françaises en absolu avec fuseau
- Postgres sur le VPS : tâches, rendez-vous, projets, récurrences
- Cron chaque minute + Web Push
- Flux `/calendar.ics` en lecture seule
- Suppression du code Todoist : **10 fichiers**, pas 3

**Extensions retenues**
- Raccourci iOS sur le bouton Action, via une route texte authentifiée
- Récurrence reconnue depuis la voix
- File d'attente hors-ligne (voir la réserve ci-dessous)
- **Vision globale : charge par projet** — le cœur défendable, livrable indépendamment

## Réserves nommées

**File d'attente hors-ligne.** Aucun service worker n'existe dans le dépôt. Une PWA
installée sans service worker ne démarre pas hors ligne. Cette extension suppose
donc de construire la capacité offline depuis zéro. Et sans Background Sync sur iOS,
ce sera « envoi à la prochaine ouverture », pas « envoi différé ».

**Le Web Push a besoin du même service worker.** Les deux chantiers se rejoignent :
le service worker est un prérequis commun, à faire une fois.

**Dépendance orpheline.** `/api/parse` **exige** `projects` dans le corps et renvoie
400 si vide (`route.ts:140`). Tuer `/api/projects` sans nommer la nouvelle source
casse la route.

**Modèle de menace.** Aujourd'hui, PIN fuité = quelqu'un brûle des crédits Groq.
Après, PIN fuité = lecture et écriture sur ton agenda complet. Le code de
`src/lib/guard.ts` est correct ; c'est la valeur derrière qui a changé d'ordre de
grandeur. Un PIN à quatre chiffres sur une URL publique n'est plus proportionné.

**Sauvegardes.** Postgres sur le VPS devient l'unique copie — contrairement à
CalDAV, le téléphone ne détient plus de réplique. La sauvegarde passe de
souhaitable à indispensable, et une restauration non testée ne compte pas.

**`DESIGN.md` ne survit pas intégralement.** Trois justifications sont dérivées de
Todoist : le corail « dit filiale sans une ligne de texte », l'icône sombre évite le
doublon avec le carré rouge Todoist, et les **cinq** teintes correspondent au
plafond de cinq projets du plan gratuit — en contradiction directe avec « aucun
plafond de projets ».

**Estimations d'effort.** Les chiffres antérieurs (« ~4 h CC ») n'étaient pas
crédibles. À réviser après le pic Web Push, avec l'architecture arrêtée.

## Différé — voir TODOS.md

Sous-tâches · apprentissage des corrections de destination · rappels de lieu ·
cible CalDAV générique · documenter le raisonnement dans le README.

## Séquencement

1. **Pic Web Push**, 20 minutes, avant tout code.
2. Injecter `now` dans le prompt de `/api/parse` — utile quoi qu'il arrive.
3. Service worker (prérequis commun au push et au hors-ligne).
4. Postgres + cron + push.
5. Vision globale — livrable indépendamment du reste.
6. Revue d'ingénierie **après** le pic.

## Journal des révisions

| Date | Révision |
|---|---|
| 2026-08-09 | Plan initial : CalDAV auto-hébergé, Apple livre les notifications |
| 2026-08-10 | Voix externe : un CalDAV tiers n'a pas de push iOS, plancher ~15 min. Le pic proposé aurait donné un faux positif |
| 2026-08-10 | Hébergement Hostinger confirmé comme acquis. CalDAV écarté au profit de Web Push depuis le VPS : rappels à la seconde près, vision globale triviale, zéro protocole iCalendar |
