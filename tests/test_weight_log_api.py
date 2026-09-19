import sqlite3


def _payload(daily_workout_id, exercises, date="2026-09-17", name="Test Lift"):
    return {
        "daily_workout_id": daily_workout_id,
        "date_completed": date,
        "workout_name": name,
        "workout_type": "Lift",
        "exercises": exercises,
        }


def test_saves_a_log(client, scheduled_workout):
    daily_id = scheduled_workout()

    response = client.post("/api/saveWeightLog", json=_payload(daily_id, [
        {"ex_name": "Bench", "sets_reps_done": "3x5", "weight_value": 185, "weight_note": ""},
    ]))

    assert response.status_code == 200
    assert response.get_json()["status"] == "log saved"


def test_blank_rows_are_dropped(client, scheduled_workout, db):
    daily_id = scheduled_workout()

    client.post("/api/saveWeightLog", json=_payload(daily_id, [
        {"ex_name": "Bench", "sets_reps_done": "3x5", "weight_value": 185, "weight_note": ""},
        {"ex_name": "Row", "sets_reps_done": "", "weight_value": None, "weight_note": ""},
    ]))

    conn = sqlite3.connect(db)
    names = [r[0] for r in conn.execute("select ex_name from workout_weight_log_ex")]
    conn.close()
    assert names == ["Bench"]


def test_an_all_blank_log_is_rejected(client, scheduled_workout, db):
    daily_id = scheduled_workout()

    response = client.post("/api/saveWeightLog", json=_payload(daily_id, [
        {"ex_name": "Bench", "sets_reps_done": "", "weight_value": None, "weight_note": ""},
    ]))

    assert response.status_code == 400
    conn = sqlite3.connect(db)
    assert conn.execute("select count(*) from workout_weight_log").fetchone()[0] == 0
    conn.close()


def test_a_non_numeric_weight_is_rejected(client, scheduled_workout):
    daily_id = scheduled_workout()

    response = client.post("/api/saveWeightLog", json=_payload(daily_id, [
        {"ex_name": "Bench", "sets_reps_done": "3x5", "weight_value": "bw+25", "weight_note": ""},
    ]))

    #a weight typed into the wrong field is caught at entry, not discovered missing later
    assert response.status_code == 400


def test_an_empty_weight_string_becomes_null(client, scheduled_workout, db):
    daily_id = scheduled_workout()

    response = client.post("/api/saveWeightLog", json=_payload(daily_id, [
        {"ex_name": "Pull-up", "sets_reps_done": "3x8", "weight_value": "", "weight_note": "bw+25"},
    ]))

    assert response.status_code == 200
    conn = sqlite3.connect(db)
    row = conn.execute("select weight_value, weight_note from workout_weight_log_ex").fetchone()
    conn.close()
    assert row[0] is None
    assert row[1] == "bw+25"


def test_an_unknown_workout_type_is_rejected(client, scheduled_workout):
    daily_id = scheduled_workout()
    payload = _payload(daily_id, [{"ex_name": "Bench", "weight_value": 185}])
    payload["workout_type"] = "Throwing"

    assert client.post("/api/saveWeightLog", json=payload).status_code == 400
