/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/consistent-type-assertions */
import { expect } from 'chai';
import { describe, it } from 'node:test';

import { chartOptionsDefaults } from '../../src/api/options/chart-options-defaults';
import { priceLineOptionsDefaults } from '../../src/api/options/price-line-options-defaults';
import { priceScaleOptionsDefaults } from '../../src/api/options/price-scale-options-defaults';
import { seriesOptionsDefaults } from '../../src/api/options/series-options-defaults';
import { PriceLine } from '../../src/api/price-line-api';
import { PriceScaleApi } from '../../src/api/price-scale-api';
import { IChartWidgetBase } from '../../src/gui/chart-widget';
import { Mutable } from '../../src/helpers/mutable';
import { clone, merge } from '../../src/helpers/strict-type-checks';
import { ChartModel, ChartOptionsInternalBase } from '../../src/model/chart-model';
import { CustomPriceLine } from '../../src/model/custom-price-line';
import { HorzScaleBehaviorTime } from '../../src/model/horz-scale-behavior-time/horz-scale-behavior-time';
import { Time } from '../../src/model/horz-scale-behavior-time/types';
import { PriceLineOptions } from '../../src/model/price-line-options';
import { createPriceScaleOptions, PriceScaleOptions } from '../../src/model/price-scale';
import { Series, SeriesOptionsInternal } from '../../src/model/series';
import { lineSeries, lineStyleDefaults } from '../../src/model/series/line-series';
import { SeriesDefinitionInternal } from '../../src/model/series/series-def';

const overlayScaleId = 'volume';

function createModel(): ChartModel<Time> {
	const options = clone(chartOptionsDefaults<Time>());
	return new ChartModel<Time>(() => {}, options, new HorzScaleBehaviorTime());
}

function createLineSeriesOnOverlayScale(model: ChartModel<Time>): Series<'Line'> {
	const options = merge(
		clone(seriesOptionsDefaults),
		clone(lineStyleDefaults),
		{ priceScaleId: overlayScaleId }
	) as SeriesOptionsInternal<'Line'>;
	const definition = lineSeries as SeriesDefinitionInternal<'Line'>;
	return new Series(model, 'Line', options, definition.createPaneView);
}

function createChartWidget(model: ChartModel<Time>): IChartWidgetBase {
	return {
		getPriceAxisWidth: () => 0,
		model: () => model,
		paneWidgets: () => [],
		options: () => ({} as ChartOptionsInternalBase),
		setCursorStyle: () => {},
	};
}

function createPriceLine(options: Partial<PriceLineOptions> = {}): CustomPriceLine {
	const model = createModel();
	const series = createLineSeriesOnOverlayScale(model);
	model.addSeriesToPane(series, 0);
	const strictOptions = merge(clone(priceLineOptionsDefaults), options) as PriceLineOptions;
	return series.createPriceLine(strictOptions);
}

describe('PriceLine.options()', () => {
	it('returns the options of the price line', () => {
		const priceLine = createPriceLine({ price: 10, color: 'red' });

		expect(priceLine.options()).to.deep.equal({
			...priceLineOptionsDefaults,
			price: 10,
			color: 'red',
		});
	});

	it('returns a copy that is not shared with the price line', () => {
		const priceLine = createPriceLine({ price: 10 });
		const api = new PriceLine(priceLine);

		const options = api.options();

		expect(options).to.not.equal(priceLine.options());
		expect(options).to.deep.equal(priceLine.options());
	});

	it('does not let the caller change the price line by mutating the returned options', () => {
		const priceLine = createPriceLine({ price: 10, color: 'red' });
		const api = new PriceLine(priceLine);

		const options = api.options() as Mutable<PriceLineOptions>;
		options.price = 20;
		options.color = 'blue';

		expect(priceLine.options().price).to.equal(10);
		expect(priceLine.options().color).to.equal('red');
		expect(api.options()).to.deep.equal(priceLine.options());
	});

	it('returns options that are not changed by a later applyOptions call', () => {
		const priceLine = createPriceLine({ price: 10 });
		const api = new PriceLine(priceLine);

		const options = api.options();
		api.applyOptions({ price: 20 });

		expect(options.price).to.equal(10);
		expect(api.options().price).to.equal(20);
	});
});

describe('PriceScaleApi.options()', () => {
	it('returns a copy that is not shared with an existing price scale', () => {
		const model = createModel();
		model.addSeriesToPane(createLineSeriesOnOverlayScale(model), 0);
		const api = new PriceScaleApi(createChartWidget(model), overlayScaleId);
		const scale = model.findPriceScale(overlayScaleId, 0);

		const options = api.options();

		expect(scale).to.not.equal(null);
		expect(options).to.not.equal(scale?.priceScale.options());
		expect(options).to.deep.equal(scale?.priceScale.options());
	});

	it('does not let the caller change an existing price scale by mutating the returned options', () => {
		const model = createModel();
		model.addSeriesToPane(createLineSeriesOnOverlayScale(model), 0);
		const api = new PriceScaleApi(createChartWidget(model), overlayScaleId);

		const options = api.options() as Mutable<PriceScaleOptions>;
		options.invertScale = true;
		options.scaleMargins.top = 0.9;

		expect(api.options().invertScale).to.equal(false);
		expect(api.options().scaleMargins).to.deep.equal(priceScaleOptionsDefaults.scaleMargins);
	});

	it('returns options that are not changed by a later applyOptions call', () => {
		const model = createModel();
		model.addSeriesToPane(createLineSeriesOnOverlayScale(model), 0);
		const api = new PriceScaleApi(createChartWidget(model), overlayScaleId);

		const options = api.options();
		api.applyOptions({ invertScale: true });

		expect(options.invertScale).to.equal(false);
		expect(api.options().invertScale).to.equal(true);
	});

	it('returns a copy for a default price scale', () => {
		const model = createModel();
		const api = new PriceScaleApi(createChartWidget(model), 'right');
		const rightScale = model.findPriceScale('right', 0);

		const options = api.options();

		expect(rightScale).to.not.equal(null);
		expect(options).to.not.equal(rightScale?.priceScale.options());
		expect(options).to.deep.equal(rightScale?.priceScale.options());
	});

	it('returns a copy for an overlay price scale that does not exist yet', () => {
		const model = createModel();
		const api = new PriceScaleApi(createChartWidget(model), overlayScaleId);

		const options = api.options() as Mutable<PriceScaleOptions>;
		options.invertScale = true;

		expect(api.options()).to.deep.equal(createPriceScaleOptions(model.options().overlayPriceScales));
	});
});
