let dblClickParams;
let crosshairMoves = 0;
let series;

function initialInteractionsToPerform() {
	return [];
}

function finalInteractionsToPerform() {
	return [
		{ action: 'tap', target: 'pane' },
		{ action: 'tap', target: 'pane' },
	];
}

function beforeInteractions(container) {
	const chart = LightweightCharts.createChart(container, {
		layout: {
			attributionLogo: false,
		},
		rightPriceScale: {
			visible: false,
		},
	});

	series = chart.addSeries(LightweightCharts.LineSeries);
	series.setData([
		{ time: '2020-01-01', value: 10 },
		{ time: '2020-01-02', value: 20 },
		{ time: '2020-01-03', value: 30 },
	]);

	chart.timeScale().fitContent();

	return new Promise(resolve => {
		requestAnimationFrame(() => {
			// Put the price line in the middle of the pane, which is where the taps land.
			const price = series.coordinateToPrice(chart.paneSize().height / 2);
			series.createPriceLine({
				price,
				id: 'TEST',
				lineWidth: 4,
			});

			chart.subscribeDblClick(mouseParams => {
				dblClickParams = mouseParams;
			});
			chart.subscribeCrosshairMove(() => {
				crosshairMoves += 1;
			});

			requestAnimationFrame(() => resolve());
		});
	});
}

function afterInitialInteractions() {
	return Promise.resolve();
}

function afterFinalInteractions() {
	if (
		!dblClickParams ||
		dblClickParams.hoveredObjectId !== 'TEST' ||
		dblClickParams.hoveredSeries !== series
	) {
		throw new Error(`Expected a double tap to report the price line as the hovered object. Received hoveredObjectId=${String(dblClickParams && dblClickParams.hoveredObjectId)}.`);
	}

	if (
		!dblClickParams.hoveredInfo ||
		dblClickParams.hoveredInfo.type !== 'price-line' ||
		dblClickParams.hoveredInfo.objectKind !== 'custom-price-line'
	) {
		throw new Error(`Expected price line hover metadata for a double tap. Received ${JSON.stringify(dblClickParams.hoveredInfo)}.`);
	}

	if (crosshairMoves !== 0) {
		throw new Error('Expected a double tap to not move the crosshair.');
	}

	return Promise.resolve();
}
