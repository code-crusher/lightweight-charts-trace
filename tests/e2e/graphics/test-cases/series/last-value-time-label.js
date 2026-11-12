function generateData() {
	const res = [];
	const time = new Date(Date.UTC(2024, 0, 1, 9, 30, 0, 0));
	for (let i = 0; i < 500; ++i) {
		const base = 100 + Math.sin(i / 50) * 10;
		res.push({
			time: time.getTime() / 1000,
			open: base + Math.sin(i) * 2,
			high: base + Math.abs(Math.sin(i)) * 3,
			low: base - Math.abs(Math.sin(i)) * 3,
			close: base + Math.sin(i + 1) * 2,
		});

		time.setUTCMinutes(time.getUTCMinutes() + 15);
	}
	return res;
}

function runTestCase(container) {
	const chart = window.chart = LightweightCharts.createChart(container, {
		layout: { attributionLogo: false },
		timeScale: { timeVisible: true, secondsVisible: false },
	});

	const series = chart.addSeries(LightweightCharts.CandlestickSeries, {
		lastValueTimeVisible: true,
	});

	series.setData(generateData());

	chart.timeScale().fitContent();
}
