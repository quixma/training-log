import os
import sqlite3
import tempfile

import pytest

from config import Config


def _live_schema():
    #replaying the real schema keeps tests in step with the database the app runs
    #against, with no second copy of the DDL to drift. sqlite_% is excluded because
    #sqlite_sequence is created implicitly by AUTOINCREMENT and cannot be created by hand
    conn = sqlite3.connect("file:" + Config.DB_PATH + "?mode=ro", uri=True)
    try:
        return [row[0] for row in conn.execute(
            "select sql from sqlite_master where sql is not null and name not like 'sqlite_%'")]
    finally:
        conn.close()


@pytest.fixture
def db(monkeypatch):
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    conn = sqlite3.connect(path)
    for statement in _live_schema():
        conn.execute(statement)
    conn.commit()
    conn.close()

    #get_db_connection() reads Config.DB_PATH at call time, so this redirects every query
    monkeypatch.setattr(Config, "DB_PATH", path)
    yield path
    os.unlink(path)


@pytest.fixture
def client(db):
    from app import app
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client


@pytest.fixture
def scheduled_workout(db):
    #returns the training_calendar_daily_wkouts.ID, which is what the Today card
    #stamps onto each list item and what a weight log is keyed to
    def _schedule(date="2026-09-17", workout_type="Lift", name="Test Lift"):
        conn = sqlite3.connect(db)
        cursor = conn.cursor()
        session_id = cursor.execute(
            """INSERT INTO training_calendar (workout_date) VALUES (?)
               ON CONFLICT(workout_date) DO UPDATE SET workout_date = excluded.workout_date
               RETURNING ID""", (date,)).fetchone()[0]
        cursor.execute(
            "INSERT INTO training_calendar_daily_wkouts (session_id, workout_type, workout_name) VALUES (?,?,?)",
            (session_id, workout_type, name))
        daily_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return daily_id

    return _schedule
