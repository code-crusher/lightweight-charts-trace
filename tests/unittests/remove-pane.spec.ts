/* eslint-disable @typescript-eslint/no-floating-promises */
import { expect } from 'chai';
import { describe, it } from 'node:test';

import { chartOptionsDefaults } from '../../src/api/options/chart-options-defaults';
import { seriesOptionsDefaults } from '../../src/api/options/series-options-defaults';
import { clone, merge } from '../../src/helpers/strict-type-checks';
import { ChartModel, ChartOptionsInternal } from '../../src/model/chart-model';
import { HorzScaleBehaviorTime } from '../../src/model/horz-scale-behavior-time/horz-scale-behavior-time';
import { Time } from '../../src/model/horz-scale-behavior-time/types';
import { Series, SeriesOptionsInternal } from '../../src/model/series';
import { lineSeries, lineStyleDefaults } from '../../src/model/series/line-series';
import { SeriesDefinitionInternal } from '../../src/model/series/series-def';

function createModel(): ChartModel<Time> {
	const chartOptions: ChartOptionsInternal<Time> = clone(chartOptionsDefaults<Time>());
	const horzScaleBehavior = new HorzScaleBehaviorTime();
	// createChartEx does this after constructing the chart; the time formatters need it
	horzScaleBehavior.setOptions(chartOptions);
	return new ChartModel<Time>(() => {}, chartOptions, horzScaleBehavior);
}

function createLineSeries(model: ChartModel<Time>, paneIndex: number = 0): Series<'Line'> {
	const options = merge(clone(seriesOptionsDefaults), clone(lineStyleDefaults)) as SeriesOptionsInternal<'Line'>;
	const definition = lineSeries as SeriesDefinitionInternal<'Line'>;
	const series = new Series(model, 'Line', options, definition.createPaneView);
	model.addSeriesToPane(series, paneIndex);
	return series;
}

describe('ChartModel.removePane', () => {
	it('removes the pane', () => {
		const model = createModel();
		const firstSeries = createLineSeries(model);
		model.addPane();
		const secondSeries = createLineSeries(model, 1);

		model.removePane(1);

		expect(model.panes().length).to.equal(1);
		expect(model.serieses().length).to.equal(1);
		expect(model.serieses()[0]).to.equal(firstSeries);
		expect(secondSeries.priceScale()).to.not.equal(null);
	});

	it('detaches the removed pane\'s series from the model', () => {
		const model = createModel();
		createLineSeries(model);
		model.addPane();
		const secondSeries = createLineSeries(model, 1);

		model.removePane(1);

		// the series of the removed pane must no longer be part of the model
		expect(model.serieses().includes(secondSeries)).to.equal(false);
		expect(model.visibleSerieses().includes(secondSeries)).to.equal(false);
	});

	it('allows removing a series whose pane has been removed', () => {
		const model = createModel();
		createLineSeries(model);
		model.addPane();
		const secondSeries = createLineSeries(model, 1);

		model.removePane(1);

		// a common app flow: removePane() and then clean up the series of that pane
		expect(() => model.removeSeries(secondSeries)).to.not.throw();
		expect(model.serieses().length).to.equal(1);
	});

	it('does nothing when removing the last remaining pane', () => {
		const model = createModel();
		createLineSeries(model);

		model.removePane(0);

		expect(model.panes().length).to.equal(1);
		expect(model.serieses().length).to.equal(1);
	});
});
