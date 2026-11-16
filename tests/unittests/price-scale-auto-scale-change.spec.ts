/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/consistent-type-assertions */
import { expect } from 'chai';
import { describe, it } from 'node:test';

import { chartOptionsDefaults } from '../../src/api/options/chart-options-defaults';
import { seriesOptionsDefaults } from '../../src/api/options/series-options-defaults';
import { PriceScaleApi } from '../../src/api/price-scale-api';
import { IChartWidgetBase } from '../../src/gui/chart-widget';
import { clone, merge } from '../../src/helpers/strict-type-checks';
import { ChartModel, ChartOptionsInternal, ChartOptionsInternalBase } from '../../src/model/chart-model';
import { HorzScaleBehaviorTime } from '../../src/model/horz-scale-behavior-time/horz-scale-behavior-time';
import { Time } from '../../src/model/horz-scale-behavior-time/types';
import { PriceRangeImpl } from '../../src/model/price-range-impl';
import { PriceScale, PriceScaleMode } from '../../src/model/price-scale';
import { Series, SeriesOptionsInternal } from '../../src/model/series';
import { lineSeries, lineStyleDefaults } from '../../src/model/series/line-series';
import { SeriesDefinitionInternal } from '../../src/model/series/series-def';
import { TimePointIndex, TimeScalePoint } from '../../src/model/time-data';

function createModel(options?: Partial<ChartOptionsInternal<Time>>): ChartModel<Time> {
	const chartOptions = merge(clone(chartOptionsDefaults<Time>()), options ?? {}) as ChartOptionsInternal<Time>;
	return new ChartModel<Time>(() => {}, chartOptions, new HorzScaleBehaviorTime());
}

function createPriceScaleApi(model: ChartModel<Time>, priceScaleId: string = 'right'): PriceScaleApi {
	const chartWidget: IChartWidgetBase = {
		getPriceAxisWidth: () => 0,
		model: () => model,
		paneWidgets: () => [],
		options: () => ({} as ChartOptionsInternalBase),
		setCursorStyle: () => {},
	};
	return new PriceScaleApi(chartWidget, priceScaleId);
}

function rightPriceScale(model: ChartModel<Time>): PriceScale {
	return model.panes()[0].rightPriceScale();
}

function createLineSeries(model: ChartModel<Time>, priceScaleId?: string): Series<'Line'> {
	const options = merge(
		clone(seriesOptionsDefaults),
		clone(lineStyleDefaults),
		priceScaleId === undefined ? {} : { priceScaleId }
	) as SeriesOptionsInternal<'Line'>;
	const definition = lineSeries as SeriesDefinitionInternal<'Line'>;
	const series = new Series(model, 'Line', options, definition.createPaneView);
	model.addSeriesToPane(series, 0);
	return series;
}

function setData(model: ChartModel<Time>): void {
	const points: TimeScalePoint[] = [];
	for (let i = 0; i < 10; ++i) {
		points.push({
			time: { timestamp: i } as never,
			timeWeight: 20 as never,
			originalTime: i as never,
		});
	}
	model.updateTimeScale(9 as TimePointIndex, points, 0);
}

function collectChanges(model: ChartModel<Time>, priceScaleId: string = 'right'): boolean[] {
	const changes: boolean[] = [];
	createPriceScaleApi(model, priceScaleId).subscribeAutoScaleChange((autoScale: boolean) => changes.push(autoScale));
	return changes;
}

describe('PriceScaleApi auto scale change subscription', () => {
	it('notifies subscribers when auto scale is changed programmatically', () => {
		const model = createModel();
		createLineSeries(model);
		const changes = collectChanges(model);

		createPriceScaleApi(model).setAutoScale(false);
		createPriceScaleApi(model).setAutoScale(true);

		expect(changes).to.deep.equal([false, true]);
	});

	it('notifies subscribers when auto scale is changed through applyOptions', () => {
		const model = createModel();
		createLineSeries(model);
		const changes = collectChanges(model);

		createPriceScaleApi(model).applyOptions({ autoScale: false });

		expect(changes).to.deep.equal([false]);
	});

	it('notifies subscribers when auto scale is changed through the chart options', () => {
		const model = createModel();
		createLineSeries(model);
		const changes = collectChanges(model);

		model.applyOptions({ rightPriceScale: { autoScale: false } });

		expect(changes).to.deep.equal([false]);
	});

	it('notifies subscribers when the user disables auto scale by dragging the price axis', () => {
		const model = createModel();
		const series = createLineSeries(model);
		setData(model);
		model.setWidth(600);
		model.panes()[0].setHeight(400);
		series.priceScale().setPriceRange(new PriceRangeImpl(10, 100));

		const changes = collectChanges(model);
		const pane = model.panes()[0];

		// mimics the drag performed by the price axis widget
		model.startScalePrice(pane, rightPriceScale(model), 200);
		model.scalePriceTo(pane, rightPriceScale(model), 100);

		expect(rightPriceScale(model).isAutoScale()).to.equal(false);
		expect(changes).to.deep.equal([false]);
	});

	it('notifies subscribers when auto scale is restored by double-clicking the price axis', () => {
		const model = createModel();
		const series = createLineSeries(model);
		setData(model);
		model.setWidth(600);
		model.panes()[0].setHeight(400);
		series.priceScale().setPriceRange(new PriceRangeImpl(10, 100));
		createPriceScaleApi(model).setAutoScale(false);

		const changes = collectChanges(model);

		// mimics the double-click on the price axis
		model.resetPriceScale(model.panes()[0], rightPriceScale(model));

		expect(rightPriceScale(model).isAutoScale()).to.equal(true);
		expect(changes).to.deep.equal([true]);
	});

	it('does not notify subscribers when the value does not actually change', () => {
		const model = createModel();
		createLineSeries(model);
		const changes = collectChanges(model);

		createPriceScaleApi(model).setAutoScale(true);
		createPriceScaleApi(model).applyOptions({ autoScale: true });
		createPriceScaleApi(model).applyOptions({ invertScale: true });

		expect(changes).to.deep.equal([]);
	});

	it('notifies subscribers when auto scale is enabled by switching to percentage mode', () => {
		const model = createModel();
		createLineSeries(model);
		createPriceScaleApi(model).setAutoScale(false);
		const changes = collectChanges(model);

		rightPriceScale(model).setMode({ mode: PriceScaleMode.Percentage });

		expect(rightPriceScale(model).isAutoScale()).to.equal(true);
		expect(changes).to.deep.equal([true]);
	});

	it('stops notifying after unsubscribing', () => {
		const model = createModel();
		createLineSeries(model);
		const api = createPriceScaleApi(model);
		const changes: boolean[] = [];
		const handler = (autoScale: boolean) => changes.push(autoScale);
		api.subscribeAutoScaleChange(handler);

		api.setAutoScale(false);
		api.unsubscribeAutoScaleChange(handler);
		api.setAutoScale(true);

		expect(changes).to.deep.equal([false]);
	});

	it('does not throw when unsubscribing from an overlay scale that was removed with its series', () => {
		const model = createModel();
		const series = createLineSeries(model, 'volume');
		const api = createPriceScaleApi(model, 'volume');
		const changes: boolean[] = [];
		const handler = (autoScale: boolean) => changes.push(autoScale);
		api.subscribeAutoScaleChange(handler);

		// removing the only series also removes its overlay price scale
		model.removeSeries(series);
		expect(model.findPriceScale('volume', 0)).to.equal(null);

		expect(() => api.unsubscribeAutoScaleChange(handler)).to.not.throw();
		expect(changes).to.deep.equal([]);
	});
});
