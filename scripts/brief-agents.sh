#!/bin/bash
# brief-agents.sh — accès lecture des tâches et rendez-vous Brief pour les agents
# (Claude Code, Hermes, Codex). Lecture seule : aucun POST ici.
#
# Usage :
#   bash scripts/brief-agents.sh digest          # récap du jour (retard + échéances)
#   bash scripts/brief-agents.sh agenda 2026-08-20   # agenda fusionné d'un jour
#   bash scripts/brief-agents.sh agenda          # agenda d'aujourd'hui
#   bash scripts/brief-agents.sh url             # URL publique digest avec ?token= (pour claude.ai)
#
# Auth : un seul jeton machine, BRIEF_DIGEST_TOKEN (Bearer), pour /api/digest
#        ET /api/agenda. Le PIN a été supprimé le 2026-08-26 (auth = Supabase
#        email + mot de passe) ; /api/agenda porte depuis le 2026-08-30 une
#        garde MIXTE — session utilisateur pour l'app, jeton machine pour les
#        agents (voir src/lib/guard.ts, requireSessionOrMachineToken).
# Le jeton est lu depuis l'environnement local, JAMAIS commité.
# claude.ai ne peut poser que des URLs nues (pas de header) : la route digest
# accepte aussi ?token= (opt-in lecture seule) — voir `url` ci-dessous.
set -euo pipefail

BASE_URL="${BRIEF_BASE_URL:-https://brief.srv1899780.hstgr.cloud}"

# --- Résolution du jeton : env → .env.local → .env.production (copie locale) ---
# ⚠️ `head -1` : la PREMIÈRE définition gagne, comme le fait `@next/env` pour
# l'app. Une variable définie DEUX FOIS dans le même fichier est donc un piège
# silencieux — on colle la bonne valeur à la fin, le script (et l'app) lisent
# toujours l'ancienne, et le serveur répond 401 comme si la route était cassée.
# Constaté le 2026-08-30 sur le Mac. D'où l'avertissement explicite.
resolve_secret() {
  local name="$1"
  local val="${!name:-}"
  if [ -n "$val" ]; then echo "$val"; return; fi
  for f in .env.local .env.production; do
    if [ -f "$f" ]; then
      local count
      count=$(grep -cE "^${name}=" "$f" || true)
      if [ "$count" -gt 1 ]; then
        echo "⚠️  ${name} est défini ${count} fois dans ${f} — c'est la PREMIÈRE occurrence qui compte (ligne $(grep -nE "^${name}=" "$f" | head -1 | cut -d: -f1)). Supprime les doublons." >&2
      fi
      val=$(grep -E "^${name}=" "$f" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
      [ -n "$val" ] && { echo "$val"; return; }
    fi
  done
  echo ""
}

DIGEST_TOKEN="$(resolve_secret BRIEF_DIGEST_TOKEN)"

cmd="${1:-digest}"

case "$cmd" in
  digest)
    [ -n "$DIGEST_TOKEN" ] || { echo "BRIEF_DIGEST_TOKEN introuvable (env, .env.local ou .env.production)." >&2; exit 1; }
    curl -sS -H "Authorization: Bearer $DIGEST_TOKEN" "$BASE_URL/api/digest"
    ;;
  agenda)
    [ -n "$DIGEST_TOKEN" ] || { echo "BRIEF_DIGEST_TOKEN introuvable (env, .env.local ou .env.production)." >&2; exit 1; }
    date="${2:-}"
    if [ -n "$date" ]; then
      curl -sS -H "Authorization: Bearer $DIGEST_TOKEN" "$BASE_URL/api/agenda?date=$date"
    else
      curl -sS -H "Authorization: Bearer $DIGEST_TOKEN" "$BASE_URL/api/agenda"
    fi
    ;;
  url)
    # URL publique pour un appelant qui ne peut poser que des URLs nues
    # (claude.ai). Le token y figure en clair : à ne partager qu'avec des
    # canaux/appelants de confiance, et révocable seul (BRIEF_DIGEST_TOKEN).
    # ⚠️ Le token est base64 (contient + / =) : il DOIT être URL-encodé,
    # sinon le serveur reçoit un token tronqué → 401.
    [ -n "$DIGEST_TOKEN" ] || { echo "BRIEF_DIGEST_TOKEN introuvable (env, .env.local ou .env.production)." >&2; exit 1; }
    ENC=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$DIGEST_TOKEN")
    echo "$BASE_URL/api/digest?token=$ENC"
    ;;
  *)
    echo "Usage: $0 {digest|agenda [AAAA-MM-JJ]|url}" >&2
    exit 2
    ;;
esac
