#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# pre-push.sh — garde-fou avant `git push` sur une branche partagée.
#
# Usage :
#   bash scripts/coord/pre-push.sh                # vérifie la copie locale
#   bash scripts/coord/pre-push.sh --force        # (jamais pour la prod)
#
# Vérifie, dans l'ordre :
#   1. On n'est pas sur une branche de prod (feat/ui-redesign-claude)
#   2. La copie locale a fetché origin (pas de surprise)
#   3. La branche courante n'est pas en retard sur origin
#   4. HANDOFF.md est présent à la racine (le contrat exige une passation)
#
# Sortie : 0 = OK pour pousser, 1 = STOP.
# ---------------------------------------------------------------------------
set -u

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BRANCH="$(git -C "$REPO_DIR" branch --show-current)"
PROD_BRANCHES="feat/ui-redesign-claude feat/task-completion main"

cd "$REPO_DIR" || exit 1

# 1. Branche de prod
for p in $PROD_BRANCHES; do
  if [[ "$BRANCH" == "$p" ]]; then
    echo "❌ STOP : tu es sur « $BRANCH » (branche de production)."
    echo "   Crée une branche de travail (git checkout -b feat/... ) puis pousse celle-là."
    exit 1
  fi
done

# 2. Fetch (silencieux)
if ! git fetch origin --prune --quiet 2>/dev/null; then
  echo "⚠️  fetch origin impossible — réseau ? Vérifie avant de pousser."
  exit 1
fi

# 3. Retard par rapport à origin
ORIGIN_BRANCH="origin/$BRANCH"
if git rev-parse --verify "$ORIGIN_BRANCH" >/dev/null 2>&1; then
  BEHIND="$(git rev-list --count "$ORIGIN_BRANCH..HEAD" 2>/dev/null || echo 0)"
  AHEAD="$(git rev-list --count "HEAD..$ORIGIN_BRANCH" 2>/dev/null || echo 0)"
  if [[ "$BEHIND" -gt 0 ]]; then
    echo "⚠️  Ta branche est en retard de $BEHIND commit(s) sur origin."
    echo "   Fais git merge --ff-only $ORIGIN_BRANCH puis relance."
    exit 1
  fi
  echo "✅ Branche « $BRANCH » : $AHEAD commit(s) à pousser, pas en retard sur origin."
else
  echo "ℹ️  Branche « $BRANCH » nouvelle (pas encore sur origin) — OK."
fi

# 4. HANDOFF.md à la racine
if [[ ! -f "HANDOFF.md" ]]; then
  echo "❌ HANDOFF.md n'existe pas à la racine."
  echo "   Écris la passation en cours AVANT de pousser (voir docs/coordination.md)."
  exit 1
fi

echo "✅ Tout est bon : tu peux pousser $BRANCH."
exit 0
