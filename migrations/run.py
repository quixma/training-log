"""Apply a .sql migration to the configured database.

Usage: myenv/bin/python migrations/run.py migrations/2026-09-18-weight-log.sql
"""
import os
import sqlite3
import sys

#python puts this script's directory on sys.path, not the repo root, so the bare
#documented invocation cannot see config.py without this
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import Config


def main(path):
    with open(path, encoding="utf-8") as handle:
        script = handle.read()

    conn = sqlite3.connect(Config.DB_PATH)
    conn.executescript(script)
    conn.commit()
    conn.close()
    print("applied " + path + " to " + Config.DB_PATH)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: run.py <migration.sql>")
    main(sys.argv[1])
