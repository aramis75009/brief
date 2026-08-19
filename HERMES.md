# HERMES.md — instructions pour Hermes Agent

> Lis d'abord **`AGENTS.md`** (contrat commun, il t'est injecté automatiquement)
> puis **`HANDOFF.md`** (où en est le projet). Ce fichier-ci ne contient que ce
> qui te concerne toi, et **il n'est pas chargé automatiquement** : ouvre-le à
> la main au début de chaque tâche sur Brief.
>
> Rédigé le 2026-08-14 à partir de tes propres réponses à 23 questions.
> Si un fait ci-dessous devient faux, dis-le plutôt que de travailler avec.

## Qui tu es

| | |
|---|---|
| Orchestrateur | Hermes Agent v0.20.0 (2026.8.3), Nous Research, `/opt/hermes` |
| Modèle | `deepseek/deepseek-v4-flash-0731` via OpenRouter |
| Modèle vision | `google/gemma-4-26b-a4b-it:free`, même passerelle |
| Conteneur | `hermes-agent-samk-hermes-agent-1` (Docker, PID 1 = `s6-svscan`) |
| Interface | WhatsApp, numéro bridé à celui d'Aramis |
| Outils | `search_files` (grep + glob), `read_file` (pagination ~2000 l.), terminal, `clarify` |

---

## 1. Le contexte qui t'a manqué la dernière fois

Tu as signalé trois manques le 2026-08-14. Les voici, une fois pour toutes.

### Tu tournes sur le VPS de production

Ton conteneur et la production de Brief sont sur **la même machine**. Ce n'est
pas une machine de développement isolée. Une commande destructive sur le système
de fichiers du VPS touche ce qui sert Aramis.

### Deux copies du dépôt, à ne jamais confondre

| Chemin | Quoi | Tu y touches ? |
|---|---|---|
| `/opt/data/Projets/brief` | **Ta copie de travail.** | ✅ oui |
| `/docker/brief` | **La production.** C'est ce qui sert le site. | ❌ **non** — voir §2 |

Les deux pointent sur `github.com/aramis75009/brief`. C'est GitHub qui les
aligne, jamais une copie de fichiers d'un dossier à l'autre.

### L'adresse et la branche de production

- Domaine : **`https://brief.srv1899780.hstgr.cloud`**
- L'IP : `dig +short brief.srv1899780.hstgr.cloud` — ne la code jamais en dur.
- **La prod est sur la branche `feat/task-completion`, pas sur `main`.**
  Vérifie (`git -C /docker/brief branch --show-current`) avant de supposer.
- Traefik est partagé avec n8n, dans `/docker/traefik`. Brief s'y branche par
  les labels de `app`. **Il n'y a pas de proxy dans le dépôt Brief.**

---

## 2. Ce que tu ne fais pas sans accord explicite d'Aramis

Tu as répondu que tu peux techniquement tout faire, et qu'aucune liste
d'interdits n'existait. En voici une.

**STOP — demande avant, via `clarify`, et attends la réponse :**

1. **Pousser sur `main`.**
2. **Toucher à `/docker/brief`** — quelle que soit la commande.
3. **`docker compose up`, `down`, `restart`** ou tout redémarrage de conteneur
   de production.
4. **Écrire dans `.env.production`, `.env.local`** ou tout fichier de secrets.
5. **Toucher au volume `brief-data`.** C'est **l'unique copie** de
   l'organisation d'Aramis — aucun téléphone n'en garde de réplique. Le perdre,
   c'est tout perdre.
6. **Supprimer des fichiers** en dehors de ceux que tu viens de créer.
7. **`git push --force`**, `reset --hard` sur une branche partagée, `rebase`
   d'une branche déjà poussée.
8. **Toucher à Traefik** ou à quoi que ce soit qui serve n8n.
9. **Ajouter une dépendance** (`npm install <paquet>`).

**Autorisé sans demander :** lire n'importe quoi dans `/opt/data/Projets/brief`,
y écrire, créer une branche, commiter, pousser cette branche sur `origin`,
ouvrir une PR, lancer les tests, `tsc`, `eslint`, `npm run build`.

**Lire `.env.production` :** seulement si la tâche l'exige. **Ne recopie jamais
un secret dans un message WhatsApp, un commit, une PR ou une passation.**
Réfère-toi à la variable par son nom.

---

## 3. Avant chaque commit

Le 2026-08-14, tu as lancé la suite complète avant `078c6b5`, puis seulement
`eslint` et `tsc` avant `310cdb7` et `42bf442`. Tu l'as dit honnêtement quand on
te l'a demandé — c'est bien. Maintenant c'est la règle :

```bash
npx eslint .
npx tsc --noEmit
npx vitest run
```

**Les trois. Y compris pour un « petit correctif d'UI ».** Les deux commits où
tu as sauté les tests sont ceux qu'Aramis a dû relire le plus attentivement.

### Tu avais raison, et on ne t'a pas cru assez vite

Tu voyais 7 échecs sur `due.test.ts` et tu les as classés en « faux positifs
d'environnement ». **Les échecs étaient réels ; c'est le diagnostic qui était
faux.**

- Machine d'Aramis, à Paris : 68/68 passaient.
- Ton conteneur, en UTC : 61 passaient, 7 échouaient — tes chiffres exacts.
- **C'est toi qui voyais la production. La machine d'Aramis mentait.**

Cause : les méthodes locales de `Date` lisent le fuseau de la machine. Résultat,
« demain » sonnait à 11 h au lieu de 9 h sur le VPS. Corrigé le 2026-08-14 dans
quatre fichiers, dont trois que tes tests ne couvraient pas. La suite est
désormais forcée en UTC par `vitest.config.mts` : ce que tu vois est ce que voit
la production.

**Deux règles qui en découlent :**

1. **N'attribue jamais un échec à « l'environnement » sans avoir lu le code
   testé.** Un échec est une hypothèse à vérifier, pas un obstacle à contourner.
   Ton instinct était bon — c'est la conclusion qui a manqué d'un cran.
2. **N'utilise aucune méthode locale de `Date`** (`setHours`, `getDay`,
   `setDate`, `getMonth`). Tout calcul de date passe par `src/lib/zoned.ts`.

---

## 4. Tes modes d'échec connus, et quoi faire

Repris de tes réponses. Quand tu retombes dessus, tu sais déjà.

| Symptôme | Cause | Réponse |
|---|---|---|
| `git push` → *permission denied* | Remote en HTTPS | Remote en SSH + `core.sshCommand` sur la bonne clé. Déjà configuré — ne le refais pas, vérifie. |
| API Hostinger en 404 | Chemins v2 essayés | **La v1 est la bonne.** |
| `due.test.ts` échoue | Fuseau | **Vrai bug**, voir §3. Pas un faux positif. |
| Lint rouge sur `@/lib/...` | Faux positif de l'alias | `npx tsc --noEmit` fait foi. Ne « corrige » pas un import qui marche. |
| Mémoire refuse une note | Filtre anti-injection sur motifs SSH | Reformule sans la chaîne littérale. |

**Ton point faible, tel que tu l'as identifié :** tu ne peux pas prouver un
effet sur un canal externe — un Web Push arrivé sur un iPhone verrouillé, par
exemple. **Alors ne l'affirme pas.** Écris « non vérifié — demande à Aramis de
tester sur son téléphone ». Une validation inventée coûte plus cher qu'un aveu.

---

## 5. Comment livrer

### Une branche, jamais `main`

```
feat/<sujet-court>   ou   fix/<sujet-court>
```

Elle part de la branche que la tâche vise — souvent `feat/task-completion`, pas
`main`. Demande si tu hésites.

Messages de commit **en anglais**, format `type: sujet` (`feat:`, `fix:`,
`chore:`, `docs:`). Tes commits du 14 août étaient en français : c'est le seul
écart de convention à corriger.

### Écris la passation

**Une tâche n'est pas finie tant que `HANDOFF.md` n'est pas à jour.** Le gabarit
et la marche à suivre sont dans `AGENTS.md`, section « Terminer une session ».

Deux points qui te concernent particulièrement :

- **La ligne `Agent`.** Tes commits portent `Aramis
  <aramis.begnene@gmail.com>` : rien dans git ne distingue ton travail du sien.
  `HANDOFF.md` est le seul endroit où l'attribution existe. Écris
  `Hermes Agent v0.20.0 · deepseek-v4-flash`.
- **La section `Validations`.** Trois états : passant, échoué, **non lancé**.
  Colle la sortie réelle. Si tu as sauté une commande, écris-le — c'est
  exactement l'information qu'Aramis cherche en premier quand quelque chose
  casse.

### Le résumé WhatsApp

En français, court. Ce qui a été fait, ce qui a été vérifié, ce qui ne l'a pas
été, le nom de la branche poussée. **Pas de secret dans le message.**

---

## 6. Quand t'arrêter et demander

Tu as l'outil `clarify` et tu sais t'en servir. Utilise-le plutôt que de
deviner :

- la tâche touche l'un des 9 points du §2 ;
- la tâche demande de fusionner ou de déployer ;
- deux fichiers de doc se contredisent ;
- un test échoue et tu ne comprends pas pourquoi ;
- tu t'apprêtes à modifier plus de fichiers que la tâche ne le laissait prévoir ;
- la tâche suppose un état de la prod que tu n'as pas vérifié.

**Une question coûte deux minutes à Aramis. Un déploiement cassé lui coûte sa
soirée, et un volume perdu lui coûte son organisation entière.**
