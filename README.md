# Brief

Dictée vocale → tâches Todoist. Tu parles, Whisper transcrit, un LLM découpe la
note en tâches, tu relis, ça part dans Todoist.

Next.js 16 (App Router) · React 19 · Tailwind v4 · déployé sur Vercel.

## Chaîne

```
micro → /api/transcribe → /api/parse → écran Revue → /api/push → Todoist
        (Groq Whisper)     (Groq LLM)   (édition)     (séquentiel)
```

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis remplis les valeurs
npm run dev                  # http://localhost:3000
```

Le micro exige un contexte sécurisé : `localhost` convient, une IP de LAN non.

## Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `BRIEF_PIN` | Code d'accès. Vérifié **côté serveur** sur toutes les routes `/api/*`. | — (obligatoire) |
| `GROQ_API_KEY` | Transcription et structuration. | — (obligatoire) |
| `TODOIST_API_TOKEN` | Lecture des projets, création des tâches. | — (obligatoire) |
| `TRANSCRIBE_PROVIDER` | `groq` ou `voicebox`. | `groq` |
| `TRANSCRIBE_MODEL` | Modèle de transcription. | `whisper-large-v3` |
| `PARSE_MODEL` | Modèle de structuration. | `openai/gpt-oss-20b` |
| `NEXT_PUBLIC_APP_NAME` | Titre affiché. Exposé au navigateur. | `Brief` |
| `VOICEBOX_URL` | Base d'un Voicebox local. Implémenté, non testé. | — |

`VOICEBOX_URL` n'est **pas** posée sur Vercel : le service tourne sur le LAN,
injoignable depuis une fonction cloud.

## Sécurité

L'URL de déploiement est publique. La seule barrière est
[`src/lib/guard.ts`](src/lib/guard.ts) : chaque route `/api/*` compare le header
`x-brief-pin` à `process.env.BRIEF_PIN` en temps constant, et renvoie `401`
sinon. **Toute nouvelle route sous `/api/` doit commencer par :**

```ts
const denied = requirePin(req);
if (denied) return denied;
```

L'écran PIN et le `sessionStorage` ne sont que de l'UX — ils ne protègent rien.

## Routes

| Route | Entrée | Sortie |
|---|---|---|
| `POST /api/session` | header PIN | `{ ok: true }` — valide un code |
| `POST /api/transcribe` | multipart `file` + `mimeType` | `{ text }` |
| `GET /api/projects` | — | `[{ id, name }]`, cache serveur 1 h, repli en dur |
| `POST /api/parse` | `{ text, projects }` | `{ tasks }` |
| `POST /api/push` | `{ tasks }` | `{ results, created, total }` — `207` si partiel |

## Pièges à connaître

- **`project_id` Todoist est une chaîne** alphanumérique (`6hF34F5QgwXp7JHf`).
  Jamais de `parseInt` : elle deviendrait `6`.
- **`due_lang: "fr"` est obligatoire** sur chaque tâche. Sans lui, Todoist lit
  « demain 14h » en anglais et ignore la date.
- **`/api/push` n'utilise pas la syntaxe Quick Add.** Ni `#projet`, ni `p2`, ni
  date dans le texte : tout passe par les champs.
- **Jamais de tout-ou-rien à l'envoi.** Les tâches partent une par une et le
  client reçoit un résultat par tâche, pour ne réessayer que les échecs.
- **Tailwind v4 ne compile pas les utilitaires arbitraires contenant `env()`.**
  Les safe areas passent par `.safe-top` / `.safe-bottom` dans `globals.css`.
- **Le reset CSS doit rester dans `@layer base`.** Hors layer, il l'emporte sur
  les utilitaires Tailwind — c'est ce qui affichait un bouton noir sur noir.
- **Plan Todoist gratuit : 5 projets.** Brief n'en crée aucun.

## Déploiement

Le repo est connecté à Vercel : un push sur `main` déclenche un déploiement de
production. Les variables sont posées sur les trois cibles.

```bash
vercel env ls                      # état par cible
vercel env add NOM production --force --yes --sensitive
vercel deploy --prod               # déploiement manuel si besoin
```

Les variables *Sensitive* ne sont acceptées que sur Production et Preview :
sur Development, utiliser `--no-sensitive`.

## Vérifications rapides

```bash
# le garde répond bien 401 sans PIN
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<url>/api/session

# structuration de bout en bout
curl -s -X POST https://<url>/api/parse \
  -H 'x-brief-pin: <PIN>' -H 'Content-Type: application/json' \
  -d '{"text":"demain photographier les polos","projects":[{"id":"...","name":"Frip & Trend"}]}'
```
