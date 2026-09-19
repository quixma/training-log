import sqlite3


def _seed_throwing_day(db, name="Plyo Day", date="2026-09-17"):
    conn = sqlite3.connect(db)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO throwing_days (date, day_name, session_type, notes) VALUES (?,?,?,?)",
                   (date, name, "recovery", "Felt good."))
    day_id = cursor.lastrowid
    #the column is drill_type; get_throwing_day_by_name maps it to the "set" key the view reads
    cursor.execute("""INSERT INTO throwing_day_drills
                      (session_id, drill_type, drill_name, ball_weight, throw_count, drill_notes)
                      VALUES (?,?,?,?,?,?)""",
                   (day_id, "plyo", "Pivot Pickoff", "450g", "5-8", "easy"))
    conn.commit()
    conn.close()


def _seed_warmup(db, name="Standard Warmup"):
    conn = sqlite3.connect(db)
    conn.execute("INSERT INTO warmups (date, name, rollout_ex, notes) VALUES (?,?,?,?)",
                 ("2026-09-01", name, "Quad roll", "10 min"))
    conn.commit()
    conn.close()


def test_throwing_day_resolves_by_name(client, db):
    _seed_throwing_day(db, name="Plyo Day")

    response = client.post("/api/getSelectedWorkout", json={"type": "Throwing", "value": "Plyo Day"})

    assert response.status_code == 200
    body = response.get_json()
    assert body["day_name"] == "Plyo Day"
    assert body["drills"][0]["drill_name"] == "Pivot Pickoff"


def test_warmup_resolves_in_the_casing_the_calendar_stores(client, db):
    _seed_warmup(db, name="Standard Warmup")

    #the calendar stores "Warmup"; the route previously only matched "warmup"
    response = client.post("/api/getSelectedWorkout", json={"type": "Warmup", "value": "Standard Warmup"})

    assert response.status_code == 200
    assert response.get_json()["name"] == "Standard Warmup"


def test_lowercase_warmup_still_works(client, db):
    _seed_warmup(db, name="Standard Warmup")

    assert client.post("/api/getSelectedWorkout",
                       json={"type": "warmup", "value": "Standard Warmup"}).status_code == 200


def test_an_unknown_throwing_day_is_a_404(client, db):
    assert client.post("/api/getSelectedWorkout",
                       json={"type": "Throwing", "value": "Nope"}).status_code == 404
