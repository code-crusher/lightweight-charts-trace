// Markers with a `spacing` multiplier should be pushed further away from the
// bar's wick, and stacked markers on the same bar should stay evenly separated
// without overlapping.
function generateData() {
	const res = [];
	const time = new Date(Date.UTC(2018, 0, 1, 0, 0, 0, 0));
	for (let i = 0; i < 30; ++i) {
		const base = i + 10;
		res.push({
			time: time.getTime() / 1000,
			open: base,
			high: base + 2,
			low: base - 2,
			close: base + 1,
		});

		time.setUTCDate(time.getUTCDate() + 1);
	}
	return res;
}

function runTestCase(container) {
	const chart = window.chart = LightweightCharts.createChart(container, { layout: { attributionLogo: false } });

	const mainSeries = chart.addSeries(LightweightCharts.CandlestickSeries);

	const data = generateData();
	mainSeries.setData(data);

	const markers = [];
	const spacingValues = [0, 1, 2, 4];
	spacingValues.forEach((spacing, index) => {
		const bar = data[5 + index * 5];
		markers.push(
			{ time: bar.time, position: 'aboveBar', color: 'red', shape: 'arrowDown', spacing },
			{ time: bar.time, position: 'aboveBar', color: 'red', shape: 'arrowDown', spacing },
			{ time: bar.time, position: 'belowBar', color: 'blue', shape: 'arrowUp', spacing },
			{ time: bar.time, position: 'belowBar', color: 'blue', shape: 'arrowUp', spacing }
		);
	});

	LightweightCharts.createSeriesMarkers(mainSeries, markers);
}
