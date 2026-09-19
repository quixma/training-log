import sqlite3

from app.models import get_previous_weight_log, get_weight_log


def _insert_log(db, daily_workout_id, date, name, exercises, workout_type="Lift"):
    conn = sqlite3.connect(db)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO workout_weight_log (daily_workout_id, date_completed, workout_name, workout_type) VALUES (?,?,?,?)",
        (daily_workout_id, date, name, workout_type))
    log_id = cursor.lastrowid
    for order, ex in enumerate(exercises):
        cursor.execute(
            """INSERT INTO workout_weight_log_ex
               (log_id, ex_order, ex_block, ex_name, sets_reps_rx, sets_reps_done, weight_value, weight_note)
               VALUES (?,?,?,?,?,?,?,?)""",
            (log_id, order, ex.get("ex_block"), ex.get("ex_name"), ex.get("sets_reps_rx"),
             ex.get("sets_reps_done"), ex.get("weight_value"), ex.get("weight_note")))
    conn.commit()
    conn.close()
    return log_id


def test_returns_none_when_nothing_logged(db, scheduled_workout):
    assert get_weight_log(scheduled_workout()) is None


def test_returns_the_log_with_its_exercises(db, scheduled_workout):
    daily_id = scheduled_workout(date="2026-09-17", name="Upper A")
    _insert_log(db, daily_id, "2026-09-17", "Upper A", [
        {"ex_name": "Bench", "sets_reps_done": "3x5", "weight_value": 185.0},
        {"ex_name": "Pull-up", "sets_reps_done": "3x8", "weight_note": "bw+25"},
    ])

    log = get_weight_log(daily_id)

    assert log["date_completed"] == "2026-09-17"
    assert log["workout_name"] == "Upper A"
    assert [ex["ex_name"] for ex in log["exercises"]] == ["Bench", "Pull-up"]
    assert log["exercises"][0]["weight_value"] == 185.0
    assert log["exercises"][1]["weight_note"] == "bw+25"


def test_exercises_come_back_in_stored_order(db, scheduled_workout):
    daily_id = scheduled_workout()
    _insert_log(db, daily_id, "2026-09-17", "Upper A",
                [{"ex_name": "C"}, {"ex_name": "A"}, {"ex_name": "B"}])

    assert [ex["ex_name"] for ex in get_weight_log(daily_id)["exercises"]] == ["C", "A", "B"]


def test_previous_log_finds_the_most_recent_before_the_date(db, scheduled_workout):
    old = scheduled_workout(date="2026-09-01", name="Upper A")
    mid = scheduled_workout(date="2026-09-08", name="Upper A")
    _insert_log(db, old, "2026-09-01", "Upper A", [{"ex_name": "Bench", "weight_value": 175.0}])
    _insert_log(db, mid, "2026-09-08", "Upper A", [{"ex_name": "Bench", "weight_value": 180.0}])

    previous = get_previous_weight_log("Upper A", "2026-09-15")

    assert previous["date_completed"] == "2026-09-08"
    assert previous["exercises"][0]["weight_value"] == 180.0


def test_previous_log_excludes_the_date_itself(db, scheduled_workout):
    daily_id = scheduled_workout(date="2026-09-15", name="Upper A")
    _insert_log(db, daily_id, "2026-09-15", "Upper A", [{"ex_name": "Bench"}])

    assert get_previous_weight_log("Upper A", "2026-09-15") is None


def test_previous_log_is_scoped_to_the_workout_name(db, scheduled_workout):
    daily_id = scheduled_workout(date="2026-09-08", name="Lower A")
    _insert_log(db, daily_id, "2026-09-08", "Lower A", [{"ex_name": "Squat"}])

    assert get_previous_weight_log("Upper A", "2026-09-15") is None
