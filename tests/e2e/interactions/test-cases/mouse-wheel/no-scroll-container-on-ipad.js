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
	return [{ action: 'scrollDown' }];
}

function finalInteractionsToPerform() {
	return [];
}

let chart;

function beforeInteractions(container) {
	chart = LightweightCharts.createChart(container);

	const mainSeries = chart.addSeries(LightweightCharts.LineSeries);
	mainSeries.setData(generateData());

	return new Promise(resolve => {
		requestAnimationFrame(() => resolve());
	});
}

function afterInitialInteractions() {
	return new Promise(resolve => {
		requestAnimationFrame(() => resolve());
	});
}

function afterFinalInteractions() {
	// On iPadOS an external mouse's wheel events are not dispatched to elements
	// that establish a scroll container (e.g. `overflow: hidden`) — the browser
	// consumes the wheel gesture for native scrolling instead. The chart must not
	// create scroll containers anywhere under the cursor so that wheel events reach
	// the chart's own handler (see https://bugs.webkit.org/show_bug.cgi?id=244097).
	const chartElement = document.querySelector('.tv-lightweight-charts');
	if (chartElement === null) {
		throw new Error('Expected to find the chart element.');
	}

	// Only the chart's own layout elements are relevant — SVG internals always
	// report `overflow: hidden` from the UA stylesheet and are unrelated.
	const offenders = [];
	const checkElement = (element) => {
		if (element instanceof SVGElement) {
			return;
		}
		if (element.style.overflow === 'hidden') {
			offenders.push(`${element.tagName}.${element.className}`);
		}
		for (let i = 0; i < element.children.length; i++) {
			checkElement(element.children[i]);
		}
	};
	checkElement(chartElement);

	if (offenders.length > 0) {
		throw new Error(
			`Chart contains scroll containers which swallow iPadOS wheel events: ${offenders.join(', ')}`
		);
	}

	return Promise.resolve();
}