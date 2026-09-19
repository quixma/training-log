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


from app.models import save_weight_log


def _completed_flag(db, daily_workout_id):
    conn = sqlite3.connect(db)
    flag = conn.execute("select completed from training_calendar_daily_wkouts where ID = ?",
                        (daily_workout_id,)).fetchone()[0]
    conn.close()
    return flag


def test_save_writes_the_log_and_its_exercises(db, scheduled_workout):
    daily_id = scheduled_workout(date="2026-09-17", name="Upper A")

    save_weight_log(daily_id,
                    {"date_completed": "2026-09-17", "workout_name": "Upper A", "workout_type": "Lift"},
                    [{"ex_block": "A", "ex_name": "Bench", "sets_reps_rx": "3x5",
                      "sets_reps_done": "3x5", "weight_value": 185.0, "weight_note": None}])

    log = get_weight_log(daily_id)
    assert log["workout_name"] == "Upper A"
    assert log["exercises"][0]["weight_value"] == 185.0
    assert log["exercises"][0]["sets_reps_rx"] == "3x5"


def test_save_marks_the_calendar_row_completed(db, scheduled_workout):
    daily_id = scheduled_workout()
    assert _completed_flag(db, daily_id) == 0

    save_weight_log(daily_id,
                    {"date_completed": "2026-09-17", "workout_name": "Test Lift", "workout_type": "Lift"},
                    [{"ex_name": "Bench", "weight_value": 185.0}])

    assert _completed_flag(db, daily_id) == 1


def test_saving_twice_updates_rather_than_duplicates(db, scheduled_workout):
    daily_id = scheduled_workout()
    log = {"date_completed": "2026-09-17", "workout_name": "Test Lift", "workout_type": "Lift"}

    first = save_weight_log(daily_id, log, [{"ex_name": "Bench", "weight_value": 185.0}])
    second = save_weight_log(daily_id, log, [{"ex_name": "Bench", "weight_value": 190.0}])

    assert first == second
    conn = sqlite3.connect(db)
    assert conn.execute("select count(*) from workout_weight_log").fetchone()[0] == 1
    assert conn.execute("select count(*) from workout_weight_log_ex").fetchone()[0] == 1
    conn.close()
    assert get_weight_log(daily_id)["exercises"][0]["weight_value"] == 190.0


def test_resaving_with_fewer_exercises_drops_the_old_rows(db, scheduled_workout):
    daily_id = scheduled_workout()
    log = {"date_completed": "2026-09-17", "workout_name": "Test Lift", "workout_type": "Lift"}

    save_weight_log(daily_id, log, [{"ex_name": "Bench"}, {"ex_name": "Row"}, {"ex_name": "Curl"}])
    save_weight_log(daily_id, log, [{"ex_name": "Bench"}])

    assert [ex["ex_name"] for ex in get_weight_log(daily_id)["exercises"]] == ["Bench"]


def test_deleting_the_calendar_row_keeps_the_log(db, scheduled_workout):
    daily_id = scheduled_workout()
    save_weight_log(daily_id,
                    {"date_completed": "2026-09-17", "workout_name": "Test Lift", "workout_type": "Lift"},
                    [{"ex_name": "Bench", "weight_value": 185.0}])

    conn = sqlite3.connect(db)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("delete from training_calendar_daily_wkouts where ID = ?", (daily_id,))
    conn.commit()
    row = conn.execute("select daily_workout_id, workout_name from workout_weight_log").fetchone()
    conn.close()

    #SET NULL, not CASCADE: a mis-staged calendar delete must not destroy training history
    assert row[0] is None
    assert row[1] == "Test Lift"


def test_unticking_completed_does_not_delete_the_log(db, scheduled_workout):
    daily_id = scheduled_workout()
    save_weight_log(daily_id,
                    {"date_completed": "2026-09-17", "workout_name": "Test Lift", "workout_type": "Lift"},
                    [{"ex_name": "Bench", "weight_value": 185.0}])

    #the calendar's save path only writes the flag; entered data must survive a stray click
    conn = sqlite3.connect(db)
    conn.execute("update training_calendar_daily_wkouts set completed = 0 where ID = ?", (daily_id,))
    conn.commit()
    conn.close()

    assert get_weight_log(daily_id)["exercises"][0]["weight_value"] == 185.0
