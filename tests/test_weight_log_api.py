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


def test_an_unknown_scheduled_workout_is_rejected(client, db):
    #not scheduled_workout() — this id deliberately has no calendar row
    response = client.post("/api/saveWeightLog", json=_payload(9999, [
        {"ex_name": "Bench", "sets_reps_done": "3x5", "weight_value": 185}]))

    assert response.status_code == 404
    conn = sqlite3.connect(db)
    assert conn.execute("select count(*) from workout_weight_log").fetchone()[0] == 0
    conn.close()


def test_a_non_dict_exercise_entry_is_rejected(client, scheduled_workout):
    daily_id = scheduled_workout()
    payload = _payload(daily_id, ["not an object"])

    assert client.post("/api/saveWeightLog", json=payload).status_code == 400


def test_validation_errors_are_not_masked_by_the_blank_guard(client, scheduled_workout):
    daily_id = scheduled_workout()
    payload = _payload(daily_id, [{"ex_name": "Bench", "sets_reps_done": "", "weight_value": None}])
    payload["workout_type"] = "Throwing"

    response = client.post("/api/saveWeightLog", json=payload)

    #blank AND invalid: the real problem must surface, not the blank-row message
    assert response.status_code == 400
    assert "at least one exercise" not in response.get_data(as_text=True)


def _seed_definition(db, workout_type, name, exercises):
    #the workout definition the calendar row points at by name
    conn = sqlite3.connect(db)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO workouts (date, workout_type, workout_name) VALUES (?,?,?)",
                   ("2026-09-01", workout_type, name))
    workout_id = cursor.lastrowid
    for block, ex_name, sets_reps in exercises:
        cursor.execute("INSERT INTO workout_ex (session_id, ex_block, ex_name, sets_reps) VALUES (?,?,?,?)",
                       (workout_id, block, ex_name, sets_reps))
    conn.commit()
    conn.close()


def test_unlogged_workout_returns_its_definition_exercises(client, scheduled_workout, db):
    _seed_definition(db, "Lift", "Upper A", [("A", "Bench", "3x5"), ("B", "Row", "3x10")])
    daily_id = scheduled_workout(date="2026-09-17", name="Upper A")

    body = client.post("/api/getWeightLog", json={
        "daily_workout_id": daily_id, "date": "2026-09-17",
        "workout_type": "Lift", "workout_name": "Upper A"}).get_json()

    assert body["logged"] is False
    assert [ex["ex_name"] for ex in body["exercises"]] == ["Bench", "Row"]
    assert body["exercises"][0]["sets_reps_rx"] == "3x5"
    assert body["exercises"][0]["weight_value"] is None


def test_an_existing_log_comes_back_as_values(client, scheduled_workout):
    daily_id = scheduled_workout(date="2026-09-17", name="Upper A")
    client.post("/api/saveWeightLog", json=_payload(daily_id, [
        {"ex_name": "Bench", "sets_reps_done": "3x5", "weight_value": 185}], name="Upper A"))

    body = client.post("/api/getWeightLog", json={
        "daily_workout_id": daily_id, "date": "2026-09-17",
        "workout_type": "Lift", "workout_name": "Upper A"}).get_json()

    assert body["logged"] is True
    assert body["prefilled_from"] is None
    assert body["exercises"][0]["weight_value"] == 185.0
    assert body["exercises"][0]["placeholder"] is None


def test_a_previous_log_becomes_placeholders_not_values(client, scheduled_workout, db):
    _seed_definition(db, "Lift", "Upper A", [("A", "Bench", "3x5")])
    last_week = scheduled_workout(date="2026-09-10", name="Upper A")
    client.post("/api/saveWeightLog", json=_payload(last_week, [
        {"ex_name": "Bench", "sets_reps_done": "3x5", "weight_value": 180}],
        date="2026-09-10", name="Upper A"))

    today = scheduled_workout(date="2026-09-17", name="Upper A")
    body = client.post("/api/getWeightLog", json={
        "daily_workout_id": today, "date": "2026-09-17",
        "workout_type": "Lift", "workout_name": "Upper A"}).get_json()

    assert body["logged"] is False
    assert body["prefilled_from"] == "2026-09-10"
    #placeholders only: saving untouched must record nothing, not last week's numbers
    assert body["exercises"][0]["weight_value"] is None
    assert body["exercises"][0]["placeholder"]["weight_value"] == 180.0


def test_an_unknown_workout_name_returns_one_blank_row(client, scheduled_workout):
    daily_id = scheduled_workout(date="2026-09-17", name="Typed By Hand")

    body = client.post("/api/getWeightLog", json={
        "daily_workout_id": daily_id, "date": "2026-09-17",
        "workout_type": "Lift", "workout_name": "Typed By Hand"}).get_json()

    assert body["logged"] is False
    assert len(body["exercises"]) == 1
    assert body["exercises"][0]["ex_name"] is None
