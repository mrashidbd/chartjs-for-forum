// main.js
import { Chart, registerables } from 'chart.js';
import 'moment';
import 'chartjs-adapter-moment';

// Register all controllers, elements, scales and plugins
Chart.register(...registerables);

document.addEventListener('DOMContentLoaded', function () {
    fetch('stock-chart-data.json', { cache: "no-store" })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(jsonData => {
            if (!jsonData.Date || !jsonData.Price || !jsonData.High || !jsonData.Low || !jsonData.Volume) {
                throw new Error('JSON structure is incorrect or missing expected keys');
            }
            const labels = Object.keys(jsonData.Date).map(key => new Date(jsonData.Date[key]));
            const priceData = Object.keys(jsonData.Price).map(key => parseFloat(jsonData.Price[key]));
            const highData = Object.keys(jsonData.High).map(key => parseFloat(jsonData.High[key]));
            const lowData = Object.keys(jsonData.Low).map(key => parseFloat(jsonData.Low[key]));
            const volumeDataSet = Object.keys(jsonData.Volume).map(key => jsonData.Volume[key]);
            const volumeData = volumeDataSet.map(volume => (volume / 1000000).toFixed(2) + 'M');

            const ctx = document.getElementById('stock-chart').getContext('2d');

            // Constants
            const SNAP_THRESHOLD = 10;  // Pixel proximity to snap to a data point

            // Plugin to draw the vertical line and manage tooltip
            const verticalLinePlugin = {
                id: 'verticalLine',
                afterEvent(chart, args) {
                    const {event} = args;
                    if (event.type === 'mousemove' || event.type === 'click') {
                        const x = event.x;

                        let closestDistance = Infinity;
                        let closestIndex = null;
                        let closestDatasetIndex = null;

                        chart.data.datasets.forEach((dataset, datasetIndex) => {
                            dataset.data.forEach((value, index) => {
                                const meta = chart.getDatasetMeta(datasetIndex);
                                if (!meta.hidden) {
                                    const pointX = meta.data[index].getCenterPoint().x;
                                    const distance = Math.abs(pointX - x);
                                    if (distance < closestDistance) {
                                        closestDistance = distance;
                                        closestIndex = index;
                                        closestDatasetIndex = datasetIndex;
                                    }
                                }
                            });
                        });

                        if (closestDistance <= SNAP_THRESHOLD) {
                            chart.options.plugins.tooltip.enabled = true;
                            chart.tooltip.setActiveElements([{datasetIndex: closestDatasetIndex, index: closestIndex}], {
                                x,
                                y: 0
                            });
                        } else {
                            chart.options.plugins.tooltip.enabled = false;
                            chart.tooltip.setActiveElements([]);
                        }
                    } else if (event.type === 'mouseout') {
                        chart.options.plugins.tooltip.enabled = false;
                        chart.tooltip.setActiveElements([]);
                    }
                },
                afterDraw(chart) {
                    const elements = chart.tooltip.getActiveElements();
                    if (elements.length > 0) {
                        const x = elements[0].element.getCenterPoint().x;
                        const ctx = chart.ctx;
                        ctx.save();
                        ctx.beginPath();
                        ctx.setLineDash([5, 2]);
                        ctx.moveTo(x, chart.chartArea.top);
                        ctx.lineTo(x, chart.chartArea.bottom);
                        ctx.lineWidth = 0.5;
                        ctx.strokeStyle = '#1f3e56';  // Red line
                        ctx.stroke();
                        ctx.restore();
                    }
                }
            };

            // Register the plugin
            Chart.register(verticalLinePlugin);

            const stockChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Price',
                            data: priceData,
                            borderColor: '#1f3e56', //main line color
                            borderWidth: 1,
                            fill: true,
                            backgroundColor: 'rgba(170,200,220, 0.75)',
                            yAxisID: 'y',
                            pointRadius: 0,
                        },
                        {
                            label: 'High',
                            data: highData,
                            yAxisID: 'y1',
                            hidden: true,
                        },
                        {
                            label: 'Low',
                            data: lowData,
                            yAxisID: 'y2',
                            hidden: true,
                        },
                        {
                            label: 'Volume',
                            data: volumeData,
                            yAxisID: 'y3',
                            hidden: true,
                        }
                    ]
                },
                options: {
                    maintainAspectRatio: false,
                    animations: {
                        tension: {
                            duration: 500,
                            easing: 'linear',
                            from: 1,
                            to: 0,
                            loop: false
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'y'
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'day',
                                tooltipFormat: 'MMM DD',
                                displayFormats: {
                                    day: 'MMM DD'
                                }
                            },
                            ticks: {
                                font: {
                                    size: 12 // Smaller font size
                                },
                                autoSkip: true,
                                maxTicksLimit: 10
                            },
                            title: {
                                display: false,
                                text: 'Date'
                            },
                            grid: {
                                tickColor: 'rgba(170,200,220, 0.75)',
                                color: 'transparent',
                            }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            grid: {
                                tickColor: 'rgba(170,200,220, 0.75)',
                                color: 'rgba(170,200,220, 0.5)',
                                lineWidth: 0.5
                            },
                            ticks: {
                                callback: function(value, index, values) {
                                    return '€' + Number(value.toFixed(1)); // Prefix Euro sign
                                },
                                font: {
                                    size: 12 // Smaller font size
                                },
                                autoSkip: true,
                            },
                        },
                        y1: {
                            display: false,
                        },
                        y2: {
                            display: false,
                        },
                        y3: {
                            display: false,
                        },
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            enabled: true, // Enable tooltip
                            displayColors: false,
                            backgroundColor: 'rgba(31,62,86, 0.9)',
                            position: 'nearest', // Positions the tooltip at the nearest element
                            callbacks: {

                                label: function (tooltipItem) {
                                    const dataset = stockChart.data.datasets[tooltipItem.datasetIndex];
                                    const label = dataset.label;
                                    const value = tooltipItem.formattedValue;
                                    const euroSign = '€';
                                    const maxLength = 19; // Adjust based on your needs or calculate dynamically
                                    const labelLength = (label + ': €').length;
                                    const spaceToInsert = maxLength - labelLength - value.length;
                                    const spaces = Array(spaceToInsert).fill(' ').join('');
                                    return `${label}: ${spaces}${euroSign}${value}`;
                                },
                                afterLabel: function (tooltipItem) {
                                    const dataIndex = tooltipItem.dataIndex;
                                    const datasetData = stockChart.data.datasets;
                                    let additionalInfo = [];
                                    datasetData.forEach(dataset => {
                                        if (dataset.label !== 'Price' && dataset.label !== 'Volume') {
                                            const label = dataset.label;
                                            const value = tooltipItem.formattedValue;
                                            const maxLength = 18; // Adjust based on your needs or calculate dynamically
                                            const labelLength = (label + ': ').length;
                                            const spaceToInsert = maxLength - labelLength - value.length;
                                            const spaces = Array(spaceToInsert).fill(' ').join('');
                                            const euroSign = (dataset.label === 'High' || dataset.label === 'Low') ? '€' : '';
                                            additionalInfo.push(`${dataset.label}: ${spaces}${euroSign}${dataset.data[dataIndex]}`);
                                        }
                                        if (dataset.label === 'Volume') {
                                            const label = dataset.label;
                                            const value = tooltipItem.formattedValue;
                                            const maxLength = 15; // Adjust based on your needs or calculate dynamically
                                            const labelLength = (label + ': ').length;
                                            const spaceToInsert = maxLength - labelLength - value.length;
                                            const spaces = Array(spaceToInsert).fill(' ').join('');
                                            additionalInfo.push(`${dataset.label}: ${spaces}${dataset.data[dataIndex]}`);
                                        }
                                    });
                                    return additionalInfo;  // Returns array that gets split by newline
                                },
                            }
                        },
                        verticalLine: {},
                    }
                }
            });

        })
        .catch(error => {
            console.error('Error loading the JSON Data:', error);
        });
});


/****** Ticker Data Options ********/

async function loadTickerData() {
    try {
        const response = await fetch('stock-ticker-data.json', { cache: "no-store" });
        const data = await response.json();

        updateTickerUI(data);
    } catch (error) {
        console.error("Failed to fetch the ticker data:", error);
    }
}

function updateTickerUI(data) {
    const ticker = document.getElementById('stock-ticker');
    const changeFloat = parseFloat(data.change);

    // Determine class based on change being positive or negative
    ticker.className = changeFloat > 0 ? 'price-up' : 'price-down';

    // Clear current contents
    ticker.innerHTML = '';

    const image = document.createElement('img');
    image.src = "Atos-Logo.png";
    image.alt = "Atos Logo";
    image.style.height = '15px';

    // Create container for the image
    const imageContainer = document.createElement('span');
    imageContainer.className = 'atos';
    imageContainer.appendChild(image);

    // Create other elements
    const priceSpan = document.createElement('span');
    priceSpan.textContent = data.price;

    const percentSpan = document.createElement('span');
    percentSpan.textContent = data.percent;

    const changeSpan = document.createElement('span');
    changeSpan.textContent = `(${data.change}) Today`;

    // Top row div
    const topRowDiv = document.createElement('div');
    topRowDiv.className = 'stock-top-row';
    topRowDiv.appendChild(imageContainer);
    topRowDiv.appendChild(priceSpan);

    // Bottom row div
    const bottomRowDiv = document.createElement('div');
    bottomRowDiv.className = 'stock-top-row';
    bottomRowDiv.appendChild(percentSpan);
    bottomRowDiv.appendChild(changeSpan);

    // Append rows to ticker
    ticker.appendChild(topRowDiv);
    ticker.appendChild(bottomRowDiv);
}

// Initially load the ticker data
loadTickerData().then();

// Set an interval to reload data every minute
setInterval(loadTickerData, 60000);