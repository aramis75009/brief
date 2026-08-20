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
# Auth : jeton machine BRIEF_DIGEST_TOKEN (Bearer) pour /api/digest,
#        PIN (x-brief-pin) pour /api/agenda.
# Le jeton est lu depuis l'environnement local, JAMAIS commité.
# claude.ai ne peut poser que des URLs nues (pas de header) : la route digest
# accepte aussi ?token= (opt-in lecture seule) — voir `url` ci-dessous.
set -euo pipefail

BASE_URL="${BRIEF_BASE_URL:-https://brief.srv1899780.hstgr.cloud}"

# --- Résolution du jeton : env → .env.local → .env.production (copie locale) ---
resolve_secret() {
  local name="$1"
  local val="${!name:-}"
  if [ -n "$val" ]; then echo "$val"; return; fi
  for f in .env.local .env.production; do
    if [ -f "$f" ]; then
      val=$(grep -E "^${name}=" "$f" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
      [ -n "$val" ] && { echo "$val"; return; }
    fi
  done
  echo ""
}

DIGEST_TOKEN="$(resolve_secret BRIEF_DIGEST_TOKEN)"
PIN="$(resolve_secret BRIEF_PIN)"

cmd="${1:-digest}"

case "$cmd" in
  digest)
    [ -n "$DIGEST_TOKEN" ] || { echo "BRIEF_DIGEST_TOKEN introuvable (env, .env.local ou .env.production)." >&2; exit 1; }
    curl -sS -H "Authorization: Bearer $DIGEST_TOKEN" "$BASE_URL/api/digest"
    ;;
  agenda)
    [ -n "$PIN" ] || { echo "BRIEF_PIN introuvable (env, .env.local ou .env.production)." >&2; exit 1; }
    date="${2:-}"
    if [ -n "$date" ]; then
      curl -sS -H "x-brief-pin: $PIN" "$BASE_URL/api/agenda?date=$date"
    else
      curl -sS -H "x-brief-pin: $PIN" "$BASE_URL/api/agenda"
    fi
    ;;
  url)
    # URL publique pour un appelant qui ne peut poser que des URLs nues
    # (claude.ai). Le token y figure en clair : à ne partager qu'avec des
    # canaux/appelants de confiance, et révocable seul (BRIEF_DIGEST_TOKEN).
    [ -n "$DIGEST_TOKEN" ] || { echo "BRIEF_DIGEST_TOKEN introuvable (env, .env.local ou .env.production)." >&2; exit 1; }
    echo "$BASE_URL/api/digest?token=$DIGEST_TOKEN"
    ;;
  *)
    echo "Usage: $0 {digest|agenda [AAAA-MM-JJ]|url}" >&2
    exit 2
    ;;
esac
