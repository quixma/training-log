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


def test_repeated_exercise_names_get_their_own_placeholders(client, scheduled_workout, db):
    _seed_definition(db, "Lift", "Upper A", [("A", "Bench", "1x5"), ("B", "Bench", "3x5")])
    last_week = scheduled_workout(date="2026-09-10", name="Upper A")
    client.post("/api/saveWeightLog", json=_payload(last_week, [
        {"ex_name": "Bench", "sets_reps_done": "1x5", "weight_value": 135},
        {"ex_name": "Bench", "sets_reps_done": "3x5", "weight_value": 185},
    ], date="2026-09-10", name="Upper A"))

    today = scheduled_workout(date="2026-09-17", name="Upper A")
    body = client.post("/api/getWeightLog", json={
        "daily_workout_id": today, "date": "2026-09-17",
        "workout_type": "Lift", "workout_name": "Upper A"}).get_json()

    #the warm-up row must not inherit the working set's number
    assert body["exercises"][0]["placeholder"]["weight_value"] == 135.0
    assert body["exercises"][1]["placeholder"]["weight_value"] == 185.0


def test_reopening_a_partial_log_restores_the_rest_of_the_definition(client, scheduled_workout, db):
    _seed_definition(db, "Lift", "Upper A",
                      [("A", "Bench", "3x5"), ("B", "Row", "3x10"), ("C", "Curl", "3x12")])
    daily_id = scheduled_workout(date="2026-09-17", name="Upper A")
    #only the middle exercise was logged: the append must not shuffle it to the front
    client.post("/api/saveWeightLog", json=_payload(daily_id, [
        {"ex_name": "Row", "sets_reps_done": "3x10", "weight_value": 95},
    ], name="Upper A"))

    body = client.post("/api/getWeightLog", json={
        "daily_workout_id": daily_id, "date": "2026-09-17",
        "workout_type": "Lift", "workout_name": "Upper A"}).get_json()

    assert body["logged"] is True
    assert [ex["ex_name"] for ex in body["exercises"]] == ["Bench", "Row", "Curl"]

    bench, row, curl = body["exercises"]
    #the logged one keeps its stored value
    assert row["weight_value"] == 95.0
    #the untouched ones come back blank, not missing, carrying the definition's rx
    assert bench["weight_value"] is None
    assert bench["sets_reps_done"] is None
    assert bench["sets_reps_rx"] == "3x5"
    assert curl["weight_value"] is None
    assert curl["sets_reps_rx"] == "3x12"
    #placeholders are a different mechanism (previous-log numbers); an existing log
    #never attaches them
    assert bench["placeholder"] is None
    assert curl["placeholder"] is None


def test_resaving_a_reopened_partial_log_adds_nothing_for_the_blank_rows(client, scheduled_workout, db):
    _seed_definition(db, "Lift", "Upper A",
                      [("A", "Bench", "3x5"), ("B", "Row", "3x10"), ("C", "Curl", "3x12")])
    daily_id = scheduled_workout(date="2026-09-17", name="Upper A")
    client.post("/api/saveWeightLog", json=_payload(daily_id, [
        {"ex_name": "Row", "sets_reps_done": "3x10", "weight_value": 95},
    ], name="Upper A"))

    reopened = client.post("/api/getWeightLog", json={
        "daily_workout_id": daily_id, "date": "2026-09-17",
        "workout_type": "Lift", "workout_name": "Upper A"}).get_json()

    #re-save exactly what the modal would submit: reopened rows, blanks untouched
    client.post("/api/saveWeightLog", json=_payload(daily_id, reopened["exercises"], name="Upper A"))

    conn = sqlite3.connect(db)
    names = [r[0] for r in conn.execute("select ex_name from workout_weight_log_ex")]
    conn.close()
    assert names == ["Row"]


def test_a_nameless_row_never_inherits_a_placeholder(client, scheduled_workout):
    last_week = scheduled_workout(date="2026-09-10", name="Typed By Hand")
    client.post("/api/saveWeightLog", json=_payload(last_week, [
        {"ex_name": "Bench", "sets_reps_done": "3x5", "weight_value": 185},
        #the previous log itself has a nameless entry, so by_name has a real [None] bucket.
        #without the guard, today's nameless row would hit it — a by_name.get(None) miss
        #alone would prove nothing
        {"ex_name": None, "sets_reps_done": "1x1", "weight_value": 1},
    ], date="2026-09-10", name="Typed By Hand"))

    today = scheduled_workout(date="2026-09-17", name="Typed By Hand")
    body = client.post("/api/getWeightLog", json={
        "daily_workout_id": today, "date": "2026-09-17",
        "workout_type": "Lift", "workout_name": "Typed By Hand"}).get_json()

    #no definition for that name, so one blank row — and a nameless row matches nothing,
    #even though the previous log has a nameless entry sitting in by_name[None]
    assert len(body["exercises"]) == 1
    assert body["exercises"][0]["placeholder"] is None
