// Training Calendar
//
// The template inlines every logged workout as INITIAL_WORKOUTS, so `events` is
// populated before the first render and month navigation costs no round trip.
// Every read goes through getEventsOnDate(); the save handlers are the only writers,
// and both replace the affected day from the route's response.

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

const MAX_CHIPS = 5;   // chips that fit a day cell before it collapses to "+N more"
const NAME_PLACEHOLDER = '<option value="">Workout name</option>';

// ── State ─────────────────────────────────────────────────────────────────────

let events = INITIAL;
const today = new Date();
let currentMonth = today.getMonth();
let currentYear = today.getFullYear();
let selectedKey = null;    // the clicked day, as "YYYY-M-D"

// ── Elements ──────────────────────────────────────────────────────────────────

const el = {
    body: document.getElementById("calendar-body"),
    head: document.getElementById("thead-month"),
    monthAndYear: document.getElementById("monthAndYear"),
    month: document.getElementById("month"),
    year: document.getElementById("year"),
    reminders: document.getElementById("reminderList"),
    saveReminders: document.getElementById("saveReminders"),
    todayDate: document.getElementById("todayDate"),
    rows: document.getElementById("workoutRows"),
    date: document.getElementById("eventDate"),
    legend: document.getElementById("chipLegend")
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
    if (selectedKey === dayKey(year, month, date)) {
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

// ── Today's list ──────────────────────────────────────────────────────────────

function displayReminders() {
    const list = getEventsOnDate(today.getDate(), today.getMonth(), today.getFullYear());

    el.todayDate.textContent = today.toLocaleDateString(undefined, {
        weekday: "short", month: "short", day: "numeric"
    });

    el.reminders.innerHTML = "";
    el.saveReminders.hidden = !list.length;

    if (!list.length) {
        const empty = document.createElement("li");
        empty.className = "empty-state";
        empty.textContent = "No workouts scheduled for today. Add one above.";
        el.reminders.appendChild(empty);
        return;
    }

    list.forEach(function (event) {
        el.reminders.appendChild(buildReminder(event));
    });
}

// one row of the Today list. both checkboxes only stage intent — saveReminders()
// reads them back off the DOM, so nothing here writes to events or the db.
function buildReminder(event) {
    const label = event.name || event.type;

    const item = document.createElement("li");
    item.dataset.id = event.id;
    if (event.done) item.classList.add("is-done");

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
    const date = toISO(today);
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

    // jump the view to the month the workouts landed in, so they are visible
    const d = fromISO(date);
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

    // clicking a day selects it and loads it into the form's date field
    el.body.addEventListener("click", function (e) {
        const cell = e.target.closest("td.date-picker");
        if (!cell) return;

        const y = Number(cell.dataset.year);
        const m = Number(cell.dataset.month) - 1;
        const d = Number(cell.dataset.date);

        selectedKey = dayKey(y, m, d);
        el.date.value = toISO(new Date(y, m, d));
        showCalendar(currentMonth, currentYear);
    });
}

// ── Boot ──────────────────────────────────────────────────────────────────────

function init() {
    buildHead();
    buildYears();
    buildLegend();
    wireEvents();
    showCalendar(currentMonth, currentYear);
}

init();
