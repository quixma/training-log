// Training Calendar
//
// Events live in memory only for now — the backend pass replaces `events` with rows
// fetched from the workouts table and makes add/delete/complete hit API routes.
// Everything below reads through getEventsOnDate(), so swapping the source out is the
// only change the render path needs.

//-----------POPULATE WORKOUT NAME BY SELECTED TYPE-----------
const workoutTypeSelect = document.getElementById("workout-type")
const workoutName = document.getElementById("workout-name")
workoutTypeSelect.addEventListener("change", GetWorkoutNamesByType);

async function GetWorkoutNamesByType() {
    const response = await fetch('/api/getWorkoutNamesByType',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({ type: workoutTypeSelect.value })
        });

    if (!response.ok) {
        console.log('Update failed:', await response.text());
        alert('Update failed. See console.');
        return;
    }

    const result = await response.json();

    workoutName.innerHTML = '<option value="">Workout Name</option>';
    if (workoutTypeSelect.value == "Throwing") {
        result.forEach(row => {
            const option = document.createElement('option');
            option.value = row["day_name"];
            option.textContent = row["day_name"];
            workoutName.appendChild(option);
        });
    }
    else {
        result.forEach(row => {
            const option = document.createElement('option');
            option.value = row["workout_name"];
            option.textContent = row["workout_name"];
            workoutName.appendChild(option);
        });
    }
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// WORKOUT_TYPES is set by the template from models.WORKOUT_TYPES
const TYPES = typeof WORKOUT_TYPES !== "undefined" ? WORKOUT_TYPES : [];

const MAX_CHIPS = 3;   // chips that fit a day cell before it collapses to "+N more"

// ── PLACEHOLDER DATA — delete this block when the backend supplies events ──────
let events = [
    { id: 1, date: isoOffset(0), type: "Lift", name: "Lower Body", done: true },
    { id: 2, date: isoOffset(0), type: "Armcare", name: "Arm Care", done: false },
    { id: 3, date: isoOffset(0), type: "Mobility", name: "Hips", done: false },
    { id: 4, date: isoOffset(1), type: "Conditioning", name: "Sprints", done: false },
    { id: 5, date: isoOffset(-2), type: "Lift", name: "Upper Body", done: true },
    { id: 6, date: isoOffset(-2), type: "Back/Core", name: "Anti-Rotation", done: true },
    { id: 7, date: isoOffset(-2), type: "Armcare", name: "Arm Care", done: true },
    { id: 8, date: isoOffset(-2), type: "Mobility", name: "T-Spine", done: false },
    { id: 9, date: isoOffset(4), type: "Individual Workout", name: "Med Ball", done: false }
];
let eventIdCounter = events.length + 1;

// today +/- n days, as YYYY-MM-DD, so the sample chips always land near the current month
function isoOffset(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return toISO(d);
}
// ── END PLACEHOLDER DATA ──────────────────────────────────────────────────────

const today = new Date();
let currentMonth = today.getMonth();
let currentYear = today.getFullYear();
let selectedKey = null;    // the clicked day, as "YYYY-M-D"

const el = {
    body: document.getElementById("calendar-body"),
    head: document.getElementById("thead-month"),
    monthAndYear: document.getElementById("monthAndYear"),
    month: document.getElementById("month"),
    year: document.getElementById("year"),
    reminders: document.getElementById("reminderList"),
    todayDate: document.getElementById("todayDate"),
    rows: document.getElementById("workoutRows"),
    date: document.getElementById("eventDate"),
    legend: document.getElementById("chipLegend")
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// local-time YYYY-MM-DD. toISOString() would shift the date across the UTC
// boundary for anyone west of Greenwich, landing workouts on the wrong day.
function toISO(d) {
    return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
}

// "YYYY-MM-DD" -> local Date. new Date(str) parses a bare date as UTC midnight,
// which is the same off-by-one-day problem in the other direction.
function fromISO(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
}

function dayKey(y, m, d) { return y + "-" + m + "-" + d; }

// 'Back/Core' -> 'back-core', matching the .chip-* classes in the stylesheet
function typeSlug(type) {
    return String(type).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function daysInMonth(month, year) {
    return new Date(year, month + 1, 0).getDate();
}

function getEventsOnDate(date, month, year) {
    return events.filter(function (event) {
        const d = fromISO(event.date);
        return d.getDate() === date && d.getMonth() === month && d.getFullYear() === year;
    });
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

// the cell shows at most three chips, so the tooltip carries the day's full list
function buildTooltip(dayEvents, date, month, year) {
    const tip = document.createElement("div");
    tip.className = "event-tooltip";

    const head = document.createElement("div");
    head.className = "tt-date";
    head.textContent = MONTHS[month].slice(0, 3) + " " + date + ", " + year;
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

    if (!list.length) {
        const empty = document.createElement("li");
        empty.className = "empty-state";
        empty.textContent = "No workouts scheduled for today. Add one above.";
        el.reminders.appendChild(empty);
        return;
    }

    list.forEach(function (event) {
        const item = document.createElement("li");
        if (event.done) item.classList.add("is-done");

        const check = document.createElement("input");
        check.type = "checkbox";
        check.className = "reminder-check";
        check.checked = !!event.done;
        check.setAttribute("aria-label", "Mark " + (event.name || event.type) + " complete");
        // TODO(backend): persist the completed flag, then re-render from the response
        check.addEventListener("change", function () {
            event.done = check.checked;
            showCalendar(currentMonth, currentYear);
        });

        const body = document.createElement("div");
        body.className = "reminder-body";

        const title = document.createElement("div");
        title.className = "reminder-title";
        title.textContent = event.name || event.type;

        const sub = document.createElement("div");
        sub.className = "reminder-sub";
        sub.textContent = event.type;

        body.append(title, sub);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn-remove-event";
        remove.innerHTML = "&times;";
        remove.setAttribute("aria-label", "Delete " + (event.name || event.type));
        remove.addEventListener("click", function () { deleteEvent(event.id); });

        item.append(check, body, remove);
        el.reminders.appendChild(item);
    });
}

// ── Add / delete ──────────────────────────────────────────────────────────────

function addEvent() {
    const date = el.date.value;
    if (!date) {
        el.date.focus();
        return;
    }

    const rows = el.rows.querySelectorAll(".workout-row");
    let added = 0;

    rows.forEach(function (row) {
        const type = row.querySelector(".workout-type").value;
        const name = row.querySelector(".workout-name").value.trim();
        if (!type) return;   // a row with no type picked is an empty row, not an error

        // TODO(backend): POST instead of pushing, and re-render from the response
        events.push({ id: eventIdCounter++, date: date, type: type, name: name, done: false });
        added++;
    });

    if (!added) {
        rows[0].querySelector(".workout-type").focus();
        return;
    }

    resetForm();

    // jump the view to the month the workouts landed in, so they are visible
    const d = fromISO(date);
    currentMonth = d.getMonth();
    currentYear = d.getFullYear();
    showCalendar(currentMonth, currentYear);
}

function deleteEvent(eventId) {
    const i = events.findIndex(function (event) { return event.id === eventId; });
    if (i === -1) return;
    // TODO(backend): DELETE the row, then re-render from the response
    events.splice(i, 1);
    showCalendar(currentMonth, currentYear);
}

function resetForm() {
    el.date.value = "";
    // drop every row but the first, then clear it
    while (el.rows.children.length > 1) el.rows.removeChild(el.rows.lastElementChild);
    const first = el.rows.firstElementChild;
    first.querySelector(".workout-type").value = "";
    first.querySelector(".workout-name").value = "";
    first.style.removeProperty("--row-color");
    syncRowState();
}

// ── Workout rows ──────────────────────────────────────────────────────────────

function addWorkoutRow() {
    const row = el.rows.firstElementChild.cloneNode(true);
    row.querySelector(".workout-type").value = "";
    row.querySelector(".workout-name").value = "";
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

document.getElementById("previous").addEventListener("click", previous);
document.getElementById("next").addEventListener("click", next);
document.getElementById("jumpToday").addEventListener("click", jumpToday);
document.getElementById("addEvent").addEventListener("click", addEvent);
document.getElementById("addWorkoutRow").addEventListener("click", addWorkoutRow);
el.month.addEventListener("change", jump);
el.year.addEventListener("change", jump);

// delegated, so cloned rows are wired without rebinding
el.rows.addEventListener("click", function (e) {
    const remove = e.target.closest(".btn-remove-row");
    if (!remove || el.rows.children.length === 1) return;
    remove.closest(".workout-row").remove();
    syncRowState();
});

// tint a row's left edge with the colour its type gets on the calendar
el.rows.addEventListener("change", function (e) {
    if (!e.target.classList.contains("workout-type")) return;
    const row = e.target.closest(".workout-row");
    const type = e.target.value;
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

buildHead();
buildYears();
buildLegend();
showCalendar(currentMonth, currentYear);
