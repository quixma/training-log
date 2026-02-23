
//once html is loaded, get inital chart
document.addEventListener("DOMContentLoaded", () => {
  initializeChart();
  //initializeSummaryCards();
});

//get form elements
const metricSelect = document.getElementById('metric-select')
const timeframeSelect = document.getElementById('time-select')
const peakVelo = document.getElementById('peak-velo')
const avgReadiness = document.getElementById('avg-readiness')
const totalThrows = document.getElementById('total-throws')

//event listeners
metricSelect.addEventListener("change", getData);
timeframeSelect.addEventListener("change", getData);

getData();


async function getData() {
  const formData = {
    metric: metricSelect.value,
    time: timeframeSelect.value
  }

  if (!formData.metric || !formData.time) {
    console.log("Enter both search criteria")
    return;
  }
  else {
    const response = await fetch('/api/data',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(formData)
      });

    // Check if response is ok before parsing, display to html
    if (!response.ok) {
      console.log('Update failed:', await response.text());
      alert('Update failed. See console.');
      return;
    }

    const data = await response.json();
    console.log(data)
    updateChart(data)
  }
}

function updateChart(data) {
  clearCharts()
  metricMap = metricSelect.value;
  if (metricMap == "totalThrows7d") {
    label_dataX = data.date;
    label_dataY = data.totalThrows7d;
  }
  else {
    label_dataX = data.map(row => row.date);
    label_dataY = data.map(row => row[metricMap]);
  }

  const ctx = document.getElementById('chart').getContext('2d');
  updatedChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: label_dataX,
      datasets: [
        {
          label: metricMap,
          data: label_dataY,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true
    }
  });
}

function clearCharts() {
  if (typeof defaultChart !== 'undefined') {
    defaultChart.destroy()
  }
  if (typeof updatedChart !== 'undefined') {
    updatedChart.destroy()
  }
}

function initializeChart() {
  const ctx = document.getElementById('chart').getContext('2d');
  defaultChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Metric",
          data: [],
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true
    }
  });
}



