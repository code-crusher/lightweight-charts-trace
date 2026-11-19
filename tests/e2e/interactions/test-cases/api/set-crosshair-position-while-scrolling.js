// Regression test for https://github.com/tradingview/lightweight-charts/issues/1608.
//
// A crosshair position set with setCrosshairPosition (as the crosshair-syncing and
// touch-tracking patterns do) used to overwrite the crosshair's saved pointer coords
// with coordinates derived from the data point. On the next time scale change
// (scrolling, zooming, a synced partner chart updating) the crosshair was recomputed
// from those derived coords instead of the pointer position, so the crosshair line
// slid away from the pointer until it stuck at the edge of the visible range.
//
// The synthetic position must not clobber the saved pointer coords. The test hovers
// the chart (saving real pointer coords), mirrors the hovered data point back with
// setCrosshairPosition (the syncing pattern), then scrolls with the wheel while the
// pointer stays still. It passes while the reported crosshair point stays under the
// pointer; it failed before the fix with the point drifting to the pane edge.
//
// Fails without the fix: after 8 wheel ticks the reported point.x drifts from the
// pointer position (200) to the left edge of the pane (-2).

function generateData() {
	const res = [];
	const time = new Date(Date.UTC(2018, 0, 1, 0, 0, 0, 0));
	for (let i = 0; i < 500; ++i) {
		res.push({
			time: time.getTime() / 1000,
			value: 100 + i / 5 + 10 * Math.sin(i / 8),
		});

		time.setUTCDate(time.getUTCDate() + 1);
	}
	return res;
}

const MOUSE_X = 200;
const MOUSE_Y = 150;

let chart = null;
let series = null;
let lastPoint = null;

function initialInteractionsToPerform() {
	return [];
}

function finalInteractionsToPerform() {
	return [
		{ action: 'moveMouseXY', options: { x: MOUSE_X, y: MOUSE_Y } },
		{ action: 'scrollLeft' },
		{ action: 'scrollLeft' },
		{ action: 'scrollLeft' },
		{ action: 'scrollLeft' },
		{ action: 'scrollLeft' },
		{ action: 'scrollLeft' },
		{ action: 'scrollLeft' },
		{ action: 'scrollLeft' },
		{ action: 'scrollRight' },
		{ action: 'scrollRight' },
	];
}

function beforeInteractions(container) {
	chart = LightweightCharts.createChart(container, {
		layout: { attributionLogo: false },
	});
	series = chart.addSeries(LightweightCharts.LineSeries);
	series.setData(generateData());
	chart.timeScale().fitContent();

	// the crosshair-syncing pattern: mirror the hovered data point back into the chart
	chart.subscribeCrosshairMove(param => {
		const dataPoint = param.time ? param.seriesData.get(series) : null;
		lastPoint = param.point ?? null;
		if (dataPoint) {
			chart.setCrosshairPosition(dataPoint.value, dataPoint.time, series);
		}
	});

	return Promise.resolve();
}

function afterInitialInteractions() {
	return Promise.resolve();
}

function afterFinalInteractions() {
	if (lastPoint === null) {
		throw new Error('Expected the crosshair to be positioned by the mouse.');
	}

	if (Math.abs(lastPoint.x - MOUSE_X) > 1 || Math.abs(lastPoint.y - MOUSE_Y) > 1) {
		throw new Error(`Expected the crosshair to stay under the mouse at {x: ${MOUSE_X}, y: ${MOUSE_Y}} while scrolling, got {x: ${lastPoint.x}, y: ${lastPoint.y}} (issue #1608).`);
	}

	return Promise.resolve();
}
