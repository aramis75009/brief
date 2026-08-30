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

- **Opt-in strict** : seules les routes de lecture machine l'activent —
  `/api/digest` et, depuis le 2026-08-30, `/api/agenda` (`allowQueryToken`
  dans `cron-auth.ts`). Aucune route d'écriture (capture, items) n'accepte le
  query token.
- Le token figure **en clair dans l'URL** : il peut traîner dans l'historique
  du navigateur, les logs du serveur, les journaux de claude.ai. C'est
  acceptable pour un jeton de lecture seule, révocable seul — mais à ne
  partager qu'avec des canaux de confiance.
- Le header `Authorization: Bearer` reste prioritaire quand les deux sont
  présents.

## Secrets — jamais commités

Le script lit **un seul** secret, `BRIEF_DIGEST_TOKEN`, dans cet ordre :
variable d'environnement → `.env.local` → `.env.production` (copie locale).
**Aucun secret ne doit entrer dans git** (`.env*` est ignoré).

- **Sur le Mac d'Aramis** (Claude Code) : ajouter au `.env.local` de la copie
  locale :
  ```
  BRIEF_DIGEST_TOKEN=<valeur du VPS>
  ```
  La valeur se lit sur le VPS dans `/docker/brief/.env.production` — jamais
  dans un commit, une PR ou une passation. ⚠️ **Elle doit être exactement
  celle de la prod** : un `.env.local` qui porte une valeur différente donne
  un `{"error":"Jeton invalide."}` en 401, indiscernable d'une route cassée
  (constaté le 2026-08-30 sur le Mac).
- **Sur le VPS** (Hermes) : la variable existe déjà dans
  `/docker/brief/.env.production` ; le script la trouve si on l'exécute depuis
  `/docker/brief`, sinon la passer en environnement.

`BRIEF_PIN` n'existe plus : le PIN a été supprimé le 2026-08-26 (auth =
Supabase email + mot de passe). Ne pas le réintroduire.

## Un seul secret, deux routes

| Route | Secret | Garde | Portée |
|---|---|---|---|
| `GET /api/digest` | `BRIEF_DIGEST_TOKEN` (Bearer ou `?token=`) | machine seule | **Lecture seule**, conçu pour un automate. Retard + échéances du jour seulement. |
| `GET /api/agenda?date=` | `BRIEF_DIGEST_TOKEN` (Bearer ou `?token=`) | **mixte** : session utilisateur **ou** jeton machine | **Lecture seule.** Agenda fusionné d'un jour (items Brief + instantané CalDAV). |

**Pourquoi la garde de l'agenda est mixte** (décision Aramis du 2026-08-30) :
`/api/agenda` est la source unique de l'accueil, de l'onglet Agenda et du
calendrier desktop — l'app l'appelle avec la session de l'utilisateur. La
basculer sur le seul jeton machine éteindrait ces trois écrans sans qu'aucune
erreur serveur ne le signale. `requireSessionOrMachineToken`
(`src/lib/guard.ts`) accepte les deux : jeton machine s'il y en a un de
présenté, session sinon.

⚠️ La garde mixte est réservée à la **lecture**. Aucune route d'écriture ne
doit la porter : un secret déposé dans une crontab ou un raccourci iOS ne doit
pas ouvrir la porte de l'écriture.

## Limites connues

- Le digest ne couvre que **aujourd'hui** (retard + échéances du jour), dans le
  fuseau du serveur (Europe/Paris). Pas de plage arbitraire.
- L'agenda couvre **un jour** à la fois, fusion items Brief + instantané CalDAV
  (les événements posés directement dans l'app Calendrier y figurent, avec
  `source: "caldav"`).
- Les deux routes sont en lecture seule. Écrire (créer une tâche, cocher) reste
  une décision à part — voir `docs/coordination.md` et le skill
  `apple-calendar-sync` (référence `brief-prod-api.md`).
