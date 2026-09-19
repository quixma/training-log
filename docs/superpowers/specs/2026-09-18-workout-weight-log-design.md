# Workout Weight Log — Design

**Date:** 2026-09-18
**Status:** Awaiting review

## Summary

Log the sets/reps and weight actually completed for a scheduled workout, entered by
clicking that workout in the Training Calendar's Today card. Each log is tied to the
specific scheduled workout instance it belongs to, so the calendar doubles as the
history browser.

## Why the Today card

`buildReminder()` (`app/static/js/training_calendar.js:317`) already stamps each list
item with `dataset.id = event.id`, which is the `training_calendar_daily_wkouts.ID` of
that scheduled workout. Clicking a row therefore yields the exact instance — its id,
date, name and type — with no lookup.

The rejected alternative was a button beside "Edit Workout" on the Workouts tab. That
panel shows a workout *definition* out of `workouts`/`workout_ex`, which carries no date
and no calendar link, so every log would have needed to resolve `(date, type, name)` back
to a calendar row — ambiguous whenever a day holds two workouts of the same name, and
undefined when the workout was never scheduled.

## Interaction

Clicking the `.reminder-body` of a row in the Today card opens a modal whose behaviour
depends on the row's `workout_type`:

| Type | Behaviour |
|---|---|
| `Lift`, `Armcare`, `Back/Core`, `Individual Workout`, `Mobility`, `Conditioning` | Weight-log modal (editable) |
| `Warmup` | Read-only view of that warmup |
| `Throwing` | Read-only view of that throwing day |

The click binds to `.reminder-body`, not the `<li>`, so it cannot collide with the
complete and delete checkboxes that already sit on either side of it.

### Weight-log modal

- **Date** — not an input. The log inherits the date of the scheduled row that was
  clicked. Logging Wednesday's session on Friday records Wednesday; the log describes
  the session, not when it was typed up.
- **Name** — displayed, not editable. It is the row that was clicked.
- **Exercise rows** — one per exercise, showing the exercise name only (no prescribed
  sets/reps, no exercise notes), followed by three inputs: *sets/reps completed* (text),
  *weight* (numeric) and *note* (text). Any may be left blank.

  The weight is split into a numeric field and a free-text note deliberately. The numeric
  field is what makes tonnage and progression math possible later; the note carries
  everything a number cannot — `bw+25`, `red band`, `top set then drop`. Neither field
  is required, so a movement with no meaningful load still logs cleanly.
- **Add Exercise** — a row can be added manually, for the fallback case below.

Exercises are loaded via `get_workout_by_name(type, name)`. The calendar stores
`workout_name` as free text with nothing constraining it, so this can return nothing —
a name typed freehand, or a definition renamed or deleted since it was scheduled. In
that case the modal opens with a single blank row rather than failing.

### Read-only views

Both views **reuse the layout each record already has elsewhere in the app**, rather
than inventing a modal-specific presentation. Same markup, same classes, same column
order — only the surrounding card becomes a modal.

**Warmup** resolves through `get_warmup_by_name(name)`, which `/api/getSelectedWorkout`
already dispatches to (note its branch tests the lowercase `"warmup"` while the calendar
stores `"Warmup"`, so the comparison must be normalised). It renders as the Warmup
Options tab does (`app/templates/training_calendar.html`): a `.table-scroll` table with
the columns Name, Rollout Exercises, Spine Exercises, Hip Exercises, Shoulder Exercises,
Arm Exercises, Dynamic Exercises, Notes, each cell rendered `| safe` for its stored
line breaks.

**Throwing** resolves through `get_throwing_day_by_name(name)`, and needs a **new third
branch** on that route. `workouts.workout_type` carries a CHECK constraint that excludes
`Throwing`, so no throwing session is reachable through `get_workout_by_name` — throwing
days live only in `throwing_days` / `throwing_day_drills`, and the calendar's Throwing
names come from `throwing_days.day_name` via `get_throwing_workouts_by_name()`. It
renders as the Throwing Days tab does (`app/templates/inszn_home.html`): a `.day-meta`
line carrying date and session type, the `.day-notes` block headed "Day Breakdown /
Notes", then a `.table-scroll` table with the columns Set, Drill, Ball, Throws, Notes.

One caveat on the warmup view: eight columns inside a modal is considerably narrower
than the full-width tab it was designed for, so it will rely on the `.table-scroll`
horizontal scroll far more than the tab does. Matching the existing layout is the
instruction and this spec follows it — flagged only so the cramping is expected rather
than discovered.

### Prefill

When no log exists for the clicked instance, exercise rows prefill from the most recent
prior log of the same `workout_name`, matched by `ex_name`. Exercises absent from that
log stay blank. When a log already exists for the instance, it loads instead.

Prefilled values render as **placeholders, not values** — greyed, and not submitted if
left untouched. Saving an untouched row therefore records nothing for that exercise
rather than silently recording last session's numbers as this session's. The modal
header names the source date ("last logged Sep 11") so the reference point is explicit.

The cost is retyping a weight that has not changed week to week. Accepted: a wrong
number in a training log is worse than a missing one.

## Schema

```sql
CREATE TABLE workout_weight_log (
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

CREATE TABLE workout_weight_log_ex (
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

### Schema decisions

**`daily_workout_id` is nullable with `ON DELETE SET NULL`, not `NOT NULL` with
`CASCADE`.** The delete control on a calendar row is a checkbox that is easy to hit;
`CASCADE` would mean a mis-staged delete silently destroys training history. Nullable
means an orphaned log survives and stays readable through the denormalized
`date_completed` / `workout_name` / `workout_type`. SQLite permits multiple `NULL`s
under `UNIQUE`, so orphans do not collide.

**`UNIQUE(daily_workout_id)`** — one log per scheduled workout. Clicking a workout opens
its log, existing or blank; "log" and "edit log" are the same operation. Writes are an
upsert, unlike `player_goals` and `workout_notes`, which are deliberately append-only.

**Exercises are snapshotted as text, never FK'd to `workout_ex`.** `update_workout()`
(`app/models.py:720`) deletes and reinserts every exercise row on each edit, so
`workout_ex.ID` is not stable across edits. Snapshotting also means a later rename of an
exercise leaves historical logs reading as they were recorded, which is correct for a log.

**`sets_reps_rx`** stores the prescribed sets/reps at log time even though the modal does
not display it, so "did I hit the program?" stays answerable retroactively. It cannot be
reconstructed later, because the definition may change.

**`ex_order`** preserves display order. Once exercises are snapshotted, the ordering that
`workout_ex.ID` provided is gone.

**`weight_value` is `REAL`, nullable, and assumed to be pounds.** No unit column: the log
is single-user and mixing units within one log would break the math the numeric column
exists to enable. `weight_note` absorbs anything non-numeric. The consequence is that
aggregate math covers only rows where a number was entered — a session logged entirely
as `bw+25` contributes nothing to tonnage. That is a reporting caveat, not a data loss:
the note preserves what was actually done.

## Backend

| File | Change |
|---|---|
| `app/models.py` | `get_weight_log(daily_workout_id)`, `get_previous_weight_log(workout_name, before_date)`, `save_weight_log(...)` (upsert parent, replace child rows wholesale as `update_workout` does) |
| `app/input_validation.py` | `WeightLogModel` + `WeightLogEntry`, mirroring `UpdateWorkoutModel` / `WorkoutExerciseEntry` |
| `app/api_calls.py` | `/api/getWeightLog` (existing log, else prefill source, else the definition's exercises), `/api/saveWeightLog`; third dispatch branch on `/api/getSelectedWorkout` for `Throwing` |

`/api/getWeightLog` returns the rows the modal should render plus a `prefilled_from` date
when applicable, so the client does not have to decide precedence.

### Write guards

- Exercise rows where `sets_reps_done`, `weight_value` and `weight_note` are all blank
  are dropped.
- `weight_value` is coerced from an empty string to `NULL`; a non-numeric value is
  rejected with a 400 rather than silently dropped, so a weight typed into the wrong
  field is caught at entry rather than discovered missing later.
- A log with zero surviving rows is rejected; an all-blank save must not create a record.
- Saving a log sets `completed = 1` on the calendar row, which feeds
  `get_WorkoutsCompleted()` and so the dashboard's "Workouts Completed (7d)" panel. The
  bare checkbox remains the lightweight "did it, nothing to record" path.

  The Today card reflects this without a reload: on a successful save the row's complete
  checkbox ticks and `is-done` is applied to the `<li>`, the same end state a manual tick
  produces. A logged workout must never read as outstanding in the card it was logged from.

  The flag and the log are independent once set. Un-ticking `completed` afterwards does
  **not** delete the log — that is entered data, and losing it to a stray checkbox click
  would be unrecoverable. Only deleting the calendar row removes the link, and that
  `SET NULL`s the log rather than destroying it.

## Frontend

| File | Change |
|---|---|
| `app/templates/training_calendar.html` | `#logWeights-modal` (editable) and `#viewSession-modal` (read-only); `#weight-row-template` beside the existing `#ex-row-template` |
| `app/static/js/training_calendar.js` | Click handler on `.reminder-body` in `buildReminder()`; dispatch by type; fetch, render, collect and save, following the existing `editWorkoutBtn` block |
| `app/static/css/training_calendar.css` | `cursor: pointer` and a hover state on `.reminder-body`; a marker distinguishing a logged row from an unlogged one |

A clickable `<li>` has no affordance on its own, so the hover state and the logged-row
marker are load-bearing, not polish.

## Out of scope

- Logging a workout that was never scheduled. The "Add Workouts" card sits directly above
  the Today card in the same column: add it, then click it.
- Tonnage, volume and progression reporting. The `weight_value` column makes the math
  possible, but nothing in this spec computes or displays it.
- Any progression charting or history view beyond opening a past day's log.
