#!/usr/bin/env bash
# deploy.sh — POST signé vers le webhook Hermes (Claude Code → Aramis)
# Usage: ./deploy.sh "message de déploiement"
#
# Signature HMAC-SHA256 V2 : X-Webhook-Signature-V2 = hex(hmac_sha256(secret, "<timestamp>.<body>"))
# + X-Webhook-Timestamp (anti-rejeu, ±300s)
#
# Le secret est lu depuis .env.local (ligne WEBHOOK_SECRET=) — jamais commité.

set -euo pipefail

# Se placer dans le dossier du script (racine .claude/commands/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

WEBHOOK_URL="${WEBHOOK_URL:-https://webhook.srv1899780.hstgr.cloud/webhooks/deploy}"

# Résolution du secret : env → .env.local du repo → erreur
if [ -n "${WEBHOOK_SECRET:-}" ]; then
  SECRET="$WEBHOOK_SECRET"
elif [ -f "$REPO_ROOT/.env.local" ] && grep -q '^WEBHOOK_SECRET=' "$REPO_ROOT/.env.local"; then
  SECRET=$(grep '^WEBHOOK_SECRET=' "$REPO_ROOT/.env.local" | head -1 | cut -d= -f2-)
else
  echo "✗ Secret introuvable. Ajoute dans $REPO_ROOT/.env.local :"
  echo "  WEBHOOK_SECRET=<secret fourni par Aramis>"
  exit 1
fi

MESSAGE="${1:-Déploiement demandé par Claude Code}"

BODY=$(python3 -c "import json,sys; print(json.dumps({'message': sys.argv[1]}))" "$MESSAGE")
TIMESTAMP=$(date +%s)
SIGNATURE=$(printf '%s.%s' "$TIMESTAMP" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

RESPONSE=$(curl -s -m 30 -w '\n%{http_code}' \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature-V2: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $TIMESTAMP" \
  -d "$BODY")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY_RESP=$(echo "$RESPONSE" | head -n -1)

echo "→ POST $WEBHOOK_URL"
echo "→ HTTP $HTTP_CODE : $BODY_RESP"

if [ "$HTTP_CODE" = "202" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "✓ Demande de déploiement envoyée à Aramis (Hermes)."
  echo "  Le résultat arrivera sur Telegram (canal Brief)."
else
  echo "✗ Échec de l'envoi (HTTP $HTTP_CODE)."
  exit 1
fi
