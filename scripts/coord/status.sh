#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# status.sh — compare les copies du dépôt Brief (GitHub / locale / prod VPS).
#
# Usage : bash scripts/coord/status.sh
#   Sortie stable et lisible par un agent : chaque copie → branche + commit.
#   Les copies inaccessibles sont marquées "injoignable" (ex. depuis le Mac
#   d'Aramis, /docker/brief n'existe pas).
#
# Règle : si la prod est en avance sur ta copie, fast-forward AVANT de coder.
# ---------------------------------------------------------------------------
set -u

VPS_DIR="/docker/brief"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

short() { git -C "$1" rev-parse --short HEAD 2>/dev/null || echo "?"; }
branch() { git -C "$1" branch --show-current 2>/dev/null || echo "?"; }

echo "=== Coordonnées des copies du dépôt — $(date '+%Y-%m-%d %H:%M %Z') ==="
echo

# 1. GitHub (origin) — la vérité centrale
echo "1. GitHub (origin)"
echo "   origin/main                 : $(short "$REPO_DIR") $(git -C "$REPO_DIR" branch -r --contains "$(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null)" 2>/dev/null | head -1 || true)"
if git -C "$REPO_DIR" fetch origin --prune --quiet 2>/dev/null; then
  echo "   origin/feat/ui-redesign-claude : $(git -C "$REPO_DIR" rev-parse --short origin/feat/ui-redesign-claude 2>/dev/null || echo '?')"
else
  echo "   (fetch impossible — réseau ?)"
fi

echo
echo "2. Copie locale ($REPO_DIR)"
echo "   branche : $(branch "$REPO_DIR")"
echo "   HEAD    : $(short "$REPO_DIR")"

echo
echo "3. Production (VPS /docker/brief)"
if [[ -d "$VPS_DIR/.git" ]]; then
  echo "   branche : $(branch "$VPS_DIR")"
  echo "   HEAD    : $(short "$VPS_DIR")"
elif command -v ssh >/dev/null 2>&1; then
  # Copie de travail dans un conteneur (Hermes) : la prod est sur la machine
  # hôte, jointe par SSH. Clé : /opt/data/home/.ssh/id_ed25519 (HOME=/opt/data/home).
  VPS_SSH_OUT="$(HOME=/opt/data/home ssh -i /opt/data/home/.ssh/id_ed25519 \
    -o ConnectTimeout=8 -o StrictHostKeyChecking=no -o BatchMode=yes \
    root@186.241.16.37 "cd /docker/brief && echo \$(git branch --show-current) \$(git rev-parse --short HEAD)" 2>/dev/null)"
  if [[ -n "$VPS_SSH_OUT" ]]; then
    echo "   branche : ${VPS_SSH_OUT% *}"
    echo "   HEAD    : ${VPS_SSH_OUT##* }"
  else
    echo "   ⚠️  injoignable (pas de repo local, SSH hôte impossible — Mac ?)"
  fi
else
  echo "   ⚠️  injoignable (pas de repo à cet emplacement — Mac ?)"
fi

echo
# Alignement
LOCAL="$(short "$REPO_DIR")"
VPS="${VPS_SSH_OUT##* }"
[[ -z "$VPS" || "$VPS" == "$VPS_DIR" ]] && VPS="$(short "$VPS_DIR" 2>/dev/null || echo '?')"
ORIGIN_UI="$(git -C "$REPO_DIR" rev-parse --short origin/feat/ui-redesign-claude 2>/dev/null || echo '?')"

echo "── Diagnostic ──"
if [[ "$VPS" == "$ORIGIN_UI" && "$VPS" != "?" ]]; then
  echo "✅ Prod alignée avec GitHub (feat/ui-redesign-claude @ $VPS)"
else
  echo "⚠️  Écart de prod : VPS=$VPS / origin=$ORIGIN_UI — un déploiement est nécessaire"
fi
if [[ "$LOCAL" == "$VPS" ]]; then
  echo "✅ Copie locale alignée avec la prod"
else
  echo "⚠️  Ta copie ($LOCAL) diffère de la prod ($VPS) — fast-forward ou rebase avant de coder"
fi
echo
echo "── Rappel ──"
echo "   Ne code JAMAIS directement sur la branche de prod sans passation."
echo "   Lis docs/coordination.md avant de commencer."
