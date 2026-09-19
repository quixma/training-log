var create_reportBTN = document.getElementById('create_report')

var movementChart, releaseChart, veloChart, rhhZoneChart, lhhZoneChart;

//last payload from /api/outing_report_data, kept so the grouping toggles can re-render without refetching
var reportData = null;

//tab control for the report tabs
function openTab(evt, tabName) {
    document.querySelectorAll('.tabcontent').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tablinks').forEach(t => t.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}

create_reportBTN.onclick = function () { //generate outing report from the selected files
    var file1 = document.getElementById('file1').value;
    var file2 = document.getElementById('file2').value;
    var file3 = document.getElementById('file3').value;

    //the backend identifies each file by its header columns, so it only needs the pBp file plus at
    //least one postgame report - which slot they were picked in doesn't matter
    if ([file1, file2, file3].filter(Boolean).length < 2) {
        console.log("Select the pBp file and at least one postgame report file.")
        return;
    }
    else {
        fetch('/api/outing_report_data',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify({ file1: file1, file2: file2, file3: file3 })
            })
            .then(response => response.json().then(body => {
                if (!response.ok) {
                    throw new Error(body.error || `HTTP ${response.status}`);
                }
                return body;
            }))
            .then(data => {
                reportData = data;
                updateScatterChart(movementChart, data.movement, 'hb', 'ivb');
                updateScatterChart(releaseChart, data.release, 'rel_x', 'rel_z');
                updateVeloChart(data.velo);
                PitchCharts.renderLegend('pitch_legend', data.movement || [], 'pitch_type');
                updateScatterChart(rhhZoneChart, data.locations_rhh, 'x', 'y');
                updateScatterChart(lhhZoneChart, data.locations_lhh, 'x', 'y');
                fillReportTable('summary_body', data.summary, SUMMARY_KEYS);
                fillReportTable('pitch_mvmt_body', data.pitch_mvmt, MVMT_KEYS);
                Object.keys(GROUPED_TABLE_KEYS).forEach(renderGroupedTable);
            })
            .catch(error => {
                console.error('Generate report failed:', error);
                alert(`Generate report failed: ${error.message}`);
            });
    }
}

const SUMMARY_KEYS = ['fps_pct', 'ahead_pct', 'early_ahead_pct', 'two_k_so_pct', 'k_pct', 'bb_pct', 'k_minus_bb_pct', 'csw_pct'];
const MVMT_KEYS = ['pitch_count', 'velo', 'max_velo', 'ivb', 'hb', 'rel_z', 'rel_x', 'ext'];

//the three tables that can be grouped by pitch type or by batter hand
const GROUPED_TABLE_KEYS = {
    strikes: ['zone_pct', 'two_k_zone_pct', 'heart_pct'],
    miss: ['csw_pct', 'whiff_pct', 'z_whiff_pct', 'o_whiff_pct', 'chase_pct'],
    damage: ['woba', 'xwoba', 'xwobacon', 'babip', 'hard_hit_pct', 'gb_pct', 'fb_pct']
};

const GROUP_LABELS = { pitch: 'Pitch Type', hand: 'Batter Hand' };

//grouping currently shown for each of those tables; each one toggles independently
const tableGroupings = { strikes: 'hand', miss: 'hand', damage: 'hand' };

//one row per group, first column the group name (splits with zero pitches thrown are already
//excluded by the backend, which also leads each grouped table with its Overall row)
function fillReportTable(bodyId, rows, keys) {
    const body = document.getElementById(bodyId);
    body.innerHTML = '';
    rows.forEach(row => {
        const tr = document.createElement('tr');
        if (row.group === 'Overall') tr.classList.add('overall-row');
        [row.group, ...keys.map(key => row[key])].forEach(val => {
            const td = document.createElement('td');
            td.textContent = val;
            tr.appendChild(td);
        });
        body.appendChild(tr);
    });
}

//redraws one grouped table from the cached payload under its current grouping, and syncs its
//toggle buttons and first column header to match
function renderGroupedTable(table) {
    const grouping = tableGroupings[table];
    const rows = reportData ? reportData[table][grouping] || [] : [];

    fillReportTable(`${table}_body`, rows, GROUPED_TABLE_KEYS[table]);
    document.querySelector(`.group-label[data-table="${table}"]`).textContent = GROUP_LABELS[grouping];
    document.querySelectorAll(`.group-toggle[data-table="${table}"] .group-btn`).forEach(btn => {
        btn.classList.toggle('active', btn.dataset.group === grouping);
    });
}

//replaces a single-dataset scatter chart's points in place, colored by pitch type
function updateScatterChart(chart, rows, xKey, yKey) {
    const points = rows.map(r => Object.assign({ x: r[xKey], y: r[yKey] }, r));
    chart.data.datasets[0].data = points;
    chart.update();
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('.group-toggle .group-btn').forEach(btn => {
        btn.onclick = () => {
            const table = btn.closest('.group-toggle').dataset.table;
            tableGroupings[table] = btn.dataset.group;
            renderGroupedTable(table);
        };
    });

    initializeMovementChart();
    initializeReleaseChart();
    initializeVeloChart();
    rhhZoneChart = initializeZoneChart('rhh_zone_chart', 'Right-Handed Hitters', 'R');
    lhhZoneChart = initializeZoneChart('lhh_zone_chart', 'Left-Handed Hitters', 'L');
});

//pitch movement plot: horizontal break (x) vs induced vertical break (y), signed inches, centered on the mound
function initializeMovementChart() {
    const ctx = document.getElementById('movement_chart').getContext('2d');
    movementChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                data: [],
                ...PitchCharts.scatterPointSpec('pitch_type')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Pitch Movement (in)' },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.raw.pitch_type}: ${context.raw.velo} mph, ${context.raw.hb} hb, ${context.raw.ivb} ivb`
                    }
                }
            },
            scales: {
                x: {
                    min: -25,
                    max: 25,
                    ticks: { stepSize: 5 },
                    grid: PitchCharts.zeroLineGrid(),
                    title: { display: true, text: 'Horizontal Movement (in)' }
                },
                y: {
                    min: -25,
                    max: 25,
                    ticks: { stepSize: 5 },
                    grid: PitchCharts.zeroLineGrid(),
                    title: { display: true, text: 'Vertical Movement (in)' }
                }
            }
        }
    });
}

//release point plot: release side (x) vs release height (y), feet
function initializeReleaseChart() {
    const ctx = document.getElementById('release_chart').getContext('2d');
    releaseChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                data: [],
                ...PitchCharts.scatterPointSpec('pitch_type')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Release Point (ft)' },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.raw.pitch_type}: ${context.raw.rel_x.toFixed(2)} ft side, ${context.raw.rel_z.toFixed(2)} ft height`
                    }
                }
            },
            scales: {
                x: { ticks: { stepSize: 0.1 }, title: { display: true, text: 'Release Side (ft)' } },
                y: { ticks: { stepSize: 0.1 }, title: { display: true, text: 'Release Height (ft)' } }
            }
        }
    });
}

//velo by pitch type: pitch number (x) vs velocity (y), one line per pitch type
function initializeVeloChart() {
    const ctx = document.getElementById('velo_chart').getContext('2d');
    veloChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Velocity by Pitch' }
            },
            scales: {
                x: { type: 'linear', title: { display: true, text: 'Pitch #' } },
                y: { title: { display: true, text: 'Velocity (mph)' } }
            }
        }
    });
}

function updateVeloChart(rows) {
    const byType = {};
    rows.forEach(r => {
        if (!byType[r.pitch_type]) byType[r.pitch_type] = [];
        byType[r.pitch_type].push({ x: r.pitch_num, y: r.velo });
    });

    veloChart.data.datasets = Object.keys(byType).map(pitchType => ({
        label: pitchType,
        data: byType[pitchType],
        borderColor: PitchCharts.color(pitchType),
        backgroundColor: PitchCharts.color(pitchType),
        showLine: true,
        fill: false,
        pointRadius: 2
    }));
    veloChart.update();
}

//pitch location plot: same strike zone dimensions as the bullpen report's zone chart,
//one colored dot per pitch type, hover shows velo/IVB/HB/result
function initializeZoneChart(canvasId, titleText, batterHand) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
        type: 'scatter',
        plugins: [PitchCharts.zoneDecorPlugin(batterHand)],
        data: {
            datasets: [{
                label: titleText,
                data: [],
                ...PitchCharts.scatterPointSpec('pitch_type')
            }]
        },
        options: {
            maintainAspectRatio: false,
            responsive: true,
            plugins: {
                title: { display: true, text: titleText },
                annotation: { annotations: PitchCharts.strikeZoneAnnotations() },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function (context) {
                            const p = context.raw;
                            return `${p.pitch_type}: ${p.velo} mph, ${p.ivb} ivb, ${p.hb} hb, ${p.result}`;
                        }
                    }
                },
                legend: { display: false }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    min: -1.9,
                    max: 1.9,
                    ticks: { display: false },
                    title: { display: false },
                    grid: { display: false }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    min: 0,
                    max: 3.9,
                    ticks: { display: false },
                    title: { display: false },
                    grid: { display: false }
                }
            }
        }
    });
}

