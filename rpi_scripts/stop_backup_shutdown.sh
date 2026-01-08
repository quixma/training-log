#!/bin/bash

DB_SRC="/home/quixma/training-log/training_log.db"
BACKUP_DIR="/home/quixma/training-log/backup"
TIMESTAMP=$(date +"%Y-%m-%d")
DB_DEST="$BACKUP_DIR/db_$TIMESTAMP.db"

echo "Stopping web app..."
systemctl stop traininglog.service

echo "Backing up db files..."
mkdir -p $BACKUP_DIR
cp "$DB_SRC" "$DB_DEST"

echo "Backup Complete: $DB_DEST"

echo "Shutting down..."
shutdown -h now
