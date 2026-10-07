// Training Calendar
//
// The template inlines every logged workout as INITIAL_WORKOUTS, so `events` is
// populated before the first render and month navigation costs no round trip.
// Every read goes through getEventsOnDate(); the save handlers are the only writers,
// and both replace the affected day from the route's response.

//tab control on home screen
function openTab(evt, tabName) {
    document.querySelectorAll('.tabcontent').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tablinks').forEach(t => t.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// both set by the template: WORKOUT_TYPES from models.WORKOUT_TYPES, INITIAL_WORKOUTS
// from the calendar tables. guarded so the file still parses if either is missing.
const TYPES = typeof WORKOUT_TYPES !== "undefined" ? WORKOUT_TYPES : [];
const INITIAL = typeof INITIAL_WORKOUTS !== "undefined" ? INITIAL_WORKOUTS : [];
// dates already logged in each journal, as sets so the day lookup is a plain string hit.
// both tables store YYYY-MM-DD text, which is what toISO() hands back.
const JOURNALS = typeof JOURNAL_DATES !== "undefined" ? JOURNAL_DATES : {};
const LOGGED = {
    throwing: new Set(JOURNALS.throwing || []),
    workout: new Set(JOURNALS.workout || [])
};

const MAX_CHIPS = 5;   // chips that fit a day cell before it collapses to "+N more"
const NAME_PLACEHOLDER = '<option value="">Workout name</option>';

// ── State ─────────────────────────────────────────────────────────────────────

let events = INITIAL;
const today = new Date();
let currentMonth = today.getMonth();
let currentYear = today.getFullYear();
// the day the reminder panel is showing. starts on today and moves with every click
// on the calendar; displayReminders() and saveReminders() both read it, never today,
// so the panel and the rows it writes can never be for different days.
let selected = new Date(today);

// ── Elements ──────────────────────────────────────────────────────────────────

const el = {
    body: document.getElementById("calendar-body"),
    head: document.getElementById("thead-month"),
    monthAndYear: document.getElementById("monthAndYear"),
    month: document.getElementById("month"),
    year: document.getElementById("year"),
    reminders: document.getElementById("reminderList"),
    reminderTitle: document.getElementById("reminderTitle"),
    saveReminders: document.getElementById("saveReminders"),
    todayDate: document.getElementById("todayDate"),
    rows: document.getElementById("workoutRows"),
    date: document.getElementById("eventDate"),
    legend: document.getElementById("chipLegend"),
    throwingLink: document.getElementById("throwingJournalLink"),
    workoutLink: document.getElementById("workoutJournalLink")
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// local-time YYYY-MM-DD. toISOString() would shift the date across the UTC boundary
// for anyone west of Greenwich, landing workouts on the wrong day.
function toISO(d) {
    return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
}

// "YYYY-MM-DD" -> local Date. new Date(str) reads a bare date as UTC midnight, which
// is the same off-by-one-day problem in the other direction.
function fromISO(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
}

function dayKey(y, m, d) { return y + "-" + m + "-" + d; }

// derived rather than stored alongside `selected`, so the two cannot disagree
function selectedKey() {
    return dayKey(selected.getFullYear(), selected.getMonth(), selected.getDate());
}

function isToday(d) {
    return d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();
}

function daysInMonth(month, year) {
    return new Date(year, month + 1, 0).getDate();
}

// 'Back/Core' -> 'back-core', matching the .chip-* classes in the stylesheet
function typeSlug(type) {
    return String(type).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// every route this page talks to is POST + JSON. returns the parsed body, or null
// after reporting the failure, so callers branch once instead of unpacking a response.
async function postJSON(url, body, failureMessage) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        console.log(failureMessage + ":", await response.text());
        alert(failureMessage + ". See console.");
        return null;
    }
    return response.json();
}

// ── Event store ───────────────────────────────────────────────────────────────

function getEventsOnDate(date, month, year) {
    return events.filter(function (event) {
        const d = fromISO(event.date);
        return d.getDate() === date && d.getMonth() === month && d.getFullYear() === year;
    });
}

// both save routes answer with the whole day, so swap that date out wholesale rather
// than merging — a double submit cannot duplicate or strand rows this way
function replaceDay(date, workouts) {
    events = events
        .filter(function (event) { return event.date !== date; })
        .concat(workouts);
}

// ── Calendar render ───────────────────────────────────────────────────────────

function showCalendar(month, year) {
    el.monthAndYear.textContent = MONTHS[month] + " " + year;
    el.month.value = month;
    el.year.value = year;
    el.body.innerHTML = "";

    const firstDay = new Date(year, month, 1).getDay();
    const total = daysInMonth(month, year);
    const weeks = Math.ceil((firstDay + total) / 7);

    let date = 1;
    for (let week = 0; week < weeks; week++) {
        const row = document.createElement("tr");

        for (let col = 0; col < 7; col++) {
            const cell = document.createElement("td");

            // leading blanks before the 1st, and trailing blanks after the last day.
            // emitted as real cells so the final week keeps its seven columns.
            if ((week === 0 && col < firstDay) || date > total) {
                cell.className = "day-empty";
                row.appendChild(cell);
                continue;
            }

            buildDayCell(cell, date, month, year);
            row.appendChild(cell);
            date++;
        }
        el.body.appendChild(row);
    }

    displayReminders();
}

function buildDayCell(cell, date, month, year) {
    cell.className = "date-picker";
    cell.dataset.date = date;
    cell.dataset.month = month + 1;
    cell.dataset.year = year;
    cell.dataset.monthName = MONTHS[month];

    if (date === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
        cell.classList.add("is-today");
    }
    if (selectedKey() === dayKey(year, month, date)) {
        cell.classList.add("is-selected");
    }

    const num = document.createElement("span");
    num.className = "date-num";
    num.textContent = date;
    cell.appendChild(num);

    const dayEvents = getEventsOnDate(date, month, year);
    if (!dayEvents.length) return;

    const stack = document.createElement("div");
    stack.className = "chip-stack";

    // every chip is rendered; the stylesheet hides the ones past MAX_CHIPS on desktop,
    // where they are wide labels, and shows them all on mobile, where they are dots
    dayEvents.forEach(function (event) {
        const chip = document.createElement("span");
        chip.className = "chip chip-" + typeSlug(event.type);
        if (event.done) chip.classList.add("is-done");
        chip.textContent = event.name || event.type;
        stack.appendChild(chip);
    });

    if (dayEvents.length > MAX_CHIPS) {
        const more = document.createElement("span");
        more.className = "chip-more";
        more.textContent = "+" + (dayEvents.length - MAX_CHIPS) + " more";
        stack.appendChild(more);
    }

    cell.appendChild(stack);
    cell.appendChild(buildTooltip(dayEvents, date, month, year));
}

// the cell caps its chips at MAX_CHIPS, so the tooltip carries the day's full list
function buildTooltip(dayEvents, date, month, year) {
    const tip = document.createElement("div");
    tip.className = "event-tooltip";

    const head = document.createElement("div");
    head.className = "tt-date";
    head.textContent = MONTHS[month].slice(0, 4) + " " + date + ", " + year;
    tip.appendChild(head);

    dayEvents.forEach(function (event) {
        const row = document.createElement("div");
        row.className = "tt-row chip-" + typeSlug(event.type);

        const dot = document.createElement("span");
        dot.className = "tt-dot";

        const name = document.createElement("span");
        name.className = "tt-name";
        name.textContent = event.name || event.type;

        const type = document.createElement("span");
        type.className = "tt-type";
        type.textContent = event.name ? event.type : "";

        row.append(dot, name, type);
        tip.appendChild(row);
    });

    return tip;
}

// ── Selected day's list ───────────────────────────────────────────────────────

// a journal link for a day already logged is struck out and made inert. the href is
// parked on data-href rather than left in place — pointer-events alone would still leave
// the anchor keyboard-focusable, and Enter would follow it.
function markJournalLinks() {
    const iso = toISO(selected);

    [[el.throwingLink, LOGGED.throwing], [el.workoutLink, LOGGED.workout]].forEach(function (pair) {
        const link = pair[0];
        if (!link) return;

        const logged = pair[1].has(iso);
        link.classList.toggle("is-logged", logged);
        link.setAttribute("aria-disabled", logged ? "true" : "false");

        if (logged && link.hasAttribute("href")) {
            link.dataset.href = link.getAttribute("href");
            link.removeAttribute("href");
        } else if (!logged && link.dataset.href) {
            link.setAttribute("href", link.dataset.href);
            delete link.dataset.href;
        }
    });
}

// showCalendar() ends by calling this, so every re-render — a day click, month
// navigation, a save — refreshes the panel from whatever `selected` now points at.
function displayReminders() {
    const list = getEventsOnDate(selected.getDate(), selected.getMonth(), selected.getFullYear());

    el.reminderTitle.textContent = isToday(selected) ? "Today" : "Selected Day";
    el.todayDate.textContent = selected.toLocaleDateString(undefined, {
        weekday: "short", month: "short", day: "numeric"
    });

    el.reminders.innerHTML = "";
    el.saveReminders.hidden = !list.length;
    markJournalLinks();

    if (!list.length) {
        const empty = document.createElement("li");
        empty.className = "empty-state";
        empty.textContent = "No workouts scheduled for this day. Add one above.";
        el.reminders.appendChild(empty);
        return;
    }

    list.forEach(function (event) {
        el.reminders.appendChild(buildReminder(event));
    });
}

// one row of the day's list. both checkboxes only stage intent — saveReminders()
// reads them back off the DOM, so nothing here writes to events or the db.
function buildReminder(event) {
    const label = event.name || event.type;

    const item = document.createElement("li");
    item.dataset.id = event.id;
    if (event.done) item.classList.add("is-done");
    // a logged workout has to look different from a merely ticked one, or there is no
    // way to tell what still needs its weights entered
    if (event.logged) item.classList.add("has-log");

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "reminder-check";
    check.checked = !!event.done;
    check.setAttribute("aria-label", "Mark " + label + " complete");
    check.addEventListener("change", function () {
        item.classList.toggle("is-done", check.checked);
    });

    const title = document.createElement("div");
    title.className = "reminder-title";
    title.textContent = label;

    const sub = document.createElement("div");
    sub.className = "reminder-sub";
    sub.textContent = event.type;

    const body = document.createElement("div");
    body.className = "reminder-body";
    body.append(title, sub);

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

    const remove = document.createElement("input");
    remove.type = "checkbox";
    remove.className = "reminder-delete";
    remove.setAttribute("aria-label", "Delete " + label);
    remove.title = "Delete on save";
    // a row cannot be both completed and deleted, so staging one drops the other
    remove.addEventListener("change", function () {
        item.classList.toggle("is-staged-delete", remove.checked);
        if (remove.checked) {
            check.checked = false;
            item.classList.remove("is-done");
        }
        check.disabled = remove.checked;
    });

    item.append(check, body, remove);
    return item;
}

async function saveReminders() {
    const date = toISO(selected);
    const workouts = [];
    const deleted = [];

    el.reminders.querySelectorAll("li[data-id]").forEach(function (item) {
        const id = Number(item.dataset.id);
        if (item.querySelector(".reminder-delete").checked) {
            deleted.push(id);
        } else {
            workouts.push({ id: id, done: item.querySelector(".reminder-check").checked });
        }
    });

    if (!workouts.length && !deleted.length) return;

    if (deleted.length && !confirm("Delete " + deleted.length + " workout" +
        (deleted.length > 1 ? "s" : "") + "? This cannot be undone.")) {
        return;
    }

    const result = await postJSON('/api/updateCalendarWorkouts',
        { date: date, workouts: workouts, deleted: deleted }, 'Update failed');
    if (!result) return;

    replaceDay(date, result.workouts);
    showCalendar(currentMonth, currentYear);
}

// ── Add-workout form ──────────────────────────────────────────────────────────

// fills one row's name dropdown from the type it just picked. takes the row rather
// than an id because cloned rows would collide on any id this markup carried.
async function GetWorkoutNamesByType(row) {
    const typeSelect = row.querySelector(".workout-type");
    const nameSelect = row.querySelector(".workout-name");
    const type = typeSelect.value;

    nameSelect.innerHTML = NAME_PLACEHOLDER;
    if (!type) return;

    const result = await postJSON('/api/getWorkoutNamesByType', { type: type }, 'Lookup failed');
    if (!result) return;

    // the type may have been changed again while this request was in flight; drop the
    // stale response rather than filling the row with the wrong names
    if (typeSelect.value !== type) return;

    // the throwing table keys its workouts off day_name, warmup off name, everything else off workout_name
    const keyMap = {
        Throwing: "day_name",
        Warmup: "name"
    }
    const key = keyMap[type] || "workout_name";


    result.forEach(function (item) {
        const option = document.createElement("option");
        option.value = item[key];
        option.textContent = item[key];
        nameSelect.appendChild(option);
    });
}

function addWorkoutRow() {
    const row = el.rows.firstElementChild.cloneNode(true);
    row.querySelector(".workout-type").value = "";
    row.querySelector(".workout-name").innerHTML = NAME_PLACEHOLDER;
    row.style.removeProperty("--row-color");
    el.rows.appendChild(row);
    clearRow(row);
    syncRowState();
    row.querySelector(".workout-type").focus();
}

// the remove control is pointless when one row is left, and the stylesheet hides it
// unless the container is marked multi
function syncRowState() {
    el.rows.classList.toggle("is-multi", el.rows.children.length > 1);
}

function resetForm() {
    el.date.value = "";
    // drop every row but the first, then clear it
    while (el.rows.children.length > 1) el.rows.removeChild(el.rows.lastElementChild);
    const first = el.rows.firstElementChild;
    first.querySelector(".workout-type").value = "";
    first.querySelector(".workout-name").innerHTML = NAME_PLACEHOLDER;
    first.style.removeProperty("--row-color");
    syncRowState();
}

// the form's rows as {type, name} pairs, or null once a half-filled row has been
// flagged to the user. for..of because returning from a forEach only skips a row.
async function addWorkout() {
    const date = el.date.value;
    if (!date) {
        el.date.focus();
        return;
    }

    const workouts = collectWorkoutRows();
    if (!workouts) return;

    const result = await postJSON('/api/addWorkouttoCalendar',
        { date: date, workouts: workouts }, 'Save failed');
    if (!result) return;

    replaceDay(date, result.workouts);
    resetForm();

    // jump the view to the month the workouts landed in and select that day, so the
    // panel shows what was just saved rather than whichever day was open before
    const d = fromISO(date);
    selected = d;
    currentMonth = d.getMonth();
    currentYear = d.getFullYear();
    showCalendar(currentMonth, currentYear);
}

function collectWorkoutRows() {
    const rows = el.rows.querySelectorAll(".workout-row");
    const workouts = [];

    for (const row of rows) {
        const typeSelect = row.querySelector(".workout-type");
        const nameSelect = row.querySelector(".workout-name");
        const type = typeSelect.value;
        const name = nameSelect.value.trim();

        // a row with nothing picked at all is an empty row, not an error
        if (!type && !name) continue;

        if (!type) {
            alert("Pick a workout type for every row before saving.");
            typeSelect.focus();
            return null;
        }
        if (!name) {
            alert("Pick a workout name for every row before saving.");
            nameSelect.focus();
            return null;
        }

        workouts.push({ type: type, name: name });
    }

    if (!workouts.length) {
        alert("Add at least one workout before saving.");
        rows[0].querySelector(".workout-type").focus();
        return null;
    }

    return workouts;
}

// ── Navigation ────────────────────────────────────────────────────────────────

function next() {
    if (currentMonth === 11) { currentMonth = 0; currentYear++; }
    else { currentMonth++; }
    showCalendar(currentMonth, currentYear);
}

function previous() {
    if (currentMonth === 0) { currentMonth = 11; currentYear--; }
    else { currentMonth--; }
    showCalendar(currentMonth, currentYear);
}

function jump() {
    currentMonth = parseInt(el.month.value, 10);
    currentYear = parseInt(el.year.value, 10);
    showCalendar(currentMonth, currentYear);
}

function jumpToday() {
    selected = new Date(today);
    el.date.value = toISO(selected);
    currentMonth = today.getMonth();
    currentYear = today.getFullYear();
    showCalendar(currentMonth, currentYear);
}

// ── Static chrome ─────────────────────────────────────────────────────────────

function buildHead() {
    const row = document.createElement("tr");
    DAYS.forEach(function (day) {
        const th = document.createElement("th");
        th.dataset.days = day;
        th.textContent = day;
        row.appendChild(th);
    });
    el.head.innerHTML = "";
    el.head.appendChild(row);
}

function buildYears() {
    // a window around the current year, so the app keeps working past 2027
    const start = today.getFullYear() - 2;
    const end = today.getFullYear() + 2;
    el.year.innerHTML = "";
    for (let year = start; year <= end; year++) {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        el.year.appendChild(option);
    }
}

function buildLegend() {
    el.legend.innerHTML = "";
    TYPES.forEach(function (type) {
        const item = document.createElement("span");
        item.className = "legend-item chip-" + typeSlug(type);

        const swatch = document.createElement("span");
        swatch.className = "legend-swatch";

        const label = document.createElement("span");
        label.textContent = type;

        item.append(swatch, label);
        el.legend.appendChild(item);
    });
}

// ── Wiring ────────────────────────────────────────────────────────────────────

function wireEvents() {
    document.getElementById("previous").addEventListener("click", previous);
    document.getElementById("next").addEventListener("click", next);
    document.getElementById("jumpToday").addEventListener("click", jumpToday);
    document.getElementById("addWorkout").addEventListener("click", addWorkout);
    document.getElementById("addWorkoutRow").addEventListener("click", addWorkoutRow);
    el.saveReminders.addEventListener("click", saveReminders);
    el.month.addEventListener("change", jump);
    el.year.addEventListener("change", jump);

    // delegated, so cloned rows are wired without rebinding
    el.rows.addEventListener("click", function (e) {
        const remove = e.target.closest(".btn-remove-row");
        if (!remove || el.rows.children.length === 1) return;
        remove.closest(".workout-row").remove();
        syncRowState();
    });

    // delegated too: load the picked type's names, and tint the row's left edge with
    // the colour that type gets on the calendar
    el.rows.addEventListener("change", function (e) {
        if (!e.target.classList.contains("workout-type")) return;
        const row = e.target.closest(".workout-row");
        const type = e.target.value;

        GetWorkoutNamesByType(row);

        if (type) {
            row.style.setProperty("--row-color", "var(--type-" + typeSlug(type) + ")");
        } else {
            row.style.removeProperty("--row-color");
        }
    });

    // clicking a day selects it, loads it into the form's date field, and swaps the
    // reminder panel to that day. paging months deliberately leaves the selection
    // alone — the panel keeps the picked day rather than emptying itself.
    el.body.addEventListener("click", function (e) {
        const cell = e.target.closest("td.date-picker");
        if (!cell) return;

        const y = Number(cell.dataset.year);
        const m = Number(cell.dataset.month) - 1;
        const d = Number(cell.dataset.date);

        selected = new Date(y, m, d);
        el.date.value = toISO(selected);
        showCalendar(currentMonth, currentYear);
    });
}

// ── Modals ────────────────────────────────────────────────────────────────────
//
// The weight log and the read-only session view. The warmup and workout panels
// that used to share these now live on the workout input page.

// a modal always opens at the top. the panel keeps whatever scroll offset it was
// hidden at, and the save button sits at the very bottom - so closing by saving
// re-showed the panel mid-scroll, and the first touch gesture went nowhere
function openModal(id) {
    const modal = document.getElementById(id);
    const inner = modal.querySelector('.modal-inner');
    if (inner) inner.scrollTop = 0;
    modal.classList.add('active');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    const inner = modal.querySelector('.modal-inner');
    if (inner) inner.scrollTop = 0;
    modal.classList.remove('active');
}

function wireModals() {
    // Close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.modal));
    });
    // Click outside to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal) closeModal(modal.id);
        });
    });
}

// ── Boot ──────────────────────────────────────────────────────────────────────

function init() {
    buildHead();
    buildYears();
    buildLegend();
    wireEvents();
    wireModals();
    showCalendar(currentMonth, currentYear);
}

init();

// ── Weight log ────────────────────────────────────────────────────────────────
//
// Clicking a workout in the Today card opens its log. The row carries the
// training_calendar_daily_wkouts.ID, so the log's identity needs no lookup.

// nothing to log against a throwing day or a warmup, so those open read-only
const VIEW_ONLY_TYPES = ["Throwing", "Warmup"];

const weightRows = document.getElementById("weight-rows");
const weightName = document.getElementById("weight-log-name");
const weightMeta = document.getElementById("weight-log-meta");
const weightNotes = document.getElementById("weight-log-notes");
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
        ? "Greyed numbers are what you last logged on " + data.prefilled_from
        : "";
    weightNotes.innerHTML = data.notes || ""; //pre-formatted with <br> by the backend
    weightNotes.classList.toggle("hidden", !data.notes);

    weightRows.innerHTML = "";
    data.exercises.forEach(function (ex) { weightRows.appendChild(buildWeightRow(ex)); });
    openModal("logWeights-modal");
}

// last session's numbers stay placeholders, never values: an untouched row must save
// nothing rather than last session's numbers. the prescribed sets/reps is the exception -
// it is what this workout asks for, so it fills the field as a real value
function buildWeightRow(ex) {
    const row = document.getElementById("weight-row-template").content.firstElementChild.cloneNode(true);
    const placeholder = ex.placeholder || {};

    // the prescription is the starting point, so a session done as written only needs its
    // weights typed in. anything logged against this day wins - that is what was actually
    // done - and a hand-added row has no prescription to fall back on
    const setsRepsDone = ex.sets_reps_done === null || ex.sets_reps_done === undefined
        || ex.sets_reps_done === "" ? ex.sets_reps_rx : ex.sets_reps_done;

    // the prescribed notes are a cue to read, not something the session records, so unlike
    // the prescribed sets/reps they stay greyed out and an untouched row saves nothing.
    // they beat last session's note to the slot: that is what this workout asks for today
    const notePlaceholder = ex.ex_notes_rx || placeholder.weight_note;

    const label = row.querySelector(".row-ex-label");
    // the block is what the workout groups this exercise under (A1, B2, ...) - it comes
    // from the definition and is not something the log edits, so it reads as a tag
    label.querySelector(".row-ex-block-tag").textContent = ex.ex_block || "";
    label.querySelector(".row-ex-name-text").textContent = ex.ex_name || "";
    row.dataset.exBlock = ex.ex_block || "";
    row.dataset.exName = ex.ex_name || "";
    row.dataset.setsRepsRx = ex.sets_reps_rx || "";

    const fields = [
        [".row-sets-reps-done", setsRepsDone, placeholder.sets_reps_done, "Sets/Reps"],
        [".row-weight-value", ex.weight_value, placeholder.weight_value, "Weight"],
        [".row-weight-note", ex.weight_note, notePlaceholder, "Note"]
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
    const row = buildWeightRow({
        ex_block: null, ex_name: null, sets_reps_rx: null, ex_notes_rx: null,
        sets_reps_done: null, weight_value: null, weight_note: null, placeholder: null
    });
    weightRows.appendChild(row);
    clearRow(row);
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
        .map(function (e) {
            return e.id === loggingFor.id ? Object.assign({}, e, { done: 1, logged: 1 }) : e;
        }));

    closeModal("logWeights-modal");
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

// the notes fields carry backend-injected <br> and the templates render them with | safe,
// so they stay raw. everything else here is free text the templates auto-escape, and
// concatenating it into innerHTML would both widen that trust boundary and swallow a name
// like "DB Press <45lb" as markup
function escapeHtml(value) {
    const holder = document.createElement("div");
    holder.textContent = value === null || value === undefined ? "" : value;
    return holder.innerHTML;
}

// both views reuse the layout the record already has on the workout input page: its
// View Warmups tab and its View Throwing Days tab
function warmupMarkup(warmup) {
    const columns = [
        ["Name", escapeHtml(warmup.name)], ["Rollout Exercises", warmup.rollout_ex],
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
    const meta = '<span class="day-meta">' + escapeHtml(day.date) + " &middot; " +
        escapeHtml(day.session_type) + "</span>";
    const notes = day.notes
        ? '<div class="day-notes"><h4>Day Breakdown / Notes</h4><p>' + day.notes + "</p></div>"
        : "";
    const rows = (day.drills || []).map(function (drill) {
        return '<tr><td data-label="Set">' + escapeHtml(drill.set) +
            '</td><td data-label="Drill">' + escapeHtml(drill.drill_name) +
            '</td><td data-label="Ball">' + escapeHtml(drill.ball_weight) +
            '</td><td data-label="Throws">' + escapeHtml(drill.throw_count) +
            '</td><td data-label="Notes">' + (drill.drill_notes || "") + "</td></tr>";
    }).join("");
    return meta + notes +
        '<div class="table-scroll"><table><thead><tr><th>Set</th><th>Drill</th><th>Ball</th>' +
        "<th>Throws</th><th>Notes</th></tr></thead><tbody>" + rows + "</tbody></table></div>";
}

document.getElementById("addWeightRow").addEventListener("click", addWeightRow);
document.getElementById("saveWeightLog").addEventListener("click", submitWeightLog);
