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
