# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-19 · Coordination multi-agents + fix PWA cache

| | |
|---|---|
| **Agent** | Hermes Agent (deepseek-v4-flash via Ollama Cloud) |
| **Branche** | `feat/agent-multi-coordination` (PR vers `feat/ui-redesign-claude`) |
| **Commits** | *(à remplir après push)* |

## Goal — l'objectif

1. **Stopper l'incident prod** : la PWA sur iPhone n'ouvre plus l'app
   (« This page couldn't load ») — cache shell d'un an (`s-maxage=31536000`
   sur `/`, corrigé par `c8c175c` de Claude Code, **déployé** le 19/08).
2. **Poser l'arborescence multi-agents** : Claude Code (Mac) + Hermes (VPS)
   travaillent en parallèle sans se marcher dessus.

## Current state — ce qui a été fait

### Incident PWA (résolu, déployé)
- Conteneur `brief-app-1` recréé le 19/08 13:48 UTC — healthy, HEAD `c8c175c`.
- `/` renvoie `Cache-Control: private, no-cache, no-store, max-age=0,
  must-revalidate` — vérifié par curl. Les 7 chunks JS : 200.
- **Action Aramis requise** : sur l'iPhone, supprimer l'icône Brief de
  l'écran d'accueil, recharger `https://brief.srv1899780.hstgr.cloud` dans
  Safari, ré-ajouter à l'écran d'accueil. (Le fix stoppe le cache futur ;
  le téléphone garde encore l'ancien shell.)

### Coordination multi-agents
- `docs/coordination.md` : les 4 copies du dépôt, la branche de prod,
  règles anti-collision.
- `scripts/coord/status.sh` : compare GitHub / copie locale / prod VPS.
- `scripts/coord/pre-push.sh` : garde-fou avant push (branche de prod
  interdite, retard sur origin, HANDOFF.md obligatoire).
- `HANDOFF.md` restauré à la racine (contrat multi-agents).
- `AGENTS.md` : corrigé — la prod est sur `feat/ui-redesign-claude`
  (l'ancien texte disait `feat/task-completion`).
- `DECISIONS.md` : décision « coordination multi-agents » ajoutée.

## Decisions — choix critiques ou irréversibles
- **GitHub = vérité centrale.** Les 3 copies ne s'alignent que par
  fetch/pull/push. Jamais de copie de fichiers entre dossiers.
- **Un agent = une branche à la fois.** Pousser sur la branche de prod
  en parallèle est interdit sans passation explicite.
- **Le PIN reste tel quel** — c'est une décision validée du 18/08 (cookie
  serveur + localStorage, une saisie par appareil). Le « PIN réapparu »
  était le cache PWA iOS, pas un retour en arrière du code.

## Changed — fichiers et composants
| Fichier | Nature |
|---|---|
| `docs/coordination.md` | **nouveau** — cadre multi-agents |
| `scripts/coord/status.sh` | **nouveau** — diagnostic des copies |
| `scripts/coord/pre-push.sh` | **nouveau** — garde-fou pre-push |
| `HANDOFF.md` | restauré à la racine (cette passation) |
| `AGENTS.md` | corrigé : branche de prod + lien coordination |
| `DECISIONS.md` | entrée « coordination multi-agents » |
| `docs/handoffs/2026-08-19-caldav-priorite-et-bugs-ui.md` | archivé (déplacé) |

## Validations — passants / échoués / non lancés
- ✅ Prod : page 200 (29ms), overview 401 sans PIN, manifest 200, sw.js 200.
- ✅ Scripts : `bash -n` (syntaxe) — voir sortie dans la PR.
- ✅ Git : origin/main = origin/feat/ui-redesign-claude = c8c175c.
- 🔶 `npx tsc --noEmit` + `vitest` : à relancer avant merge (PR).
- 🔶 Déploiement VPS : déjà fait (c8c175c est en prod).

## Blockers — ce qui bloque
- **Rien pour la PR** de coordination. Pour l'iPhone d'Aramis : l'action
  manuelle de suppression/ré-ajout de la PWA (cache shell).

## Next — la prochaine action
1. **Aramis** : réinstaller l'icône Brief sur l'iPhone (voir plus haut).
2. **Agent suivant** : lancer `bash scripts/coord/status.sh` avant de coder,
   merger cette branche, puis reprendre le handoff (CalDAV priority 1 +
   bugs UI priority 2 listés dans `TODOS.md`).
