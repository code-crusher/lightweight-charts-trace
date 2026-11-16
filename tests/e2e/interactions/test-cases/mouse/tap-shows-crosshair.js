function generateData() {
	const res = [];
	const time = new Date(Date.UTC(2018, 0, 1, 0, 0, 0, 0));
	for (let i = 0; i < 500; ++i) {
		res.push({
			time: time.getTime() / 1000,
			value: i,
		});

		time.setUTCDate(time.getUTCDate() + 1);
	}
	return res;
}

function initialInteractionsToPerform() {
	return [{ action: 'tap', target: 'pane' }];
}

function finalInteractionsToPerform() {
	return [];
}

let chart;
let clickCount = 0;
let crosshairMoveCount = 0;
let lastCrosshairPoint = null;

function beforeInteractions(container) {
	chart = LightweightCharts.createChart(container);

	const mainSeries = chart.addSeries(LightweightCharts.LineSeries);

	const mainSeriesData = generateData();
	mainSeries.setData(mainSeriesData);

	chart.subscribeClick(mouseParams => {
		if (!mouseParams) {
			return;
		}
		clickCount += 1;
	});

	chart.subscribeCrosshairMove(mouseParams => {
		crosshairMoveCount += 1;
		lastCrosshairPoint = mouseParams && mouseParams.point;
	});

	return new Promise(resolve => {
		requestAnimationFrame(() => {
			resolve();
		});
	});
}

function afterFinalInteractions() {
	if (clickCount < 1) {
		throw new Error('Expected click event handler to be evoked.');
	}
	if (crosshairMoveCount < 1) {
		throw new Error('Expected crosshair move event handler to be evoked.');
	}
	if (lastCrosshairPoint === null) {
		throw new Error('Expected the crosshair to be shown at the tap position.');
	}

	return Promise.resolve();
}
