/*
	Reproduces issue #2066.

	Two primitives each draw an axis label at the same coordinate. The first
	primitive is attached first but asks for a higher z-index, so its label must
	be drawn on top of the label of the primitive attached after it.
 */

function generateData() {
	const res = [];
	const time = new Date(Date.UTC(2018, 0, 1, 0, 0, 0, 0));
	for (let i = 1; i < 500; ++i) {
		res.push({
			time: time.getTime() / 1000,
			value: i,
		});

		time.setUTCDate(time.getUTCDate() + 1);
	}

	return res;
}

class AxisView {
	constructor(text, color, position, zIndex) {
		this._text = text;
		this._color = color;
		this._position = position;
		this._zIndex = zIndex;
	}
	coordinate() {
		return this._position;
	}
	text() {
		return this._text;
	}
	textColor() {
		return '#FFFFFF';
	}
	backColor() {
		return this._color;
	}
	zIndex() {
		return this._zIndex;
	}
}

class TestPlugin {
	constructor(priceAxisViews, timeAxisViews) {
		this._priceAxisViews = priceAxisViews;
		this._timeAxisViews = timeAxisViews;
	}
	priceAxisViews() {
		return this._priceAxisViews;
	}
	timeAxisViews() {
		return this._timeAxisViews;
	}
}

function runTestCase(container) {
	const chart = (window.chart = LightweightCharts.createChart(container, { layout: { attributionLogo: false } }));
	const mainSeries = chart.addSeries(LightweightCharts.LineSeries);
	mainSeries.setData(generateData());

	// attached first, but must be drawn above the label of the next primitive
	mainSeries.attachPrimitive(new TestPlugin(
		[new AxisView('above', '#BB3355', 100, 1)],
		[new AxisView('above', '#BB3355', 250, 1)]
	));

	// attached last, but asks for a lower z-index
	mainSeries.attachPrimitive(new TestPlugin(
		[new AxisView('below', '#33AA55', 100, 0)],
		[new AxisView('below', '#33AA55', 250, 0)]
	));
}
