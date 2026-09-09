var create_reportBTN = document.getElementById('create_report')

create_reportBTN.onclick = function () { //generate bullpen report
    //send selected file to flask, pull report and data from file, send back to js
    var file = document.getElementById('file').value;

    if (!file) {
        console.log("Select a file.")
        return;
    }
    else {
        fetch('/api/report_data',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify({ file: file })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Update success:', data);

                length = Object.keys(data.pitch_avgs).length; //gets length of dict(# of dif pitches) for rows in table
                fillTable(data.pitch_avgs, length)
                displayReport(data.pitch_by_pitch) //draw charts
            })
            .catch(error => {
                console.error('Update failed:', error);
                alert('Update failed. See console.');
            });


    }
}

function fillTable(data, length) {
    const table = document.getElementById('report_body');
    const tableRows = table.rows.length;
    //data-label drives the stacked card layout on mobile, taken from this table's header row
    const headers = [...table.closest('table').querySelectorAll('thead th')].map(th => th.textContent.trim());

    for (let i = 0; i < tableRows; i++) { //empty's table values before repopulating 
        for (let j = 0; j < 2; j++) {
            table.rows[i].cells[j].innerText = '';
        }
    }
    if (tableRows > length) { //too many rows, delete diff
        for (let i = length; i < tableRows; i++) {
            table.deleteRow(i);
        }
    }
    else if (tableRows < length) { //not enough rows, add diff
        rows_needed = length - tableRows;

        for (let i = 0; i < rows_needed; i++) {
            var new_row = table.insertRow();
            var cell1 = new_row.insertCell(0);
            var cell2 = new_row.insertCell(1);
            var cell3 = new_row.insertCell(2);
            var cell4 = new_row.insertCell(3);
            var cell5 = new_row.insertCell(4);
            var cell6 = new_row.insertCell(5);
            var cell7 = new_row.insertCell(6);
            var cell8 = new_row.insertCell(7);
            var cell9 = new_row.insertCell(8);
            var cell10 = new_row.insertCell(9);
            var cell11 = new_row.insertCell(10);
            var cell12 = new_row.insertCell(11);
            var cell13 = new_row.insertCell(12);
        }
    }
    else {
        //same amount of rows, do nothing
    }
    let i = 0; //row counter 
    //populate table- have to iterate over each key of dict (pitch types) and access inner values (avgs)
    Object.keys(data).forEach(key => {
        const row = table.rows[i];
        [...row.cells].forEach((cell, c) => {
            if (headers[c]) cell.setAttribute('data-label', headers[c]);
        });
        row.cells[0].innerText = key;
        row.cells[1].innerText = data[key]["Velocity"];
        row.cells[2].innerText = data[key]["Max Velo"];
        row.cells[3].innerText = data[key]["Min Velo"];
        row.cells[4].innerText = data[key]["Induced Vert Break"];
        row.cells[5].innerText = data[key]["Horz Break"];
        row.cells[6].innerText = data[key]["Spin Direction"];
        row.cells[7].innerText = data[key]["Spin Rate"];
        row.cells[8].innerText = data[key]["Spin Eff"];
        row.cells[9].innerText = data[key]["Rel Height"];
        row.cells[10].innerText = data[key]["Rel Side"];
        row.cells[11].innerText = data[key]["Extension"];
        row.cells[12].innerText = data[key]["Usage"];
        i++;
    })
}
//shared pitch-type -> color map so every chart on this page colors pitch types consistently
function pitchTypeColor(pitchType) {
    switch (pitchType) {
        case "Fastball": return "rgb(255, 0, 0)";
        case "Sinker": return "rgba(255, 165, 0, 1)";
        case "Cutter": return "rgba(255, 255, 0, 1)";
        case "Changeup": return "rgba(0, 255, 0, 1)";
        case "Splitter": return "rgba(255, 192, 203, 1)";
        case "Slider": return "rgba(184, 134, 11, 1)";
        case "Sweeper": return "rgba(0, 100, 0, 1)";
        case "Curveball": return "rgba(128, 0, 128, 1)";
        case "Knuckleball": return "rgba(211, 211, 211, 1)";
        default: return "rgba(128, 128, 128, 1)";
    }
}

//scriptable point color: Chart.js can invoke this before any data exists (e.g. initial legend/render
//pass with an empty dataset), so guard against an out-of-range point rather than reading .status off undefined
function pointPitchTypeColor(context) {
    const point = context.dataset.data[context.dataIndex];
    return point ? pitchTypeColor(point.status) : "rgba(128, 128, 128, 1)";
}

function displayReport(data) {
    clearCharts();
    mvmt_chart(data);
    release_chart(data);
    zone_chart(data);
}
function release_chart(pitch_data) {
    const formattedData = Object.keys(pitch_data).map(key => {
        return {
            x: pitch_data[key]["Rel Side"],
            y: pitch_data[key]["Rel Height"],
            status: pitch_data[key]["Pitch Type"]
        }
    });

    const data = {
        datasets: [{
            label: 'Pitch Release Plot',
            data: formattedData,
            backgroundColor: pointPitchTypeColor
        }],
    };

    const config = {
        type: 'scatter',
        data: data,
        options: {
            maintainAspectRatio: false, // Set to false to use the container's size
            responsive: true,
            plugins: {
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function (context) {
                            const pitch_type = context.raw.status; //calls data from dataset
                            const RH = context.raw.y.toFixed(1); //rounds to 1
                            const RS = context.raw.x.toFixed(1);
                            return `${pitch_type}: ${RH} Rel Height, ${RS} Rel Side` //returns hover label
                        }
                    }
                },
                legend: {
                    display: true,
                    postiion: 'top',
                    labels: {
                        boxWidth: 0,
                        boxHeight: 0
                    }

                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    min: -4,
                    max: 4,
                    title: {
                        display: true,
                        text: 'Rel Side',
                        align: 'end'
                    }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    min: 0,
                    max: 7,
                    title: {
                        display: true,
                        text: 'Rel Height',
                        align: 'end'
                    }
                }
            }
        }
    };

    chart1 = new Chart(document.getElementById('release_chart'), config);
}
function zone_chart(pitch_data) {
    const formattedData = Object.keys(pitch_data).map(key => {
        return {
            x: pitch_data[key]["Pitch Loc Side"],
            y: pitch_data[key]["Pitch Loc Height"],
            status: pitch_data[key]["Pitch Type"],
            ivb: pitch_data[key]["Induced Vert Break"],
            hb: pitch_data[key]["Horz Break"]
        }
    });

    const data = {
        datasets: [{
            label: 'Strike Zone Plot',
            data: formattedData,
            pointRadius: 5, //size of dots on plot
            backgroundColor: pointPitchTypeColor
        }],
    };

    const config = {
        type: 'scatter',
        data: data,
        options: {
            maintainAspectRatio: false, // Set to false to use the container's size
            responsive: true,
            plugins: {
                annotation: {
                    annotations: {
                        zone_box: { //creates the strikezone within the larger plot
                            type: 'box',
                            xMin: -.71,
                            xMax: .71,
                            yMin: 1.5,
                            yMax: 3.5,
                            backgroundColor: 'rgba(255, 99, 132, 0.25)', // Fill color
                            borderColor: 'rgba(255, 99, 132, 1)', // Border color
                            borderWidth: 1
                        },
                        hline1: {
                            type: 'line',
                            xMin: -.71,
                            xMax: .71,
                            yMin: 2.16,
                            yMax: 2.16,
                            borderColor: 'red',
                            borderWidth: 1,

                        },
                        hline2: {
                            type: 'line',
                            xMin: -.71,
                            xMax: .71,
                            yMin: 2.83,
                            yMax: 2.83,
                            borderColor: 'red',
                            borderWidth: 1,

                        },
                        vline1: {
                            type: 'line',
                            xMin: -.24,
                            xMax: -.24,
                            yMin: 1.5,
                            yMax: 3.5,
                            borderColor: 'red',
                            borderWidth: 1,

                        },
                        vline2: {
                            type: 'line',
                            xMin: .23,
                            xMax: .23,
                            yMin: 1.5,
                            yMax: 3.5,
                            borderColor: 'red',
                            borderWidth: 1,

                        }
                    }
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function (context) {
                            const pitch_type = context.raw.status; //calls data from dataset
                            const ivb = context.raw.ivb.toFixed(1);
                            const hb = context.raw.hb.toFixed(1);
                            return `${pitch_type}: ${ivb} ivb, ${hb} hb` //returns hover label
                        }
                    }
                },
                legend: {
                    display: true,
                    postiion: 'top',
                    labels: {
                        boxWidth: 0,
                        boxHeight: 0
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    min: -1.5,
                    max: 1.5,
                    ticks: {
                        display: false
                    },
                    title: {
                        display: false
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    min: .5,
                    max: 4.5,
                    ticks: {
                        display: false
                    },
                    title: {
                        display: false
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    };

    chart2 = new Chart(document.getElementById('zone_chart'), config);
}

function mvmt_chart(pitch_data) {
    //make title bigger
    const formattedData = Object.keys(pitch_data).map(key => {
        return {
            x: pitch_data[key]["Horz Break"],
            y: pitch_data[key]["Induced Vert Break"],
            status: pitch_data[key]["Pitch Type"]
        }
    });

    const data = {
        datasets: [{
            label: 'Pitch Movement Plot',
            data: formattedData,
            backgroundColor: pointPitchTypeColor
        }],
    };

    const config = {
        type: 'scatter',
        data: data,
        options: {
            maintainAspectRatio: false, // Set to false to use the container's size
            responsive: true,
            plugins: {
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function (context) {
                            const pitch_type = context.raw.status; //calls data from dataset
                            const ivb = context.raw.y.toFixed(1); //rounds to 1
                            const hb = context.raw.x.toFixed(1);
                            return `${pitch_type}: ${ivb} IVB, ${hb} HB` //returns hover label
                        }
                    }
                },
                legend: {
                    display: true,
                    postiion: 'top',
                    labels: {
                        boxWidth: 0,
                        boxHeight: 0
                    }

                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'center',
                    min: -25,
                    max: 25,
                    title: {
                        display: true,
                        text: 'Horizontal Break',
                        align: 'end'
                    }
                },
                y: {
                    type: 'linear',
                    position: 'center',
                    min: -25,
                    max: 25,
                    title: {
                        display: true,
                        text: 'Induced Vertical Break',
                        align: 'center'
                    }
                }
            }
        }
    };

    chart3 = new Chart(document.getElementById('mvmt_chart'), config);
}

function clearCharts() {
    if (typeof chart1 !== 'undefined') {
        chart1.destroy()
    }
    if (typeof chart2 !== 'undefined') {
        chart2.destroy()
    }
    if (typeof chart3 !== 'undefined') {
        chart3.destroy()
    }
}