# Workout Weight Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log sets/reps and weight actually completed for a scheduled workout by clicking it in the Training Calendar's Today card.

**Architecture:** Each log is keyed to a `training_calendar_daily_wkouts` row — the id already stamped onto every Today-card list item — so no date/name resolution is needed. Exercises are snapshotted as text rather than foreign-keyed, because workout definitions delete and reinsert their exercise rows on every edit. Reads and writes follow the existing `/api/...` + `models.py` + Pydantic pattern used by every other panel in this app.

**Tech Stack:** Flask 3.1, SQLite (stdlib `sqlite3`), Pydantic 2.12, vanilla JS (no framework, no build step), pytest (added by Task 1).

**Spec:** `docs/superpowers/specs/2026-09-18-workout-weight-log-design.md`

## Global Constraints

- Python dependencies are pinned in `requirements.txt`; add pinned versions only.
- No frontend build step, no npm, no framework. Vanilla JS, ES5-compatible function style matching `app/static/js/training_calendar.js`.
- `get_db_connection()` (`app/models.py:7`) reads `Config.DB_PATH` at call time. Never open `sqlite3.connect` directly in app code.
- Every DB row returned to a template or route is a `sqlite3.Row`; convert with `dict(row)` before `jsonify`.
- Comments explain *why*, not *what*, matching the existing codebase. No comment restates the line below it.
- Free-text stored for display gets a `_html` sibling key with `.replace(".", ".<br>")`, rendered `| safe`. Raw text travels alongside for edit prefills.
- The live database is `training_log.db` and is gitignored. Back it up to `backup/` before any schema change.
- `/other_scripts` and `/backup` are gitignored — nothing that must be committed may live there.

---

### Task 1: Test infrastructure

**Files:**
- Modify: `requirements.txt`
- Create: `tests/conftest.py`
- Create: `tests/test_infrastructure.py`

**Interfaces:**
- Consumes: nothing.
- Produces: pytest fixtures `db` (empty database with the real schema, per-test), `client` (Flask test client bound to that database), and `scheduled_workout` (factory inserting a calendar row, returning its `training_calendar_daily_wkouts.ID`). Every later task's tests use these.

The fixture replays the CREATE statements out of the live database into a fresh temp file. This keeps tests in step with the real schema with no second copy of the DDL to drift, and never writes to the real file. `sqlite_%` objects are excluded because `sqlite_sequence` is created implicitly by AUTOINCREMENT and cannot be created by hand.

**Consequence worth knowing:** because the schema comes from the live database, Task 2's migration must be run against `training_log.db` before any test touching the new tables can pass. Task 3 onward will fail with "no such table: workout_weight_log" if Task 2 was skipped.

- [ ] **Step 1: Add pytest to requirements**

```
pytest==8.3.4
```

Append to `requirements.txt`, then install:

```bash
myenv/bin/pip install pytest==8.3.4
```

- [ ] **Step 2: Write the fixtures**

Create `tests/conftest.py`:

```python
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
```

- [ ] **Step 3: Write the failing test**

Create `tests/test_infrastructure.py`:

```python
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
```

- [ ] **Step 4: Run the tests**

Run: `myenv/bin/pytest tests/ -v`
Expected: 4 passed. If `test_app_queries_hit_the_temp_db` fails with a row count above 1, the redirect is not working and the real database is being written to — stop and fix before continuing.

- [ ] **Step 5: Confirm the real database was untouched**

Run: `myenv/bin/python -c "import sqlite3; print(sqlite3.connect('training_log.db').execute('select count(*) from training_calendar').fetchone())"`
Expected: the count that was there before the tests ran (9 at the time of writing), not 10.

- [ ] **Step 6: Commit**

```bash
git add requirements.txt tests/conftest.py tests/test_infrastructure.py
git commit -m "test: add pytest with an isolated per-test database fixture"
```

---

### Task 2: Schema migration

**Files:**
- Create: `migrations/2026-09-18-weight-log.sql`
- Create: `migrations/run.py`

`/other_scripts` is gitignored, so the migration lives in a new committed `migrations/` directory.

**Interfaces:**
- Consumes: nothing.
- Produces: tables `workout_weight_log` and `workout_weight_log_ex` in `training_log.db`. Every later task depends on these existing.

- [ ] **Step 1: Back up the live database**

```bash
cp training_log.db "backup/training_log.db.$(date +%Y%m%d-%H%M%S).bak"
```

- [ ] **Step 2: Write the DDL**

Create `migrations/2026-09-18-weight-log.sql`:

```sql
-- daily_workout_id is nullable with ON DELETE SET NULL rather than NOT NULL with
-- CASCADE: the delete control on a calendar row is a checkbox that is easy to hit,
-- and a mis-staged delete must not destroy training history. An orphaned log stays
-- readable through the denormalised date/name/type. SQLite allows multiple NULLs
-- under UNIQUE, so orphans do not collide with each other.
CREATE TABLE IF NOT EXISTS workout_weight_log (
    "id"               INTEGER NOT NULL,
    "daily_workout_id" INTEGER UNIQUE,
    "date_completed"   date NOT NULL,
    "workout_name"     TEXT,
    "workout_type"     TEXT CHECK("workout_type" IN ('Lift','Armcare','Back/Core',
                                  'Individual Workout','Mobility','Conditioning')),
    PRIMARY KEY("id" AUTOINCREMENT),
    FOREIGN KEY("daily_workout_id")
        REFERENCES "training_calendar_daily_wkouts"("ID") ON DELETE SET NULL
);

-- exercises are snapshotted as text, never foreign-keyed to workout_ex: update_workout()
-- deletes and reinserts every exercise row on each edit, so those ids are not stable.
-- sets_reps_rx records what was prescribed at log time; it cannot be reconstructed later.
CREATE TABLE IF NOT EXISTS workout_weight_log_ex (
    "id"             INTEGER NOT NULL,
    "log_id"         INTEGER NOT NULL,
    "ex_order"       INTEGER NOT NULL,
    "ex_block"       TEXT,
    "ex_name"        TEXT,
    "sets_reps_rx"   TEXT,
    "sets_reps_done" TEXT,
    "weight_value"   REAL,
    "weight_note"    TEXT,
    PRIMARY KEY("id" AUTOINCREMENT),
    FOREIGN KEY("log_id") REFERENCES "workout_weight_log"("id") ON DELETE CASCADE
);
```

- [ ] **Step 3: Write the runner**

Create `migrations/run.py`:

```python
"""Apply a .sql migration to the configured database.

Usage: myenv/bin/python migrations/run.py migrations/2026-09-18-weight-log.sql
"""
import os
import sqlite3
import sys

#python puts this script's directory on sys.path, not the repo root, so the bare
#documented invocation above cannot see config.py without this
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
```

- [ ] **Step 4: Apply it**

Run: `myenv/bin/python migrations/run.py migrations/2026-09-18-weight-log.sql`
Expected: `applied migrations/2026-09-18-weight-log.sql to .../training_log.db`

- [ ] **Step 5: Verify both tables exist with the right columns**

```bash
myenv/bin/python -c "
import sqlite3
c = sqlite3.connect('training_log.db')
for t in ('workout_weight_log','workout_weight_log_ex'):
    print(t, [r[1] for r in c.execute('pragma table_info(%s)' % t)])
"
```

Expected:
```
workout_weight_log ['id', 'daily_workout_id', 'date_completed', 'workout_name', 'workout_type']
workout_weight_log_ex ['id', 'log_id', 'ex_order', 'ex_block', 'ex_name', 'sets_reps_rx', 'sets_reps_done', 'weight_value', 'weight_note']
```

- [ ] **Step 6: Confirm the test fixture now sees them**

Run: `myenv/bin/pytest tests/test_infrastructure.py -v`
Expected: still 4 passed. The fixture replays the live schema, so the new tables are now present in every test database.

- [ ] **Step 7: Commit**

```bash
git add migrations/2026-09-18-weight-log.sql migrations/run.py
git commit -m "feat: add workout_weight_log and workout_weight_log_ex tables"
```

---

### Task 3: Read a weight log

**Files:**
- Modify: `app/models.py` (add after `getCalendarWorkouts()`, near line 750)
- Create: `tests/test_weight_log_models.py`

**Interfaces:**
- Consumes: `db` and `scheduled_workout` fixtures from Task 1.
- Produces:
  - `get_weight_log(daily_workout_id) -> dict | None` — keys `id`, `daily_workout_id`, `date_completed`, `workout_name`, `workout_type`, `exercises` (list of dicts with `ex_block`, `ex_name`, `sets_reps_rx`, `sets_reps_done`, `weight_value`, `weight_note`, ordered by `ex_order`).
  - `get_previous_weight_log(workout_name, before_date) -> dict | None` — same shape, for the most recent log of that name strictly before `before_date`.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_weight_log_models.py`:

```python
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `myenv/bin/pytest tests/test_weight_log_models.py -v`
Expected: collection error — `ImportError: cannot import name 'get_weight_log' from 'app.models'`

- [ ] **Step 3: Implement**

Add to `app/models.py`, after `getCalendarWorkouts()`:

```python
#--------WORKOUT WEIGHT LOG----------
#a log is keyed to the scheduled workout it belongs to, not to the day: one calendar
#day holds several workouts, so training_calendar.ID would not identify which

def _format_weight_log(cursor, log):
    rows = cursor.execute(
        """select ex_block, ex_name, sets_reps_rx, sets_reps_done, weight_value, weight_note
           from workout_weight_log_ex where log_id = ? order by ex_order""", (log["id"],)).fetchall()
    return {
        "id": log["id"],
        "daily_workout_id": log["daily_workout_id"],
        "date_completed": log["date_completed"],
        "workout_name": log["workout_name"],
        "workout_type": log["workout_type"],
        "exercises": [dict(row) for row in rows],
        }

def get_weight_log(daily_workout_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    log = cursor.execute("select * from workout_weight_log where daily_workout_id = ?",
                         (daily_workout_id,)).fetchone()
    if log is None:
        conn.close()
        return None

    formatted = _format_weight_log(cursor, log)
    conn.close()
    return formatted

def get_previous_weight_log(workout_name, before_date):
    #the source for the modal's placeholders: what this same workout was last logged at.
    #strictly before, so reopening a log does not offer that log back to itself
    conn = get_db_connection()
    cursor = conn.cursor()

    log = cursor.execute(
        """select * from workout_weight_log
           where workout_name = ? and date_completed < ?
           order by date_completed desc, id desc limit 1""",
        (workout_name, before_date)).fetchone()
    if log is None:
        conn.close()
        return None

    formatted = _format_weight_log(cursor, log)
    conn.close()
    return formatted
```

- [ ] **Step 4: Run to verify they pass**

Run: `myenv/bin/pytest tests/test_weight_log_models.py -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add app/models.py tests/test_weight_log_models.py
git commit -m "feat: read weight logs and the previous log for a workout"
```

---

### Task 4: Save a weight log

**Files:**
- Modify: `app/models.py` (after `get_previous_weight_log`)
- Modify: `tests/test_weight_log_models.py`

**Interfaces:**
- Consumes: `get_weight_log` from Task 3.
- Produces: `save_weight_log(daily_workout_id, log, exercises) -> int` returning the log id. `log` is a dict with `date_completed`, `workout_name`, `workout_type`. `exercises` is a list of dicts with `ex_block`, `ex_name`, `sets_reps_rx`, `sets_reps_done`, `weight_value`, `weight_note`. Upserts on `daily_workout_id`, replaces child rows wholesale, and sets `completed = 1` on the calendar row.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_weight_log_models.py`:

```python
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
```

```python
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `myenv/bin/pytest tests/test_weight_log_models.py -v`
Expected: collection error — `ImportError: cannot import name 'save_weight_log' from 'app.models'`

- [ ] **Step 3: Implement**

Add to `app/models.py`, after `get_previous_weight_log`:

```python
def save_weight_log(daily_workout_id, log, exercises):
    #one log per scheduled workout, so this upserts rather than appending: clicking a
    #workout opens its log, and "log" and "edit log" are the same operation
    conn = get_db_connection()
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    existing = cursor.execute("select id from workout_weight_log where daily_workout_id = ?",
                              (daily_workout_id,)).fetchone()
    if existing:
        log_id = existing["id"]
        cursor.execute("""UPDATE workout_weight_log
                          SET date_completed = ?, workout_name = ?, workout_type = ?
                          WHERE id = ?""",
                       (log["date_completed"], log["workout_name"], log["workout_type"], log_id))
        #replaced wholesale so stored order matches the modal's order, as update_workout does
        cursor.execute("DELETE FROM workout_weight_log_ex WHERE log_id = ?", (log_id,))
    else:
        cursor.execute("""INSERT INTO workout_weight_log
                          (daily_workout_id, date_completed, workout_name, workout_type)
                          VALUES (?,?,?,?)""",
                       (daily_workout_id, log["date_completed"], log["workout_name"], log["workout_type"]))
        log_id = cursor.lastrowid

    for order, ex in enumerate(exercises):
        cursor.execute("""INSERT INTO workout_weight_log_ex
                          (log_id, ex_order, ex_block, ex_name, sets_reps_rx, sets_reps_done, weight_value, weight_note)
                          VALUES (?,?,?,?,?,?,?,?)""",
                       (log_id, order, ex.get("ex_block"), ex.get("ex_name"), ex.get("sets_reps_rx"),
                        ex.get("sets_reps_done"), ex.get("weight_value"), ex.get("weight_note")))

    #logging what was lifted is itself the record that the workout was done
    cursor.execute("UPDATE training_calendar_daily_wkouts SET completed = 1 WHERE ID = ?",
                   (daily_workout_id,))

    conn.commit()
    conn.close()
    return log_id
```

- [ ] **Step 4: Run to verify they pass**

Run: `myenv/bin/pytest tests/test_weight_log_models.py -v`
Expected: 12 passed

- [ ] **Step 5: Commit**

```bash
git add app/models.py tests/test_weight_log_models.py
git commit -m "feat: upsert weight logs and mark the calendar row completed"
```

---

### Task 5: Validation and the save route

**Files:**
- Modify: `app/input_validation.py` (add after `PlayerGoalsModel`, near line 64)
- Modify: `app/api_calls.py` (add after the `getPlayerGoals` route, near line 480)
- Create: `tests/test_weight_log_api.py`

**Interfaces:**
- Consumes: `save_weight_log` from Task 4.
- Produces: `WeightLogEntry` and `WeightLogModel` in `app/input_validation.py`; `POST /api/saveWeightLog` accepting `{daily_workout_id, date_completed, workout_name, workout_type, exercises: [...]}` and returning `{"status": "log saved", "id": <int>}` on 200.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_weight_log_api.py`:

```python
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `myenv/bin/pytest tests/test_weight_log_api.py -v`
Expected: all 6 fail with 404 (the route does not exist yet)

- [ ] **Step 3: Add the validation models**

Add to `app/input_validation.py`, after `PlayerGoalsModel`:

```python
#every field defaults, unlike WeightLogModel below: _clean_weight_rows preserves only the
#keys the client actually sent, so an entry legitimately arrives without ex_block or
#sets_reps_rx. Without defaults pydantic treats Optional as required and rejects it.
class WeightLogEntry(BaseModel):
    ex_block: Optional[str] = None
    ex_name: Optional[str] = None
    sets_reps_rx: Optional[str] = None
    sets_reps_done: Optional[str] = None
    #numeric so tonnage and progression math stay possible; weight_note carries
    #everything a number cannot, like bw+25 or red band
    weight_value: Optional[float] = None
    weight_note: Optional[str] = None

class WeightLogModel(BaseModel):
    daily_workout_id: int
    date_completed: date
    workout_name: Optional[str]
    workout_type: Literal['Lift', 'Armcare', 'Back/Core', 'Individual Workout', 'Mobility', 'Conditioning']
    exercises: list[WeightLogEntry]
```

- [ ] **Step 4: Add the route**

In `app/api_calls.py`, extend the input_validation import to include `WeightLogModel`, add `save_weight_log` to the `app.models` imports, then add after the `getPlayerGoals` route:

```python
#── workout weight log ───────────────────────────────────────────────────
#a log belongs to one scheduled workout, so daily_workout_id is the key throughout

def _clean_weight_rows(exercises):
    #an untouched placeholder row carries nothing, so it must not become a stored row.
    #empty strings are normalised to None first, then anything still empty is dropped
    cleaned = []
    for ex in exercises or []:
        row = {key: (None if value == "" else value) for key, value in ex.items()}
        if row.get("sets_reps_done") is None and row.get("weight_value") is None and row.get("weight_note") is None:
            continue
        cleaned.append(row)
    return cleaned

@app.route("/api/saveWeightLog", methods = ["POST"])
def saveWeightLog():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "no json body"}), 400

    payload = {
        "daily_workout_id": data.get("daily_workout_id"),
        "date_completed": data.get("date_completed"),
        "workout_name": data.get("workout_name"),
        "workout_type": data.get("workout_type"),
        "exercises": _clean_weight_rows(data.get("exercises")),
        }

    #an all-blank save must not create a record
    if not payload["exercises"]:
        return jsonify({"error": "at least one exercise must be filled in"}), 400

    try:
        validated = WeightLogModel(**payload)
    except ValidationError as e:
        return jsonify(e.errors()), 400

    log_id = save_weight_log(
        validated.daily_workout_id,
        {"date_completed": validated.date_completed.isoformat(),
         "workout_name": validated.workout_name,
         "workout_type": validated.workout_type},
        [ex.model_dump() for ex in validated.exercises])

    return jsonify({"status": "log saved", "id": log_id}), 200
```

- [ ] **Step 5: Run to verify they pass**

Run: `myenv/bin/pytest tests/test_weight_log_api.py -v`
Expected: 6 passed

- [ ] **Step 6: Run the whole suite**

Run: `myenv/bin/pytest tests/ -v`
Expected: 22 passed

- [ ] **Step 7: Commit**

```bash
git add app/input_validation.py app/api_calls.py tests/test_weight_log_api.py
git commit -m "feat: add /api/saveWeightLog with validation and blank-row guards"
```

---

### Task 6: The read route, with placeholders

**Files:**
- Modify: `app/api_calls.py` (after `saveWeightLog`)
- Modify: `tests/test_weight_log_api.py`

**Interfaces:**
- Consumes: `get_weight_log`, `get_previous_weight_log` (Task 3), `get_workout_by_name` (existing, `app/models.py:537`).
- Produces: `POST /api/getWeightLog` accepting `{daily_workout_id, date, workout_type, workout_name}` and returning:

```json
{
  "logged": false,
  "prefilled_from": "2026-09-11",
  "exercises": [
    {"ex_block": "A", "ex_name": "Bench", "sets_reps_rx": "3x5",
     "sets_reps_done": null, "weight_value": null, "weight_note": null,
     "placeholder": {"sets_reps_done": "3x5", "weight_value": 180.0, "weight_note": null}}
  ]
}
```

Every exercise always carries both shapes: real values when a log exists, a `placeholder` object when prefilling from a previous log, `null` for both otherwise. The client never has to decide precedence.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_weight_log_api.py`:

```python
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `myenv/bin/pytest tests/test_weight_log_api.py -v`
Expected: the 4 new tests fail with 404

- [ ] **Step 3: Implement**

Add `get_weight_log` and `get_previous_weight_log` to the `app.models` imports in `app/api_calls.py`, then add after `saveWeightLog`:

```python
def _blank_row(ex_block=None, ex_name=None, sets_reps_rx=None):
    return {"ex_block": ex_block, "ex_name": ex_name, "sets_reps_rx": sets_reps_rx,
            "sets_reps_done": None, "weight_value": None, "weight_note": None,
            "placeholder": None}

@app.route("/api/getWeightLog", methods = ["POST"])
def getWeightLog():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "no json body"}), 400

    daily_workout_id = data.get("daily_workout_id")
    date = data.get("date")
    workout_type = data.get("workout_type")
    workout_name = data.get("workout_name")

    if not is_int(daily_workout_id):
        return jsonify({"error": "daily_workout_id must be an integer"}), 400

    #an existing log wins outright: this is that workout's log, opened for editing
    logged = get_weight_log(daily_workout_id)
    if logged:
        exercises = []
        for ex in logged["exercises"]:
            row = dict(ex)
            row["placeholder"] = None
            exercises.append(row)
        return jsonify({"logged": True, "prefilled_from": None, "exercises": exercises}), 200

    #otherwise the rows come from the workout definition. the calendar stores the name as
    #free text with nothing constraining it, so this can legitimately find nothing
    definition = get_workout_by_name(workout_type, workout_name) if workout_type in WORKOUT_TYPES else None
    if definition and definition.get("exercises"):
        exercises = [_blank_row(ex["ex_block"], ex["ex_name"], ex["sets_reps"])
                     for ex in definition["exercises"]]
    else:
        exercises = [_blank_row()]

    #last time's numbers are offered as placeholders, never as values
    previous = get_previous_weight_log(workout_name, date) if workout_name and date else None
    if previous:
        #matched by name, but repeats pair positionally: a workout can log the same exercise
        #twice (a warm-up set then a working set), and a flat name->row map would hand both
        #of today's rows the last one's numbers and silently lose the first
        by_name = {}
        for ex in previous["exercises"]:
            by_name.setdefault(ex["ex_name"], []).append(ex)

        used = {}
        for row in exercises:
            name = row["ex_name"]
            #a nameless row (the no-definition fallback) has nothing to match on
            if not name:
                continue
            matches = by_name.get(name)
            if not matches:
                continue
            index = used.get(name, 0)
            used[name] = index + 1
            if index < len(matches):
                match = matches[index]
                row["placeholder"] = {"sets_reps_done": match["sets_reps_done"],
                                      "weight_value": match["weight_value"],
                                      "weight_note": match["weight_note"]}

    return jsonify({"logged": False,
                    "prefilled_from": previous["date_completed"] if previous else None,
                    "exercises": exercises}), 200
```

- [ ] **Step 4: Run to verify they pass**

Run: `myenv/bin/pytest tests/test_weight_log_api.py -v`
Expected: 15 passed

- [ ] **Step 5: Commit**

```bash
git add app/api_calls.py tests/test_weight_log_api.py
git commit -m "feat: add /api/getWeightLog with previous-log placeholders"
```

---

### Task 7: Throwing and Warmup read-only lookups

**Files:**
- Modify: `app/api_calls.py:397-412` (the `getSelectedWorkout` route)
- Create: `tests/test_selected_workout.py`

**Interfaces:**
- Consumes: `get_throwing_day_by_name` (existing, `app/models.py:203`), `get_warmup_by_name` (existing, `app/models.py:551`).
- Produces: `/api/getSelectedWorkout` answering for `type` values `"Throwing"` and `"Warmup"` in the casing the calendar stores.

The existing route tests the lowercase string `"warmup"` while `training_calendar_daily_wkouts.workout_type` stores `"Warmup"`, so the calendar's value currently falls through to `get_workout_by_name("Warmup", ...)` and 404s. `workouts.workout_type` has a CHECK constraint that excludes `Throwing`, so throwing sessions are unreachable that way too — they live only in `throwing_days`.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_selected_workout.py`:

```python
import sqlite3


def _seed_throwing_day(db, name="Plyo Day", date="2026-09-17"):
    conn = sqlite3.connect(db)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO throwing_days (date, day_name, session_type, notes) VALUES (?,?,?,?)",
                   (date, name, "recovery", "Felt good."))
    day_id = cursor.lastrowid
    #the column is drill_type, and it is CHECK IN ('plyo','throwing') — lowercase only.
    #get_throwing_day_by_name maps it to the "set" key the view reads
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
```

These column names and return keys were verified against the live database before this
plan was dispatched: `throwing_days` is (id, date, day_name, session_type, notes);
`throwing_day_drills` is (id, session_id, drill_type, drill_name, ball_weight, throw_count,
drill_notes); `warmups` is (Id, date, name, rollout_ex, spine_ex, hip_ex, shoulder_ex,
arm_ex, dynamic_ex, notes). `get_throwing_day_by_name` returns date, day_name,
session_type, notes, id and `drills[]` whose keys are set, drill_name, ball_weight,
throw_count, drill_notes. Re-confirm before implementing:

```bash
myenv/bin/python -c "
import sqlite3
c = sqlite3.connect('training_log.db')
for t in ('throwing_days','throwing_day_drills','warmups'):
    print(t, [r[1] for r in c.execute('pragma table_info(%s)' % t)])
"
myenv/bin/python -c "
from app.models import get_throwing_day_by_name, get_throwing_day_names
names = get_throwing_day_names()
print(dict(get_throwing_day_by_name(names[0]['day_name'])).keys() if names else 'no throwing days logged')
"
```

If anything differs from the list above, the database changed since planning — adjust the
seed helpers and tell me.

- [ ] **Step 2: Run to verify they fail**

Run: `myenv/bin/pytest tests/test_selected_workout.py -v`
Expected: `test_throwing_day_resolves_by_name` and `test_warmup_resolves_in_the_casing_the_calendar_stores` fail with 400 or 404

- [ ] **Step 3: Implement**

Add `get_throwing_day_by_name` to the `app.models` imports in `app/api_calls.py`, then replace the dispatch in `getSelectedWorkout`:

```python
    #warmups and throwing days keep their own tables and shapes; every other type is a
    #workout_type value. the calendar stores these capitalised, so match case-insensitively
    table = (table or "").strip()
    if table.lower() == "warmup":
        result = get_warmup_by_name(workout)
    elif table.lower() == "throwing":
        #workouts.workout_type excludes Throwing by CHECK, so these are only in throwing_days
        result = get_throwing_day_by_name(workout)
    elif table in WORKOUT_TYPES:
        result = get_workout_by_name(table, workout)
    else:
        return jsonify({"error": "unknown workout type"}), 400
```

- [ ] **Step 4: Run to verify they pass**

Run: `myenv/bin/pytest tests/test_selected_workout.py -v`
Expected: 4 passed

- [ ] **Step 5: Check nothing regressed**

Run: `myenv/bin/pytest tests/ -v`
Expected: 35 passed

Then confirm the existing Workouts and Warmup Options tabs still work in the browser: start the app, open `/training_calendar`, switch the workout type dropdown and pick a warmup. Both panels should behave exactly as before.

- [ ] **Step 6: Commit**

```bash
git add app/api_calls.py tests/test_selected_workout.py
git commit -m "feat: resolve Throwing and capitalised Warmup in getSelectedWorkout"
```

---

### Task 8: Modal markup

**Files:**
- Modify: `app/templates/training_calendar.html` (add beside the existing `#editWorkout-modal`, near line 236, and the `#ex-row-template` near the end of the file)

**Interfaces:**
- Consumes: nothing at runtime — this task is markup only.
- Produces: DOM ids `#logWeights-modal`, `#weight-log-name`, `#weight-log-meta`, `#weight-rows`, `#addWeightRow`, `#saveWeightLog`, `#viewSession-modal`, `#view-session-title`, `#view-session-body`, and `<template id="weight-row-template">`. Task 9's JS binds to exactly these.

- [ ] **Step 1: Add the weight-log modal**

Insert after the closing `</div>` of `#editWorkout-modal`:

```html
<!-- ── Log Weights Modal ────────────────────── -->
<!-- opened by clicking a workout in the Today card; the row clicked is the log's identity,
     so name and date are shown rather than entered -->
<div id="logWeights-modal" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2>Log Weights</h2>
      <button class="modal-close" data-modal="logWeights-modal">&#x2715;</button>
    </div>
    <div class="modal-content">
      <div class="field-group">
        <label>Workout</label>
        <p id="weight-log-name" class="day-meta"></p>
      </div>
      <!-- names where the placeholders came from, so an untouched row is never mistaken
           for a fresh entry -->
      <p id="weight-log-meta" class="day-meta"></p>
      <div class="field-group">
        <label>Exercises</label>
        <div id="weight-rows" class="modal-rows"></div>
      </div>
      <div class="modal-btn-group">
        <button type="button" id="addWeightRow">+ Add Exercise</button>
      </div>
      <button id="saveWeightLog" class="btn-save">Save Log</button>
    </div>
  </div>
</div>

<!-- ── View Session Modal ───────────────────── -->
<!-- read-only: throwing days and warmups have nothing to log, only to look at -->
<div id="viewSession-modal" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 id="view-session-title">Session</h2>
      <button class="modal-close" data-modal="viewSession-modal">&#x2715;</button>
    </div>
    <div class="modal-content" id="view-session-body"></div>
  </div>
</div>
```

- [ ] **Step 2: Add the row template**

Insert beside the existing `<template id="ex-row-template">`:

```html
<!-- one exercise row in the weight log; the name is a label, only the two inputs are typed into -->
<template id="weight-row-template">
  <div class="modal-row weight-row">
    <span class="row-ex-label"></span>
    <input type="text" class="row-sets-reps-done" placeholder="Sets/Reps">
    <input type="number" step="any" class="row-weight-value" placeholder="Weight">
    <input type="text" class="row-weight-note row-notes" placeholder="Note">
  </div>
</template>
```

- [ ] **Step 3: Verify the page still renders**

```bash
myenv/bin/python -c "
from app import app
with app.test_client() as c:
    html = c.get('/training_calendar').get_data(as_text=True)
    print('status ok')
    for probe in ('logWeights-modal','weight-rows','saveWeightLog','viewSession-modal','weight-row-template'):
        print(probe, probe in html)
"
```

Expected: `status ok` then five `True` lines.

- [ ] **Step 4: Commit**

```bash
git add app/templates/training_calendar.html
git commit -m "feat: add weight log and view session modals"
```

---

### Task 9: Click dispatch and the log modal

**Files:**
- Modify: `app/static/js/training_calendar.js` — `buildReminder()` near line 312, plus a new section beside the `editWorkoutBtn` block near line 654

**Interfaces:**
- Consumes: `/api/getWeightLog` (Task 6), `/api/saveWeightLog` (Task 5), `/api/getSelectedWorkout` (Task 7), the DOM ids from Task 8, and the existing `postJSON()` helper (`app/static/js/training_calendar.js:101`).
- Produces: a clickable `.reminder-body` on every Today-card row.

The save handler is named `submitWeightLog`, not `saveWeightLog`: the button's id is
`saveWeightLog`, and a named element and a top-level function declaration both bind
`window.saveWeightLog`.

- [ ] **Step 1: Make the row body clickable**

In `buildReminder()`, after `body.append(title, sub);`, add:

```javascript
    // the body is the click target, not the <li>: the complete and delete checkboxes sit
    // on either side of it and their change handlers must not fire from opening a modal
    const workout = event;   // buildReminder's parameter is the workout, not a DOM event
    body.classList.add("is-clickable");
    body.setAttribute("role", "button");
    body.setAttribute("tabindex", "0");
    body.addEventListener("click", function () { openSessionModal(workout); });
    body.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSessionModal(workout); }
    });
```

`buildReminder`'s parameter is named `event` and holds the workout, not a DOM event. Aliasing
it to `workout` keeps the handlers from reading as though they use the global `window.event`.

- [ ] **Step 2: Add the dispatch and rendering**

Add at the end of `app/static/js/training_calendar.js`:

```javascript
// ── Weight log ────────────────────────────────────────────────────────────────
//
// Clicking a workout in the Today card opens its log. The row carries the
// training_calendar_daily_wkouts.ID, so the log's identity needs no lookup.

// nothing to log against a throwing day or a warmup, so those open read-only
const VIEW_ONLY_TYPES = ["Throwing", "Warmup"];

const weightModal = document.getElementById("logWeights-modal");
const weightRows = document.getElementById("weight-rows");
const weightName = document.getElementById("weight-log-name");
const weightMeta = document.getElementById("weight-log-meta");
const viewModal = document.getElementById("viewSession-modal");
const viewTitle = document.getElementById("view-session-title");
const viewBody = document.getElementById("view-session-body");

// the workout the open modal belongs to; saveWeightLog() reads it rather than the DOM
let loggingFor = null;

async function openSessionModal(workout) {
    if (VIEW_ONLY_TYPES.indexOf(workout.type) !== -1) {
        await openViewModal(workout);
        return;
    }

    const data = await postJSON("/api/getWeightLog", {
        daily_workout_id: workout.id,
        date: workout.date,
        workout_type: workout.type,
        workout_name: workout.name
    }, "Could not load this workout's log.");
    if (!data) return;

    loggingFor = workout;
    weightName.textContent = (workout.name || workout.type) + " · " + workout.date;
    weightMeta.textContent = data.prefilled_from
        ? "Greyed values are what you last logged on " + data.prefilled_from
        : "";

    weightRows.innerHTML = "";
    data.exercises.forEach(function (ex) { weightRows.appendChild(buildWeightRow(ex)); });
    openModal("logWeights-modal");
}

// placeholders, never values: an untouched row must save nothing rather than last
// session's numbers
function buildWeightRow(ex) {
    const row = document.getElementById("weight-row-template").content.firstElementChild.cloneNode(true);
    const placeholder = ex.placeholder || {};

    const label = row.querySelector(".row-ex-label");
    label.textContent = ex.ex_name || "";
    row.dataset.exBlock = ex.ex_block || "";
    row.dataset.exName = ex.ex_name || "";
    row.dataset.setsRepsRx = ex.sets_reps_rx || "";

    const fields = [
        [".row-sets-reps-done", ex.sets_reps_done, placeholder.sets_reps_done, "Sets/Reps"],
        [".row-weight-value", ex.weight_value, placeholder.weight_value, "Weight"],
        [".row-weight-note", ex.weight_note, placeholder.weight_note, "Note"]
    ];
    fields.forEach(function (field) {
        const input = row.querySelector(field[0]);
        input.value = field[1] === null || field[1] === undefined ? "" : field[1];
        input.placeholder = field[2] === null || field[2] === undefined ? field[3] : String(field[2]);
    });

    // an exercise typed in by hand needs its name captured too
    if (!ex.ex_name) {
        const typed = document.createElement("input");
        typed.type = "text";
        typed.className = "row-ex-name-input";
        typed.placeholder = "Exercise";
        label.replaceWith(typed);
    }
    return row;
}

function addWeightRow() {
    weightRows.appendChild(buildWeightRow({
        ex_block: null, ex_name: null, sets_reps_rx: null,
        sets_reps_done: null, weight_value: null, weight_note: null, placeholder: null
    }));
}

function collectWeightRows() {
    const rows = [];
    weightRows.querySelectorAll(".weight-row").forEach(function (row) {
        const typed = row.querySelector(".row-ex-name-input");
        rows.push({
            ex_block: row.dataset.exBlock || null,
            ex_name: typed ? typed.value : (row.dataset.exName || null),
            sets_reps_rx: row.dataset.setsRepsRx || null,
            sets_reps_done: row.querySelector(".row-sets-reps-done").value,
            weight_value: row.querySelector(".row-weight-value").value,
            weight_note: row.querySelector(".row-weight-note").value
        });
    });
    return rows;
}

async function submitWeightLog() {
    if (!loggingFor) return;

    const saved = await postJSON("/api/saveWeightLog", {
        daily_workout_id: loggingFor.id,
        date_completed: loggingFor.date,
        workout_name: loggingFor.name,
        workout_type: loggingFor.type,
        exercises: collectWeightRows()
    }, "Could not save this log.");
    if (!saved) return;

    // a logged workout must never still read as outstanding in the card it was logged from
    replaceDay(loggingFor.date, events
        .filter(function (e) { return e.date === loggingFor.date; })
        .map(function (e) { return e.id === loggingFor.id ? Object.assign({}, e, { done: 1 }) : e; }));

    weightModal.classList.remove("active");
    loggingFor = null;
    showCalendar(currentMonth, currentYear);
}

async function openViewModal(workout) {
    const data = await postJSON("/api/getSelectedWorkout",
        { type: workout.type, value: workout.name },
        "Could not load this session.");
    if (!data) return;

    viewTitle.textContent = workout.name || workout.type;
    viewBody.innerHTML = workout.type === "Warmup" ? warmupMarkup(data) : throwingDayMarkup(data);
    openModal("viewSession-modal");
}

// both views reuse the layout the record already has elsewhere: the Warmup Options tab
// here, and the Throwing Days tab on the home page
function warmupMarkup(warmup) {
    const columns = [
        ["Name", warmup.name], ["Rollout Exercises", warmup.rollout_ex],
        ["Spine Exercises", warmup.spine_ex], ["Hip Exercises", warmup.hip_ex],
        ["Shoulder Exercises", warmup.shoulder_ex], ["Arm Exercises", warmup.arm_ex],
        ["Dynamic Exercises", warmup.dynamic_ex], ["Notes", warmup.notes]
    ];
    return '<div class="table-scroll"><table><thead><tr>' +
        columns.map(function (c) { return "<th>" + c[0] + "</th>"; }).join("") +
        "</tr></thead><tbody><tr>" +
        columns.map(function (c) {
            return '<td data-label="' + c[0] + '">' + (c[1] || "") + "</td>";
        }).join("") +
        "</tr></tbody></table></div>";
}

function throwingDayMarkup(day) {
    const meta = '<span class="day-meta">' + (day.date || "") + " &middot; " + (day.session_type || "") + "</span>";
    const notes = day.notes
        ? '<div class="day-notes"><h4>Day Breakdown / Notes</h4><p>' + day.notes + "</p></div>"
        : "";
    const rows = (day.drills || []).map(function (drill) {
        return '<tr><td data-label="Set">' + (drill.set || "") +
            '</td><td data-label="Drill">' + (drill.drill_name || "") +
            '</td><td data-label="Ball">' + (drill.ball_weight || "") +
            '</td><td data-label="Throws">' + (drill.throw_count || "") +
            '</td><td data-label="Notes">' + (drill.drill_notes || "") + "</td></tr>";
    }).join("");
    return meta + notes +
        '<div class="table-scroll"><table><thead><tr><th>Set</th><th>Drill</th><th>Ball</th>' +
        "<th>Throws</th><th>Notes</th></tr></thead><tbody>" + rows + "</tbody></table></div>";
}

document.getElementById("addWeightRow").addEventListener("click", addWeightRow);
document.getElementById("saveWeightLog").addEventListener("click", submitWeightLog);
```

- [ ] **Step 3: Confirm the file parses**

Run: `node --check app/static/js/training_calendar.js`
Expected: no output (success)

If node is unavailable, load `/training_calendar` in the browser and confirm the console is free of syntax errors.

- [ ] **Step 4: Verify `postJSON`'s signature before relying on it**

```bash
myenv/bin/python -c "
import io
src = io.open('app/static/js/training_calendar.js', encoding='utf-8').read()
start = src.index('async function postJSON')
print(src[start:start + 700])
"
```

Verified before dispatch: it takes `(url, body, failureMessage)`, returns `response.json()`
on success and `null` on failure (it alerts and logs itself). The `if (!data) return;` guard
above is therefore correct as written. Confirm it still matches; if it now throws instead of
returning `null`, wrap the three call sites in try/catch and tell me.

- [ ] **Step 5: Manual browser check**

Start the app, open `/training_calendar`, and confirm:

1. Clicking a Lift/Armcare/Back-Core row in the Today card opens the Log Weights modal with that workout's exercises listed.
2. Ticking the complete checkbox does **not** open the modal.
3. Ticking the delete checkbox does **not** open the modal.
4. Entering a weight and saving closes the modal and leaves the row ticked and struck as done.
5. Reopening that workout shows the saved values as real values, not placeholders.
6. Clicking a Warmup row opens the read-only view with the warmup's columns.

- [ ] **Step 6: Commit**

```bash
git add app/static/js/training_calendar.js
git commit -m "feat: open the weight log from the Today card"
```

---

### Task 10: Affordance and the logged marker

**Files:**
- Modify: `app/static/css/training_calendar.css` (beside the existing Today List rules, after line ~325)
- Modify: `app/static/js/training_calendar.js` — `buildReminder()`

**Interfaces:**
- Consumes: the `is-clickable` class added in Task 9.
- Produces: `.reminder-body.is-clickable` hover styling and a `.has-log` marker.

A clickable `<li>` has no affordance of its own. Without this task the feature is invisible, so it is not polish.

- [ ] **Step 1: Pass the logged flag through**

`getCalendarWorkouts()` (`app/models.py:738`) already returns `done`. Extend its query so the client knows which workouts carry a log:

```python
    rows = cursor.execute("""SELECT w.ID AS id, c.workout_date AS date,
                                    w.workout_type AS type, w.workout_name AS name,
                                    w.completed AS done,
                                    (l.id IS NOT NULL) AS logged
                             FROM training_calendar_daily_wkouts w
                             JOIN training_calendar c ON c.ID = w.session_id
                             LEFT JOIN workout_weight_log l ON l.daily_workout_id = w.ID
                             ORDER BY w.ID""").fetchall()
```

Apply the same `LEFT JOIN` and `logged` column to `calendar_day()` in `app/api_calls.py:653`, so a day refreshed after a save reports it too.

- [ ] **Step 2: Write the failing test**

Create `tests/test_calendar_logged_flag.py`:

```python
from app.models import getCalendarWorkouts, save_weight_log


def test_workouts_report_whether_they_have_a_log(db, scheduled_workout):
    unlogged = scheduled_workout(date="2026-09-16", name="Lower A")
    logged = scheduled_workout(date="2026-09-17", name="Upper A")
    save_weight_log(logged,
                    {"date_completed": "2026-09-17", "workout_name": "Upper A", "workout_type": "Lift"},
                    [{"ex_name": "Bench", "weight_value": 185.0}])

    by_id = {w["id"]: w for w in getCalendarWorkouts()}

    assert by_id[logged]["logged"] == 1
    assert by_id[unlogged]["logged"] == 0
```

- [ ] **Step 3: Run it**

Run: `myenv/bin/pytest tests/test_calendar_logged_flag.py -v`
Expected: PASS if Step 1 was applied; FAIL with `KeyError: 'logged'` if it was not.

- [ ] **Step 4: Mark the row**

In `buildReminder()`, after `if (event.done) item.classList.add("is-done");`, add:

```javascript
    // a logged workout has to look different from a merely ticked one, or there is no
    // way to tell what still needs its weights entered
    if (event.logged) item.classList.add("has-log");
```

- [ ] **Step 5: Keep the marker in step on save**

Task 9's `submitWeightLog` refreshes the day with `done: 1` only, so a freshly saved log
would not gain its marker until a reload. Extend that mapping:

```javascript
        .map(function (e) {
            return e.id === loggingFor.id ? Object.assign({}, e, { done: 1, logged: 1 }) : e;
        }));
```

- [ ] **Step 6: Add the styling**

Append to `app/static/css/training_calendar.css`.

First, the throwing-day notes block. Task 9's `throwingDayMarkup` emits
`<div class="day-notes">`, but `.day-notes` is styled only in `inszn_home.css` — and
`training_calendar.html` loads `training_calendar.css` alone. Without these rules the
read-only throwing view renders its notes unstyled, which breaks the spec's requirement
that it match the Throwing Days tab. Ported verbatim from `inszn_home.css:169-188`
(the `.hidden` variant is not needed here — the markup only emits the block when there
are notes):

```css
/* ── Throwing day view ──────────────────────── */
/* ported from inszn_home.css so the read-only view matches the Throwing Days tab;
   that stylesheet is not loaded on this page */
.day-notes {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
  background: rgba(255,255,255,0.02);
}
.day-notes h4 {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-label);
  margin-bottom: 6px;
}
.day-notes p {
  font-size: 0.88rem;
  color: var(--text-primary);
  line-height: 1.5;
}
```

Then the weight row's own grid. `.modal-row` defaults to
`grid-template-columns: 70px 1fr 100px` (block / exercise / sets-reps) — built for the
edit-workout rows, which lead with a narrow block field. The weight row instead leads
with the exercise NAME, which would be crushed into that 70px column. `.drill-row`
already sets its own override; `.weight-row` needs the same treatment:

```css
/* this row leads with a name label, not the narrow block field .modal-row assumes.
   the note carries .row-notes, so it spans the full second line on its own */
.modal-row.weight-row { grid-template-columns: 1fr 110px 110px; }
.modal-row.weight-row .row-ex-label,
.modal-row.weight-row .row-ex-name-input { min-width: 0; }
.modal-row.weight-row .row-ex-label {
  display: flex;
  align-items: center;
  font-size: 0.88rem;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}
```

Then the Today-card rules:

```css
/* ── Today List: clickable rows ──────────────── */
/* the row body opens that workout's weight log; without an affordance the feature is
   invisible, since a list item does not look actionable */
.reminder-body.is-clickable {
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color var(--transition), background var(--transition);
}
.reminder-body.is-clickable:hover .reminder-title,
.reminder-body.is-clickable:focus-visible .reminder-title {
  color: var(--accent);
  text-decoration: underline;
}
.reminder-body.is-clickable:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 2px;
}

/* a workout whose weights are recorded, as distinct from one merely ticked off */
.reminder-list li.has-log .reminder-sub::after {
  content: " · logged";
  color: var(--accent);
  font-weight: 700;
}
```

- [ ] **Step 7: Run the whole suite**

Run: `myenv/bin/pytest tests/ -v`
Expected: 36 passed

- [ ] **Step 8: Manual browser check**

Open `/training_calendar` and confirm:

1. Hovering a Today-card row underlines its title and shows a pointer.
2. Tabbing to a row shows a focus outline; Enter opens the modal.
3. A workout with a saved log reads "· logged" under its name; one without does not.
4. Saving a log adds that marker without a page reload.
5. Clicking a Throwing row shows its notes block styled the same as the Throwing Days tab
   on `/inszn-home` — padded, with a small uppercase "Day Breakdown / Notes" heading.
6. In the weight-log modal, a long exercise name ("Barbell Bench Press") is readable rather
   than crushed into a narrow column, and the note input spans the full width below it.

- [ ] **Step 9: Commit**

```bash
git add app/models.py app/api_calls.py app/static/js/training_calendar.js app/static/css/training_calendar.css tests/test_calendar_logged_flag.py
git commit -m "feat: mark logged workouts and make Today card rows look clickable"
```

---

## Verification

After Task 10, the full suite should be green:

```bash
myenv/bin/pytest tests/ -v
```

Expected: 36 passed.

End-to-end check in the browser, on `/training_calendar`:

1. Schedule a Lift for today via the Add Workouts card.
2. Click it in the Today card — the modal lists that workout's exercises, weights blank.
3. Enter a weight on one exercise, leave the rest blank, save.
4. The row shows ticked, struck, and "· logged"; the other exercises stored nothing.
5. Schedule the same workout for a later date and click it — last session's numbers appear as grey placeholders naming the date they came from.
6. Save without touching them — the new log records nothing for those rows, not last session's numbers.

## Deferred

Out of scope per the spec, listed so they are not mistaken for gaps:

- Logging a workout that was never scheduled (add it to the calendar first).
- Tonnage, volume or progression reporting. `weight_value` makes the math possible; nothing computes it.
- Any history view beyond opening a past day's log.
