/* eslint-disable @typescript-eslint/no-floating-promises */
import { expect } from 'chai';
import { describe, it } from 'node:test';

import { chartOptionsDefaults } from '../../src/api/options/chart-options-defaults';
import { seriesOptionsDefaults } from '../../src/api/options/series-options-defaults';
import { merge, clone } from '../../src/helpers/strict-type-checks';
import { ChartModel } from '../../src/model/chart-model';
import { HorzScaleBehaviorTime } from '../../src/model/horz-scale-behavior-time/horz-scale-behavior-time';
import { Time, UTCTimestamp } from '../../src/model/horz-scale-behavior-time/types';
import { InternalHorzScaleItem } from '../../src/model/ihorz-scale-behavior';
import { PriceAxisViewRendererData } from '../../src/renderers/iprice-axis-view-renderer';
import { RangeImpl } from '../../src/model/range-impl';
import { lineSeries, lineStyleDefaults } from '../../src/model/series/line-series';
import { SeriesOptionsInternal, Series } from '../../src/model/series';
import { SeriesDefinitionInternal } from '../../src/model/series/series-def';
import { TickMarkWeightValue, TimePointIndex, TimeScalePoint } from '../../src/model/time-data';
import { SeriesPriceAxisView } from '../../src/views/price-axis/series-price-axis-view';

/**
 * The price axis view resolves label colors through computed styles (see
 * getRgbStringViaBrowser in colors.ts), which don't exist in the unit test
 * environment - provide the minimal surface it touches.
 */
(globalThis as unknown as { document: unknown }).document = {
	createElement: () => ({ style: {} }),
	body: { appendChild: () => {}, removeChild: () => {} },
};
(globalThis as unknown as { window: unknown }).window = {
	getComputedStyle: () => ({ color: 'rgb(41, 98, 255)' }),
};

function createModel(): ChartModel<Time> {
	const chartOptions = merge(
		clone(chartOptionsDefaults<Time>()),
		{ localization: { locale: 'en-US' } }
	);
	const horzScaleBehavior = new HorzScaleBehaviorTime();
	// createChartEx does this after constructing the chart; the time formatters need it
	horzScaleBehavior.setOptions(chartOptions);
	return new ChartModel<Time>(() => {}, chartOptions, horzScaleBehavior);
}

function points(count: number, from: number = 0): TimeScalePoint[] {
	const result: TimeScalePoint[] = [];
	for (let i = from; i < from + count; ++i) {
		result.push({
			time: { timestamp: i as UTCTimestamp } as unknown as InternalHorzScaleItem,
			timeWeight: 20 as TickMarkWeightValue,
			originalTime: i as UTCTimestamp,
		});
	}
	return result;
}

function createLineSeries(model: ChartModel<Time>, seriesOptions: object = {}): Series<'Line'> {
	const options = merge(
		merge(clone(seriesOptionsDefaults), clone(lineStyleDefaults)),
		seriesOptions
	) as SeriesOptionsInternal<'Line'>;
	const definition = lineSeries as SeriesDefinitionInternal<'Line'>;
	const series = new Series(model, 'Line', options, definition.createPaneView);
	model.addSeriesToPane(series, 0);
	return series;
}

// triggers the lazy renderer data update (via text()) and returns the axis renderer data
function axisRendererData(view: SeriesPriceAxisView): PriceAxisViewRendererData {
	view.text();
	return (view as unknown as { _axisRendererData: PriceAxisViewRendererData })._axisRendererData;
}

describe('Last value time label under the price label', () => {
	const setup = (seriesOptions: object = {}) => {
		const model = createModel();
		const series = createLineSeries(model, seriesOptions);

		series.setData(points(10).map((point: TimeScalePoint, index: number) => ({
			index: index as TimePointIndex,
			time: point.time,
			originalTime: point.originalTime,
			value: [index, index, index, index],
		})));
		model.updateTimeScale(9 as TimePointIndex, points(10), 0);
		model.timeScale().setWidth(500);
		model.panes()[0].setHeight(300);
		model.timeScale().setVisibleRange(new RangeImpl(0 as TimePointIndex, 9 as TimePointIndex), false);
		model.recalculatePane(model.panes()[0]);

		return { model, series };
	};

	it('does not add a second line to the last value label by default', () => {
		const { series } = setup();

		const view = new SeriesPriceAxisView(series);
		const data = axisRendererData(view);

		expect(data.visible).to.be.equal(true);
		expect(data.secondLineText).to.be.equal(undefined);
	});

	it('shows the date/time of the last visible bar under the price when lastValueTimeVisible is enabled', () => {
		const { model, series } = setup({ lastValueTimeVisible: true });

		const view = new SeriesPriceAxisView(series);
		const data = axisRendererData(view);

		expect(data.visible).to.be.equal(true);
		expect(data.text).to.be.equal('9.00');
		// the label is taller than a single-line label
		const rendererOptions = model.priceAxisRendererOptions();
		expect(view.height(rendererOptions, false)).to.be.equal(
			rendererOptions.fontSize + rendererOptions.paddingTop + rendererOptions.paddingBottom
				+ Math.max(rendererOptions.fontSize - 2, Math.floor(rendererOptions.fontSize * 0.75)) + rendererOptions.paddingBottom
		);
	});

	it('formats the second line with the time scale date/time formatter', () => {
		const { model, series } = setup({ lastValueTimeVisible: true });

		const view = new SeriesPriceAxisView(series);
		const data = axisRendererData(view);

		const timeScalePoint = model.timeScale().indexToTimeScalePoint(9 as TimePointIndex);
		expect(timeScalePoint).to.be.not.equal(null);
		expect(data.secondLineText).to.be.equal(model.timeScale().formatDateTime(timeScalePoint!));
		// timestamps 0..9 are all on 1970-01-01, rendered with the default date format
		expect(data.secondLineText).to.be.equal("01 Jan '70");
	});

	it('clears the second line when the option is turned off', () => {
		const { series } = setup({ lastValueTimeVisible: true });

		const view = new SeriesPriceAxisView(series);
		expect(axisRendererData(view).secondLineText).to.not.be.equal(undefined);

		series.applyOptions({ lastValueTimeVisible: false });
		view.update();
		expect(axisRendererData(view).secondLineText).to.be.equal(undefined);
	});

	it('does not add a second line when the last value label itself is hidden', () => {
		const { series } = setup({ lastValueVisible: false, lastValueTimeVisible: true });

		const view = new SeriesPriceAxisView(series);
		const data = axisRendererData(view);

		expect(data.visible).to.be.equal(false);
		expect(data.secondLineText).to.be.equal(undefined);
	});

	it('has a single-line height when the second line is absent', () => {
		const { model, series } = setup({ lastValueTimeVisible: true });

		const view = new SeriesPriceAxisView(series);
		const withSecondLine = view.height(model.priceAxisRendererOptions(), false);

		series.applyOptions({ lastValueTimeVisible: false });
		view.update();

		const rendererOptions = model.priceAxisRendererOptions();
		expect(view.height(rendererOptions, false)).to.be.equal(
			rendererOptions.fontSize + rendererOptions.paddingTop + rendererOptions.paddingBottom
		);
		expect(withSecondLine).to.be.greaterThan(view.height(rendererOptions, false));
	});
});
