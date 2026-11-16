// Regression test for https://github.com/tradingview/lightweight-charts/issues/1710
//
// getVisibleLogicalRange() returned the range from before the fitContent() call
// when both calls happened within the same frame, because the API queues a
// FitContent invalidation which the chart widget only applies on the next
// animation frame. The reporter called getVisibleLogicalRange() synchronously
// after fitContent() and got the pre-fit numbers back.
//
// The test drives the chart with a manual animation-frame queue (the same
// deterministic approach as the scroll-while-appending cases) so that the
// number of frames between the API calls and the read is exact.

const DAY = 24 * 60 * 60;
const START_TIME = Date.UTC(2023, 0, 1) / 1000;
const BAR_COUNT = 1000;

let chart = null;
let series = null;

let rafQueue = [];
let nextRafId = 1;
const realRequestAnimationFrame = window.requestAnimationFrame.bind(window);
const realCancelAnimationFrame = window.cancelAnimationFrame.bind(window);

function installFakeClock() {
	window.requestAnimationFrame = callback => {
		const id = nextRafId++;
		rafQueue.push({ id, callback });
		return id;
	};
	window.cancelAnimationFrame = id => {
		rafQueue = rafQueue.filter(item => item.id !== id);
	};
}

function restoreClock() {
	window.requestAnimationFrame = realRequestAnimationFrame;
	window.cancelAnimationFrame = realCancelAnimationFrame;
	const pending = rafQueue;
	rafQueue = [];
	for (const item of pending) {
		realRequestAnimationFrame(item.callback);
	}
}

function runFrame() {
	const callbacks = rafQueue;
	rafQueue = [];
	for (const item of callbacks) {
		item.callback(0);
	}
}

function generateData() {
	const res = [];
	for (let i = 0; i < BAR_COUNT; ++i) {
		res.push({ time: START_TIME + i * DAY, value: 100 + 10 * Math.sin(i / 10) });
	}
	return res;
}

function range() {
	return chart.timeScale().getVisibleLogicalRange();
}

function assertClose(actual, expected, what) {
	if (!(Math.abs(actual - expected) < 1e-9)) {
		throw new Error(`${what}: expected ${expected}, got ${actual}`);
	}
}

function initialInteractionsToPerform() {
	return [];
}

function finalInteractionsToPerform() {
	return [];
}

function beforeInteractions(container) {
	installFakeClock();
	chart = LightweightCharts.createChart(container);
	series = chart.addSeries(LightweightCharts.LineSeries);
	series.setData(generateData());
	runFrame();
	runFrame();
	return Promise.resolve();
}

function afterInitialInteractions() {
	try {
		const timeScale = chart.timeScale();

		// scroll into history so the current range differs from the fitted one
		timeScale.scrollToPosition(-300, false);
		runFrame();

		const rangeBefore = range();
		assertClose(rangeBefore.to, BAR_COUNT - 1 - 300, 'precondition: scrolled into history');

		// the repro from the issue: read, fit, read again without waiting a frame
		timeScale.fitContent();
		const rangeAfterFit = range();
		assertClose(rangeAfterFit.from, 0, 'visible logical range from after fitContent');
		assertClose(rangeAfterFit.to, BAR_COUNT - 1, 'visible logical range to after fitContent');

		// and the second part: fitContent() followed by scrollToPosition() in one frame
		timeScale.scrollToPosition(10, false);
		const scrolled = range();
		assertClose(scrolled.from, 10, 'visible logical range from after scrollToPosition');
		assertClose(scrolled.to, BAR_COUNT - 1 + 10, 'visible logical range to after scrollToPosition');

		// a frame later the range must still be the fitted/scrolled one, unchanged
		runFrame();
		const afterFrame = range();
		assertClose(afterFrame.from, scrolled.from, 'range from after a frame');
		assertClose(afterFrame.to, scrolled.to, 'range to after a frame');
	} finally {
		restoreClock();
	}
	return Promise.resolve();
}

function afterFinalInteractions() {
	return Promise.resolve();
}
