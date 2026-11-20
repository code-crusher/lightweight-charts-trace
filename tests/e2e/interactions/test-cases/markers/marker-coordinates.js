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
	return [];
}

function finalInteractionsToPerform() {
	return [];
}

let chart;
let series;
let seriesMarkers;
let markerTime;

function expectEqual(actual, expected, message) {
	if (actual !== expected) {
		throw new Error(`${message}: expected ${expected}, got ${actual}`);
	}
}

function expectNull(value, message) {
	if (value !== null) {
		throw new Error(`${message}: expected null, got ${JSON.stringify(value)}`);
	}
}

function nextFrame() {
	return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function checkCoordinates() {
	const coordinates = seriesMarkers.markerCoordinates();

	// aligned with markers()
	expectEqual(coordinates.length, seriesMarkers.markers().length, 'markerCoordinates().length');

	const [above, below] = coordinates;

	// x matches the time scale
	expectEqual(above.x, chart.timeScale().timeToCoordinate(markerTime), 'aboveBar x');

	// y is offset from the price, not equal to priceToCoordinate
	const valueY = series.priceToCoordinate(450);
	if (above.y >= valueY) {
		throw new Error(`aboveBar y (${above.y}) should be above the bar value (${valueY})`);
	}
	if (below.y <= valueY) {
		throw new Error(`belowBar y (${below.y}) should be below the bar value (${valueY})`);
	}

	return { above, below, valueY };
}

async function checkScrolling({ above, below, valueY }) {
	// scroll the marker out of the visible range (well past the one-item
	// extended range used while drawing) - the marker isn't drawn anymore
	// and reports no coordinates
	chart.timeScale().setVisibleLogicalRange({ from: 100, to: 150 });
	await nextFrame();
	const scrolled = seriesMarkers.markerCoordinates();
	expectEqual(scrolled.length, 2, 'scrolled markerCoordinates().length');
	expectNull(scrolled[0], 'scrolled aboveBar coordinate');
	expectNull(scrolled[1], 'scrolled belowBar coordinate');

	// scrolling back restores the coordinates
	chart.timeScale().fitContent();
	await nextFrame();
	const restored = seriesMarkers.markerCoordinates();
	expectEqual(restored.length, 2, 'restored markerCoordinates().length');
	if (restored[0] === null || restored[1] === null) {
		throw new Error('expected restored coordinates to be non-null');
	}
	if (restored[0].y !== above.y || restored[1].y !== below.y) {
		throw new Error('expected restored coordinates to match the original ones');
	}
}

function beforeInteractions(container) {
	chart = LightweightCharts.createChart(container);

	series = chart.addSeries(LightweightCharts.LineSeries);
	const data = generateData();
	markerTime = data[450].time;
	series.setData(data);

	seriesMarkers = LightweightCharts.createSeriesMarkers(series, [
		{ time: markerTime, position: 'aboveBar', color: '#2196F3', shape: 'arrowDown', id: 'ABOVE' },
		{ time: markerTime, position: 'belowBar', color: '#2196F3', shape: 'arrowUp', id: 'BELOW' },
	]);

	chart.timeScale().fitContent();

	return nextFrame().then(() => checkCoordinates()).then(result => checkScrolling(result));
}

function afterInitialInteractions() {
	return Promise.resolve();
}

function afterFinalInteractions() {
	return Promise.resolve();
}
