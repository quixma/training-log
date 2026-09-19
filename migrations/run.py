"""Apply a .sql migration to the configured database.

Usage: myenv/bin/python migrations/run.py migrations/2026-09-18-weight-log.sql
"""
import sqlite3
import sys

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
