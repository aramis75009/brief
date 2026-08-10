# TODOS — Brief

Registre du travail différé. Écrit par `/plan-ceo-review` le 2026-08-09.
Rien de différé ne vit ailleurs que dans ce fichier.

## Contexte

Brief pivote : abandon de Todoist, organiseur autonome écrivant dans un serveur
CalDAV auto-hébergé sur un VPS Hostinger. Les apps Rappels et Calendrier d'Apple
affichent les items et déclenchent les notifications. Plan complet :
`~/.gstack/projects/aramis75009-brief/ceo-plans/2026-08-09-organiseur-caldav.md`

---

## P3 — Différé

### Sous-tâches CalDAV (`RELATED-TO`)
- **Quoi :** permettre à une dictée de produire une tâche avec ses sous-tâches.
- **Pourquoi :** Todoist Ramble ne sait explicitement pas le faire. C'est une des
  rares choses où Brief peut être meilleur que le produit qu'il remplace.
- **Pour :** hiérarchie native, portée par le protocole et affichée par l'app Rappels.
- **Contre :** complexifie le prompt et l'écran de revue, qui devient un arbre.
- **Contexte :** `RELATED-TO;RELTYPE=PARENT` dans le VTODO enfant. À reprendre une
  fois le noyau stable et l'écran de revue éprouvé sur des listes plates.
- **Effort :** M (humain) → S (CC) · **Priorité :** P3
- **Dépend de :** noyau CalDAV livré et testé.

### Apprentissage des corrections de destination
- **Quoi :** mémoriser que « Frip » finit toujours dans telle liste, et pré-remplir.
- **Pourquoi :** la correction manuelle répétée est la friction la plus visible
  d'un outil de capture qu'on utilise dix fois par jour.
- **Pour :** l'écran de revue devient de plus en plus souvent une simple validation.
- **Contre :** demande de stocker un état d'apprentissage, donc une base de plus,
  et rend le comportement moins prévisible pendant la phase d'apprentissage.
- **Contexte :** suppose un volume de corrections suffisant pour être utile.
  À reprendre après quelques semaines d'usage réel, pas avant.
- **Effort :** M (humain) → S (CC) · **Priorité :** P3
- **Dépend de :** données d'usage réelles.

### Rappels déclenchés par un lieu
- **Quoi :** « quand j'arrive au bureau, penser à … ».
- **Pourquoi :** une partie des tâches sont contextuelles, pas temporelles.
- **Pour :** capture d'une intention que la date seule ne sait pas exprimer.
- **Contre :** la portabilité en CalDAV n'est pas garantie ; à vérifier avant
  d'investir, sinon l'item se crée sans jamais se déclencher — défaillance
  silencieuse, exactement ce que cette revue cherche à éliminer.
- **Contexte :** vérifier d'abord si l'app Rappels honore un déclencheur de lieu
  sur un VTODO venu de CalDAV. Même méthode que le pic de risque sur `VALARM`.
- **Effort :** L (humain) → M (CC) · **Priorité :** P3
- **Dépend de :** un pic de vérification préalable.

### Cible CalDAV générique
- **Quoi :** faire fonctionner Brief contre Nextcloud, Fastmail ou tout serveur CalDAV.
- **Pourquoi :** Brief écrit déjà dans un protocole. Le rendre agnostique le
  transforme en porte d'entrée vocale pour tout l'écosystème, pas seulement pour
  ton serveur.
- **Pour :** aucune dépendance à Radicale ; portabilité totale de l'app.
- **Contre :** les serveurs CalDAV divergent sur les détails ; supporter plusieurs
  cibles veut dire tester contre plusieurs cibles.
- **Contexte :** ne coûte presque rien si l'implémentation évite dès le départ les
  particularités de Radicale. À garder en tête pendant le développement du noyau.
- **Effort :** M (humain) → S (CC) · **Priorité :** P3
- **Dépend de :** noyau CalDAV livré.

### Documenter « pourquoi CalDAV » dans le README
- **Quoi :** une section expliquant que le choix vient du mur des notifications iOS.
- **Pourquoi :** sans cette explication, le choix paraîtra arbitraire dans six mois,
  y compris pour toi.
- **Pour :** évite de rouvrir un débat déjà tranché avec des arguments perdus.
- **Contre :** aucun.
- **Contexte :** iOS ne fournit aucune API de notification programmée à une PWA.
  Pas de Notification Triggers, pas de Background Sync, pas de Periodic Background
  Sync, pas de Background Fetch. CalDAV délègue la notification aux apps d'Apple.
- **Effort :** S (humain) → S (CC) · **Priorité :** P3
- **Dépend de :** rien.
