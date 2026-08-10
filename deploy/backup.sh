#!/bin/sh
# ---------------------------------------------------------------------------
# Sauvegarde des données de Brief.
#
# Le volume Docker est l'UNIQUE copie de ton organisation : contrairement à une
# synchronisation CalDAV, aucun téléphone n'en détient de réplique. Une perte de
# disque est définitive.
#
#   0 3 * * *  /opt/brief/deploy/backup.sh >> /var/log/brief-backup.log 2>&1
#
# ⚠️ Une sauvegarde jamais restaurée n'est pas une sauvegarde. Teste-la :
#   tar -tzf <archive>   puis restaure dans un volume jetable.
# ---------------------------------------------------------------------------
set -eu

DEST="${BRIEF_BACKUP_DIR:-/var/backups/brief}"
KEEP_DAYS="${BRIEF_BACKUP_KEEP_DAYS:-30}"
VOLUME="${BRIEF_VOLUME:-brief_brief-data}"
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$DEST"

docker run --rm \
  -v "$VOLUME":/data:ro \
  -v "$DEST":/backup \
  alpine:3.20 \
  tar -czf "/backup/brief-$STAMP.tar.gz" -C /data .

# On vérifie l'archive tout de suite : une archive corrompue découverte le jour
# de la restauration ne sert à rien.
if ! tar -tzf "$DEST/brief-$STAMP.tar.gz" >/dev/null 2>&1; then
  echo "[backup] ARCHIVE ILLISIBLE : $DEST/brief-$STAMP.tar.gz" >&2
  exit 1
fi

SIZE=$(du -h "$DEST/brief-$STAMP.tar.gz" | cut -f1)
echo "[backup] ok $STAMP ($SIZE)"

find "$DEST" -name 'brief-*.tar.gz' -type f -mtime "+$KEEP_DAYS" -delete
