/* eslint-disable @typescript-eslint/no-floating-promises */
import { expect } from 'chai';
import { describe, it } from 'node:test';

import { ChartWidget } from '../../src/gui/chart-widget';
import { PaneWidget } from '../../src/gui/pane-widget';
import { DefaultPriceScaleId } from '../../src/model/default-price-scale';
import { Time } from '../../src/model/horz-scale-behavior-time/types';

interface ChartWidgetInternals {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	_paneWidgets: PaneWidget[];
}

function createChartWidget(paneWidgets: PaneWidget[]): ChartWidget<Time> {
	// constructing a real chart widget requires a DOM, so build a bare instance
	// and inject the pane widgets the method under test works with
	const chartWidget = Object.create(ChartWidget.prototype) as ChartWidget<Time>;
	(chartWidget as unknown as ChartWidgetInternals)._paneWidgets = paneWidgets;
	return chartWidget;
}

function createPaneWidget(leftAxisVisible: boolean, rightAxisVisible: boolean, axisWidth: number): PaneWidget {
	const priceAxisWidget = {
		getWidth: () => axisWidth,
	};
	const pane = {
		leftPriceScale: () => ({ options: () => ({ visible: leftAxisVisible }) }),
		rightPriceScale: () => ({ options: () => ({ visible: rightAxisVisible }) }),
	};

	return {
		state: () => pane,
		leftPriceAxisWidget: () => priceAxisWidget,
		rightPriceAxisWidget: () => priceAxisWidget,
	} as unknown as PaneWidget;
}

describe('ChartWidget.getPriceAxisWidth', () => {
	it('returns 0 instead of throwing when there are no pane widgets yet', () => {
		const chartWidget = createChartWidget([]);

		expect(chartWidget.getPriceAxisWidth(DefaultPriceScaleId.Left)).to.equal(0);
		expect(chartWidget.getPriceAxisWidth(DefaultPriceScaleId.Right)).to.equal(0);
	});

	it('returns the width of a visible price axis', () => {
		const chartWidget = createChartWidget([createPaneWidget(true, true, 60)]);

		expect(chartWidget.getPriceAxisWidth(DefaultPriceScaleId.Left)).to.equal(60);
		expect(chartWidget.getPriceAxisWidth(DefaultPriceScaleId.Right)).to.equal(60);
	});

	it('returns 0 for a hidden price axis', () => {
		const chartWidget = createChartWidget([createPaneWidget(false, false, 60)]);

		expect(chartWidget.getPriceAxisWidth(DefaultPriceScaleId.Left)).to.equal(0);
		expect(chartWidget.getPriceAxisWidth(DefaultPriceScaleId.Right)).to.equal(0);
	});
});
