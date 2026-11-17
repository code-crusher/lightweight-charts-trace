function simpleData() {
	return [
		{ time: 1663740000, value: 10 },
		{ time: 1663750000, value: 20 },
		{ time: 1663760000, value: 30 },
	];
}

function interactionsToPerform() {
	return [];
}

let chart;
function beforeInteractions(container) {
	chart = LightweightCharts.createChart(container, {
		addDefaultPane: false,
	});

	// there is no pane to measure yet, so the width must be 0 rather than throwing (see #1672)
	if (chart.priceScale('left').width() !== 0 || chart.priceScale('right').width() !== 0) {
		throw new Error('Width of a price axis should be 0 when the chart has no panes');
	}

	const pane0 = chart.addPane(true);

	const mainSeries = chart.addSeries(LightweightCharts.LineSeries, {}, pane0.paneIndex());
	const secondSeries = chart.addSeries(LightweightCharts.LineSeries, {}, 1);

	mainSeries.setData(simpleData());
	secondSeries.setData(simpleData());
	const pane1 = chart.panes()[1];

	pane1.setStretchFactor(pane0.getStretchFactor() * 2);

	return Promise.resolve();
}

function afterInteractions() {
	return Promise.resolve();
}
