function generateData() {
	const res = [];
	const time = new Date(Date.UTC(2018, 0, 1, 0, 0, 0, 0));
	for (let i = 1; i < 100; ++i) {
		res.push({
			time: time.getTime() / 1000,
			value: 100 + Math.sin(i / 5) * 10,
		});

		time.setUTCDate(time.getUTCDate() + 1);
	}

	return res;
}

class AxisView {
	constructor(coordinate, color, text) {
		this._coordinate = coordinate;
		this._color = color;
		this._text = text;
	}
	coordinate() {
		return this._coordinate;
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
}

class TestPlugin {
	constructor(timeAxisViews, priceAxisViews) {
		this._timeAxisViews = timeAxisViews;
		this._priceAxisViews = priceAxisViews;
	}
	timeAxisViews() {
		return this._timeAxisViews;
	}
	priceAxisViews() {
		return this._priceAxisViews;
	}
}

function runTestCase(container) {
	const chart = (window.chart = LightweightCharts.createChart(container, { layout: { attributionLogo: false } }));
	const mainSeries = chart.addSeries(LightweightCharts.LineSeries);
	mainSeries.setData(generateData());
	chart.timeScale().fitContent();

	// Reproduce issue #1886: labels which are close to each other used to be drawn on top of
	// each other. The time axis labels below overlap when drawn at their requested coordinates.
	const colors = ['#0000FF', '#FF0000', '#00AA00', '#AA00AA', '#AA6600'];
	const timeAxisViews = [
		new AxisView(0, colors[0], 'AAAA'),
		new AxisView(20, colors[1], 'BBBB'),
		new AxisView(40, colors[2], 'CCCC'),
		new AxisView(58, colors[3], 'DDDD'),
		new AxisView(400, colors[4], 'EEEE'),
	];

	const priceAxisViews = [
		new AxisView(mainSeries.priceToCoordinate(95), colors[0], '95.00'),
		new AxisView(mainSeries.priceToCoordinate(95.5), colors[1], '95.50'),
		new AxisView(mainSeries.priceToCoordinate(96), colors[2], '96.00'),
	];

	mainSeries.attachPrimitive(new TestPlugin(timeAxisViews, priceAxisViews));
}
