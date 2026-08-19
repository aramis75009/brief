# Coordination multi-agents — Brief

> **Lis ce fichier avant toute session, après `HANDOFF.md` et `DECISIONS.md`.**
> Il décrit qui travaille où, comment les copies du dépôt s'alignent, et
> comment éviter les collisions entre agents. S'il contredit un autre fichier,
> c'est lui qui fait foi — puis corrige l'autre.

## Les 4 copies du dépôt — à ne jamais confondre

| # | Copie | Où | Qui y travaille | Statut |
|---|-------|----|-----------------|--------|
| 1 | **GitHub** `aramis75009/brief` | cloud | *aucun* — c'est la **vérité centrale**, le seul mécanisme d'alignement | toujours à jour (git) |
| 2 | `/opt/data/Projets/brief` | VPS (même machine que la prod) | **Hermes Agent** | copie de travail |
| 3 | `/docker/brief` | VPS — **la production**, servie par Docker | *personne* — on y lit, on y déploie, on n'y code pas | ⚠️ conteneur `brief-app-1` |
| 4 | dossier local sur le Mac d'Aramis | Mac | **Claude Code** | copie de travail |

**Règle absolue : GitHub aligne, jamais une copie de fichiers d'un dossier à
l'autre.** Les copies 2, 3 et 4 ne communiquent qu'en passant par le repo
GitHub (pull/push/fetch).

## La branche de production — VÉRIFIER, ne pas supposer

Depuis le **2026-08-19**, la prod est servie depuis la branche
**`feat/ui-redesign-claude`** (le VPS `/docker/brief` est branché dessus).
`main` n'est plus la référence de déploiement. L'ancienne branche
`feat/task-completion` est obsolète.

> ⚠️ Ce fait a changé **deux fois** en une semaine. Ne le croyez jamais
> d'après votre mémoire : lancez `scripts/coord/status.sh` (ci-dessous) qui
> lit la branche **réelle** du VPS.

## Avant TOUTE session — le réflexe de synchronisation

1. **`git fetch origin --prune`** (copie locale) — voir si GitHub a avancé.
2. **Lire `HANDOFF.md`** — la dernière passation. Si elle a changé depuis
   votre dernière session, quelqu'un d'autre est passé entre-temps.
3. **Lancer `scripts/coord/status.sh`** — il compare les 3 copies atteignables
   (GitHub, votre copie, la prod VPS). Si la prod est en avance sur votre
   copie, **fast-forward avant de coder**.
4. **`DECISIONS.md`** — les choix validés depuis la dernière fois.

## Règles anti-collision entre agents

1. **Un agent = une branche à la fois.** Si un agent travaille sur
   `feat/ui-redesign-claude`, les autres n'y poussent pas en parallèle : ils
   créent leur propre branche depuis la pointe, puis PR.
2. **HANDOFF.md est le lieu de prise de parole.** Avant de pousser un travail
   qui change le comportement ou l'UI : écrire/mettre à jour la passation.
   Si deux agents poussent sans passer par HANDOFF, le second doit reprendre
   la main explicitement (« je reprends la main » dans le handoff).
3. **Jamais de `git push --force`, de `reset --hard`, de `rebase` sur une
   branche partagée** (sauf accord explicite d'Aramis).
4. **Les fichiers non commités** (`public/preview-v*`, `backups/`,
   `.env.*`) **ne s'écrasent jamais** — ils sont gitignorés (voir
   `.gitignore`). Un `git clean` est interdit sans vérification.
5. **Quand tu pousses, précise dans le message de commit qui tu es**
   (ex. `Hermes Agent` ou `Claude Code`) pour que l'historique reste lisible.

## Commandes

### Vérifier où en sont les copies

```bash
bash scripts/coord/status.sh
```

### Récupérer la pointe (copie 2, Hermes)

```bash
git fetch origin --prune
git merge --ff-only origin/feat/ui-redesign-claude
```

### Déployer la prod (VPS, réservé)

```bash
cd /docker/brief && git pull origin feat/ui-redesign-claude \
  && docker compose --env-file .env.production up -d --build
```

### Sauvegarder les données avant tout déploiement

```bash
sudo /docker/brief/deploy/backup.sh
```

## Quand tout déraille — le plan de retour

1. Ne rien écraser. Le volume `brief-data` est l'unique copie des items.
2. `git fetch origin` sur la copie concernée, regarder l'écart.
3. Reconstruire la branche prod à partir de `origin/feat/ui-redesign-claude`.
4. Tester `scripts/coord/status.sh` → toutes les copies alignées = OK.
