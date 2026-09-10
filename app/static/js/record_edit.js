//shared helpers for the edit modals on the dashboards. the view tabs show one saved
//record at a time and carry its id on the section card, so editing means: fetch that
//record's stored text, populate the modal, post it back, then reload so the tables
//show what is now in the database.

//the display payloads line-break notes for the tables, so the modals load their values
//from here instead - this returns the text exactly as it is stored
async function fetchRecordForEdit(recordType, recordId) {
    if (!recordId) {
        alert("Nothing loaded to edit yet.");
        return null;
    }

    const response = await fetch('/api/getRecordForEdit',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({ record_type: recordType, id: Number(recordId) })
        });

    if (!response.ok) {
        console.log('Load failed:', await response.text());
        alert('Could not load that record. See console.');
        return null;
    }
    return await response.json();
}

//save and delete share this: post, then reload so every table on the page reflects the change
async function submitRecordChange(url, payload, failureMessage) {
    const response = await fetch(url,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(payload)
        });

    if (!response.ok) {
        console.log(failureMessage, await response.text());
        alert(`${failureMessage} See console.`);
        return;
    }
    window.location.reload();
}

//an edit button is only good for a record that is actually on screen
function syncEditButton(button, card) {
    if (button && card) {
        button.classList.toggle('hidden', !card.dataset.recordId);
    }
}

//the repeating rows (exercises, drills) are clones of a <template> in the page. fieldMap
//pairs a field's class selector with its key in the payload, so the same helpers serve
//every row shape: {'.row-ex-name': 'ex_name', ...}
function addModalRow(containerId, templateId, values) {
    const container = document.getElementById(containerId);
    const row = document.getElementById(templateId).content.firstElementChild.cloneNode(true);

    if (values) {
        Object.entries(values).forEach(([selector, value]) => {
            const field = row.querySelector(selector);
            if (field) {
                field.value = value || "";
            }
        });
    }
    container.appendChild(row);
    return row;
}

function removeModalRow(containerId) {
    const container = document.getElementById(containerId);
    if (container.lastElementChild) {
        container.removeChild(container.lastElementChild);
    }
}

function fillModalRows(containerId, templateId, items, fieldMap) {
    document.getElementById(containerId).innerHTML = "";

    if (!items || !items.length) { //a record with no rows still opens with one blank row to type into
        addModalRow(containerId, templateId);
        return;
    }

    items.forEach(item => {
        const values = {};
        Object.entries(fieldMap).forEach(([selector, key]) => { values[selector] = item[key]; });
        addModalRow(containerId, templateId, values);
    });
}

//reads the rows back in display order, which is the order they get stored in
function readModalRows(containerId, fieldMap) {
    return Array.from(document.getElementById(containerId).children).map(row => {
        const values = {};
        Object.entries(fieldMap).forEach(([selector, key]) => {
            const field = row.querySelector(selector);
            values[key] = field ? field.value : "";
        });
        return values;
    });
}
