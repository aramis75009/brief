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
# 2026-08-29 · Grand ménage : la branche de prod n'est PLUS hardcodée.
# Elle est découverte dynamiquement depuis le VPS (qui lit sa propre
# branche via git). Avant, status.sh comparait avec origin/feat/ui-redesign-claude
# — branche absorbée dans main le 26/08 et supprimée d'origin — ce qui produisait
# un écart de prod PERMANENT (origin=? → toujours "écart"). Maintenant la référence
# est: la branche prod actuelle est celle qui est sur /docker/brief.
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
if git -C "$REPO_DIR" fetch origin --prune --quiet 2>/dev/null; then
  echo "   origin/main : $(git -C "$REPO_DIR" rev-parse --short origin/main 2>/dev/null || echo '?')"
else
  echo "   (fetch impossible — réseau ?)"
fi

echo
echo "2. Copie locale ($REPO_DIR)"
echo "   branche : $(branch "$REPO_DIR")"
echo "   HEAD    : $(short "$REPO_DIR")"

echo
echo "3. Production (VPS /docker/brief)"
VPS_BRANCH=""
VPS_HEAD="?"
if [[ -d "$VPS_DIR/.git" ]]; then
  VPS_BRANCH="$(branch "$VPS_DIR")"
  VPS_HEAD="$(short "$VPS_DIR")"
  echo "   branche : $VPS_BRANCH"
  echo "   HEAD    : $VPS_HEAD"
elif command -v ssh >/dev/null 2>&1; then
  # Copie de travail dans un conteneur (Hermes) : la prod est sur la machine
  # hôte, jointe par SSH. Clé : /opt/data/home/.ssh/id_ed25519 (HOME=/opt/data/home).
  VPS_SSH_OUT="$(HOME=/opt/data/home ssh -i /opt/data/home/.ssh/id_ed25519 \
    -o ConnectTimeout=8 -o StrictHostKeyChecking=no -o BatchMode=yes \
    root@186.241.16.37 "cd /docker/brief && echo \$(git branch --show-current) \$(git rev-parse --short HEAD)" 2>/dev/null)"
  if [[ -n "$VPS_SSH_OUT" ]]; then
    VPS_BRANCH="${VPS_SSH_OUT% *}"
    VPS_HEAD="${VPS_SSH_OUT##* }"
    echo "   branche : $VPS_BRANCH"
    echo "   HEAD    : $VPS_HEAD"
  else
    echo "   ⚠️  injoignable (pas de repo local, SSH hôte impossible — Mac ?)"
  fi
else
  echo "   ⚠️  injoignable (pas de repo à cet emplacement — Mac ?)"
fi

echo
# Alignement — la référence est la branche de prod DÉTECTÉE sur le VPS.
# Comparaison sur les SHA COMPLETS (pas les versions courtes) pour éviter
# un faux « écart » causé par la différence de longueur (7 vs 8 chars).
LOCAL_FULL="$(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null || echo '')"
LOCAL="$(short "$REPO_DIR")"
ORIGIN_MAIN_FULL="$(git -C "$REPO_DIR" rev-parse origin/main 2>/dev/null || echo '')"
ORIGIN_MAIN="$(git -C "$REPO_DIR" rev-parse --short origin/main 2>/dev/null || echo '?')"
VPS_HEAD_FULL=""
ORIGIN_VPS_BRANCH_FULL=""
if [[ -n "$VPS_HEAD" && "$VPS_HEAD" != "?" ]]; then
  VPS_HEAD_FULL="$(git -C "$REPO_DIR" rev-parse "$VPS_HEAD" 2>/dev/null || echo '')"
fi
if [[ -n "$VPS_BRANCH" && "$VPS_BRANCH" != "?" ]]; then
  ORIGIN_VPS_BRANCH="$(git -C "$REPO_DIR" rev-parse --short "origin/$VPS_BRANCH" 2>/dev/null || echo '?')"
  ORIGIN_VPS_BRANCH_FULL="$(git -C "$REPO_DIR" rev-parse "origin/$VPS_BRANCH" 2>/dev/null || echo '')"
fi

echo "── Diagnostic ──"
if [[ -z "$VPS_BRANCH" || "$VPS_BRANCH" == "?" ]]; then
  echo "⚠️  Prod injoignable — impossible de conclure."
elif [[ -z "$ORIGIN_VPS_BRANCH_FULL" ]]; then
  echo "⚠️  La prod tourne sur '$VPS_BRANCH' qui n'existe PAS sur origin."
  echo "    Pousse-la ou rebascule la prod sur une branche existante."
elif [[ -n "$VPS_HEAD_FULL" && "$VPS_HEAD_FULL" == "$ORIGIN_VPS_BRANCH_FULL" ]]; then
  echo "✅ Prod alignée avec GitHub ($VPS_BRANCH @ $VPS_HEAD)"
else
  echo "⚠️  Écart de prod : VPS=$VPS_HEAD / origin/$VPS_BRANCH=$ORIGIN_VPS_BRANCH — un déploiement est nécessaire"
fi

if [[ -n "$LOCAL_FULL" && "$LOCAL_FULL" == "$VPS_HEAD_FULL" ]]; then
  echo "✅ Copie locale alignée avec la prod"
else
  echo "⚠️  Ta copie ($LOCAL) diffère de la prod ($VPS_HEAD) — fast-forward ou rebase avant de coder"
fi

if [[ -n "$ORIGIN_MAIN_FULL" && -n "$VPS_HEAD_FULL" && "$ORIGIN_MAIN_FULL" != "$VPS_HEAD_FULL" ]]; then
  echo "ℹ️  main ($ORIGIN_MAIN) diffère de la prod ($VPS_HEAD) — merge prévu ?"
fi
echo
echo "── Rappel ──"
echo "   Ne code JAMAIS directement sur la branche de prod sans passation."
echo "   Lis docs/coordination.md avant de commencer."
