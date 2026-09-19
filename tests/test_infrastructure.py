import sqlite3


def test_db_fixture_has_schema_but_no_data(db):
    conn = sqlite3.connect(db)
    tables = {row[0] for row in conn.execute("select name from sqlite_master where type='table'")}
    assert "training_calendar" in tables
    assert conn.execute("select count(*) from training_calendar").fetchone()[0] == 0
    conn.close()


def test_app_queries_hit_the_temp_db(db):
    from app.models import get_db_connection
    conn = get_db_connection()
    conn.execute("insert into training_calendar (workout_date) values ('2026-01-01')")
    conn.commit()
    assert conn.execute("select count(*) from training_calendar").fetchone()[0] == 1
    conn.close()


def test_scheduled_workout_returns_a_daily_workout_id(scheduled_workout, db):
    daily_id = scheduled_workout(date="2026-09-17", workout_type="Lift", name="Upper A")
    conn = sqlite3.connect(db)
    row = conn.execute(
        "select workout_name, completed from training_calendar_daily_wkouts where ID = ?",
        (daily_id,)).fetchone()
    conn.close()
    assert row[0] == "Upper A"
    assert row[1] == 0


def test_client_serves_the_calendar(client):
    assert client.get("/training_calendar").status_code == 200
