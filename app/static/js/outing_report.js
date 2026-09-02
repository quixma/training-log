var create_reportBTN = document.getElementById('create_report')

var movementChart, releaseChart, veloChart, rhhZoneChart, lhhZoneChart;

create_reportBTN.onclick = function () { //generate outing report from the two selected files
    var file1 = document.getElementById('file1').value;
    var file2 = document.getElementById('file2').value;

    if (!file1 || !file2) {
        console.log("Select both files.")
        return;
    }
    else {
        fetch('/api/outing_report_data',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify({ file1: file1, file2: file2 })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                updateScatterChart(movementChart, data.movement, 'hb', 'ivb');
                updateScatterChart(releaseChart, data.release, 'rel_x', 'rel_z');
                updateVeloChart(data.velo);
                updateScatterChart(rhhZoneChart, data.locations_rhh, 'x', 'y');
                updateScatterChart(lhhZoneChart, data.locations_lhh, 'x', 'y');
                fillPitchTypeTable('pitch_mvmt_body', data.pitch_mvmt, ['pitch_count', 'velo', 'max_velo', 'ivb', 'hb', 'rel_z', 'rel_x', 'ext']);
                fillPitchTypeTable('strikes_body', data.strikes, ['zone_pct', 'two_k_zone_pct', 'heart_pct']);
                fillPitchTypeTable('miss_body', data.miss, ['csw_pct', 'whiff_pct', 'z_whiff_pct', 'o_whiff_pct', 'chase_pct']);
                fillPitchTypeTable('damage_body', data.damage, ['woba', 'xwoba', 'xwobacon', 'babip', 'hard_hit_pct', 'gb_pct', 'fb_pct']);
            })
            .catch(error => {
                console.error('Generate report failed:', error);
                alert('Generate report failed. See console.');
            });
    }
}

//tab control for the report tabs
function openTab(evt, tabName) {
    document.querySelectorAll('.tabcontent').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tablinks').forEach(t => t.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}

//grid line color helper: brighten the 0-line so both axes read clearly through the middle of the plot
function zeroLineGrid(color) {
    return {
        color: (context) => context.tick.value === 0 ? '#7b82a0' : color,
        lineWidth: (context) => context.tick.value === 0 ? 2 : 1,
        borderDash: [4, 4]
    };
}

//shared pitch-type -> color map so every chart on this page colors pitch types consistently.
//keyed on the pBp file's pitchTypeFull values.
function pitchTypeColor(pitchType) {
    switch (pitchType) {
        case "Four Seamer":
        case "Fastball": return "rgb(255, 0, 0)";
        case "Two Seamer": return "rgba(255, 140, 0, 1)";
        case "Sinker": return "rgba(255, 165, 0, 1)";
        case "Cutter": return "rgba(255, 255, 0, 1)";
        case "Changeup": return "rgba(0, 255, 0, 1)";
        case "Splitter": return "rgba(255, 192, 203, 1)";
        case "Slider": return "rgba(184, 134, 11, 1)";
        case "Sweeper": return "rgba(0, 100, 0, 1)";
        case "Curveball": return "rgba(128, 0, 128, 1)";
        case "Knuckle Curve": return "rgba(153, 50, 204, 1)";
        case "Knuckleball": return "rgba(211, 211, 211, 1)";
        default: return "rgba(128, 128, 128, 1)";
    }
}

//scriptable point color: Chart.js can invoke this before any data exists (e.g. initial legend/render
//pass with an empty dataset), so guard against an out-of-range point rather than reading .pitch_type off undefined
function pointPitchTypeColor(context) {
    const point = context.dataset.data[context.dataIndex];
    return point ? pitchTypeColor(point.pitch_type) : "rgba(128, 128, 128, 1)";
}

//replaces a single-dataset scatter chart's points in place, colored by pitch type
function updateScatterChart(chart, rows, xKey, yKey) {
    const points = rows.map(r => Object.assign({ x: r[xKey], y: r[yKey] }, r));
    chart.data.datasets[0].data = points;
    chart.update();
}

document.addEventListener("DOMContentLoaded", () => {
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
                pointRadius: 5,
                backgroundColor: pointPitchTypeColor
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
                        label: (context) => `${context.raw.pitch_type}: ${context.raw.hb} hb, ${context.raw.ivb} ivb`
                    }
                }
            },
            scales: {
                x: {
                    min: -25,
                    max: 25,
                    ticks: { stepSize: 5 },
                    grid: zeroLineGrid('rgba(255,255,255,0.06)'),
                    title: { display: true, text: 'Horizontal Movement (in)' }
                },
                y: {
                    min: -25,
                    max: 25,
                    ticks: { stepSize: 5 },
                    grid: zeroLineGrid('rgba(255,255,255,0.06)'),
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
                pointRadius: 5,
                backgroundColor: pointPitchTypeColor
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
        borderColor: pitchTypeColor(pitchType),
        backgroundColor: pitchTypeColor(pitchType),
        showLine: true,
        fill: false,
        pointRadius: 2
    }));
    veloChart.update();
}

//draws a filled canvas path from data-space [x,y] points, converted to pixels via the chart's own scales
function drawDataPath(chart, points, fillStyle, strokeStyle) {
    const { ctx, scales: { x, y } } = chart;
    const pixelPoints = points.map(([px, py]) => [x.getPixelForValue(px), y.getPixelForValue(py)]);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pixelPoints[0][0], pixelPoints[0][1]);
    pixelPoints.slice(1).forEach(([px, py]) => ctx.lineTo(px, py));
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1.5;
    ctx.fill();
    if (strokeStyle) ctx.stroke();
    ctx.restore();
}

//simplified standing-hitter silhouette (legs/hips/waist/shoulders + a separate head circle),
//centered on cx in data-space feet, used purely for scale/context - not anatomically exact
function drawBatterSilhouette(chart, cx) {
    const { ctx, scales: { x, y } } = chart;
    const body = [
        [cx - 0.22, 0], [cx - 0.18, 0.7], [cx - 0.25, 1.5], [cx - 0.22, 2.0], [cx - 0.3, 3.15], [cx - 0.12, 3.35],
        [cx + 0.12, 3.35], [cx + 0.3, 3.15], [cx + 0.22, 2.0], [cx + 0.25, 1.5], [cx + 0.18, 0.7], [cx + 0.22, 0]
    ];
    drawDataPath(chart, body, 'rgba(123, 130, 160, 0.25)', 'rgba(123, 130, 160, 0.4)');

    ctx.save();
    ctx.beginPath();
    ctx.arc(x.getPixelForValue(cx), y.getPixelForValue(3.62), Math.abs(x.getPixelForValue(0.28) - x.getPixelForValue(0)), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(123, 130, 160, 0.25)';
    ctx.strokeStyle = 'rgba(123, 130, 160, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

//zone-chart backdrop: a batter silhouette standing in the box on the correct side of the plate for
//their handedness (drawn first, furthest back), then home plate itself facing the pitcher's view
//(wide edge toward the zone, point trailing back toward the catcher), drawn in the gap below the zone
function zoneDecorPlugin(batterHand) {
    const batterSide = batterHand === 'L' ? 1 : -1; //RHH stands in the box on the pitcher's left, LHH the pitcher's right
    return {
        id: 'zoneDecor',
        beforeDatasetsDraw(chart) {
            drawBatterSilhouette(chart, batterSide * 1.45);
            drawDataPath(chart, [[-0.71, 1.0], [0.71, 1.0], [0.71, 0.6], [0, 0.3], [-0.71, 0.6]],
                'rgba(230, 230, 230, 0.9)', 'rgba(20, 20, 20, 0.8)');
        }
    };
}

//pitch location plot: same strike zone dimensions as the bullpen report's zone chart,
//one colored dot per pitch type, hover shows velo/IVB/HB/result
function initializeZoneChart(canvasId, titleText, batterHand) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
        type: 'scatter',
        plugins: [zoneDecorPlugin(batterHand)],
        data: {
            datasets: [{
                label: titleText,
                data: [],
                pointRadius: 5,
                backgroundColor: pointPitchTypeColor
            }]
        },
        options: {
            maintainAspectRatio: false,
            responsive: true,
            plugins: {
                title: { display: true, text: titleText },
                annotation: {
                    annotations: {
                        zone_box: {
                            type: 'box',
                            xMin: -.71,
                            xMax: .71,
                            yMin: 1.5,
                            yMax: 3.5,
                            backgroundColor: 'rgba(255, 99, 132, 0.25)',
                            borderColor: 'rgba(255, 99, 132, 1)',
                            borderWidth: 1
                        },
                        hline1: { type: 'line', xMin: -.71, xMax: .71, yMin: 2.16, yMax: 2.16, borderColor: 'red', borderWidth: 1 },
                        hline2: { type: 'line', xMin: -.71, xMax: .71, yMin: 2.83, yMax: 2.83, borderColor: 'red', borderWidth: 1 },
                        vline1: { type: 'line', xMin: -.24, xMax: -.24, yMin: 1.5, yMax: 3.5, borderColor: 'red', borderWidth: 1 },
                        vline2: { type: 'line', xMin: .23, xMax: .23, yMin: 1.5, yMax: 3.5, borderColor: 'red', borderWidth: 1 }
                    }
                },
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

//Table Results tables: one row per pitch type (pitch types with zero pitches thrown are already excluded by the backend)
function fillPitchTypeTable(bodyId, rows, keys) {
    const body = document.getElementById(bodyId);
    body.innerHTML = '';
    rows.forEach(row => {
        const tr = document.createElement('tr');
        [row.pitch_type, ...keys.map(key => row[key])].forEach(val => {
            const td = document.createElement('td');
            td.textContent = val;
            tr.appendChild(td);
        });
        body.appendChild(tr);
    });
}
