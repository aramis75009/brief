# Accès des agents aux tâches et rendez-vous Brief (API lecture)

Claude Code, Hermes et Codex peuvent lire les tâches et rendez-vous d'Aramis
**sans toucher au volume ni à la base** : Brief expose déjà deux routes HTTP
publiques, protégées par des secrets dédiés.

## Le script

```bash
bash scripts/brief-agents.sh digest              # récap du jour (retard + échéances)
bash scripts/brief-agents.sh agenda 2026-08-20  # agenda fusionné d'un jour
bash scripts/brief-agents.sh agenda              # agenda d'aujourd'hui
bash scripts/brief-agents.sh url                 # URL publique digest avec ?token= (pour claude.ai)
```

Sortie : JSON brut, prêt à être mis en forme par l'agent appelant.

## claude.ai (abo Pro) — URL nue avec `?token=`

claude.ai ne peut pas poser de header HTTP : il ne fait que des GET sur une
URL. La route `GET /api/digest` accepte donc aussi le jeton en query param :

```
https://brief.srv1899780.hstgr.cloud/api/digest?token=<BRIEF_DIGEST_TOKEN>
```

- **Opt-in strict** : seul `/api/digest` l'active (`allowQueryToken` dans
  `cron-auth.ts`). Le PIN n'est **jamais** accepté en query, et aucune route
  d'écriture (capture, items) n'accepte le query token.
- Le token figure **en clair dans l'URL** : il peut traîner dans l'historique
  du navigateur, les logs du serveur, les journaux de claude.ai. C'est
  acceptable pour un jeton de lecture seule, révocable seul — mais à ne
  partager qu'avec des canaux de confiance.
- Le header `Authorization: Bearer` reste prioritaire quand les deux sont
  présents.

## Secrets — jamais commités

Le script lit `BRIEF_DIGEST_TOKEN` (digest) et `BRIEF_PIN` (agenda) dans cet
ordre : variable d'environnement → `.env.local` → `.env.production` (copie
locale). **Aucun secret ne doit entrer dans git** (`.env*` est ignoré).

- **Sur le Mac d'Aramis** (Claude Code) : ajouter au `.env.local` de la copie
  locale :
  ```
  BRIEF_DIGEST_TOKEN=<valeur du VPS>
  BRIEF_PIN=<valeur du VPS>
  ```
  Les valeurs se lisent sur le VPS dans `/docker/brief/.env.production` —
  jamais dans un commit, une PR ou une passation.
- **Sur le VPS** (Hermes) : les variables existent déjà dans
  `/docker/brief/.env.production` ; le script les trouve si on l'exécute depuis
  `/docker/brief`, sinon les passer en environnement.

## Pourquoi deux secrets

| Route | Secret | Portée |
|---|---|---|
| `GET /api/digest` | `BRIEF_DIGEST_TOKEN` (Bearer) | **Lecture seule**, conçu pour un automate. Retard + échéances du jour seulement. |
| `GET /api/agenda?date=` | `BRIEF_PIN` (`x-brief-pin`) | Clé maîtresse de l'app : ouvre aussi l'écriture et `/api/transcribe`. **À n'utiliser que pour la lecture d'une date précise, jamais pour écrire.** |

Le digest est le choix par défaut : révocable seul, sans risque d'effet de
bord. L'agenda ne sert que quand une date précise est demandée.

## Limites connues

- Le digest ne couvre que **aujourd'hui** (retard + échéances du jour), dans le
  fuseau du serveur (Europe/Paris). Pas de plage arbitraire.
- L'agenda couvre **un jour** à la fois, fusion items Brief + instantané CalDAV
  (les événements posés directement dans l'app Calendrier y figurent, avec
  `source: "caldav"`).
- Les deux routes sont en lecture seule. Écrire (créer une tâche, cocher) reste
  une décision à part — voir `docs/coordination.md` et le skill
  `apple-calendar-sync` (référence `brief-prod-api.md`).
