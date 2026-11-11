/* eslint-disable @typescript-eslint/no-floating-promises */
import { expect } from 'chai';
import { describe, it } from 'node:test';

import { ISeriesPrimitiveAxisView } from '../../src/model/iseries-primitive';
import { Series } from '../../src/model/series';
import { SeriesType } from '../../src/model/series-options';
import { SeriesPrimitiveWrapper } from '../../src/model/series-primitive-wrapper';
import { sortAxisViewsByZIndex } from '../../src/views/axis-view-z-order';

interface TestAxisView {
	name: string;
	zIndexValue: number;
	zIndex(): number;
}

function axisView(name: string, zIndexValue: number): TestAxisView {
	return {
		name,
		zIndexValue,
		zIndex: () => zIndexValue,
	};
}

function names(views: readonly TestAxisView[]): string[] {
	return views.map((view: TestAxisView) => view.name);
}

describe('sortAxisViewsByZIndex', () => {
	it('should keep the original order when every view has the same z-index', () => {
		const views = [axisView('first', 0), axisView('second', 0), axisView('third', 0)];

		expect(names(sortAxisViewsByZIndex(views))).to.deep.equal(['first', 'second', 'third']);
	});

	it('should draw views with a higher z-index last', () => {
		const views = [axisView('middle', 5), axisView('top', 10), axisView('bottom', -1)];

		expect(names(sortAxisViewsByZIndex(views))).to.deep.equal(['bottom', 'middle', 'top']);
	});

	it('should be stable for views sharing a z-index', () => {
		const views = [
			axisView('first-low', -5),
			axisView('first-high', 1),
			axisView('second-low', -5),
			axisView('second-high', 1),
		];

		expect(names(sortAxisViewsByZIndex(views))).to.deep.equal([
			'first-low',
			'second-low',
			'first-high',
			'second-high',
		]);
	});

	it('should not modify the passed array', () => {
		const views = [axisView('top', 1), axisView('bottom', 0)];

		sortAxisViewsByZIndex(views);

		expect(names(views)).to.deep.equal(['top', 'bottom']);
	});
});

describe('SeriesPrimitiveWrapper axis views z-index', () => {
	const wrapperFor = (views: readonly ISeriesPrimitiveAxisView[]): SeriesPrimitiveWrapper => {
		const series = {
			model: () => ({
				timeScale: () => ({ width: () => 100 }),
			}),
			priceScale: () => ({}),
		} as unknown as Series<SeriesType>;

		return new SeriesPrimitiveWrapper({ timeAxisViews: () => views, priceAxisViews: () => views }, series);
	};

	const viewWithZIndex = (zIndexValue?: number): ISeriesPrimitiveAxisView => ({
		coordinate: () => 10,
		text: () => 'label',
		textColor: () => '#000000',
		backColor: () => '#ffffff',
		zIndex: zIndexValue === undefined ? undefined : () => zIndexValue,
	});

	it('should default the z-index of a label to 0', () => {
		const wrapper = wrapperFor([viewWithZIndex()]);

		expect(wrapper.timeAxisViews()[0].zIndex()).to.be.equal(0);
		expect(wrapper.priceAxisViews()[0].zIndex()).to.be.equal(0);
	});

	it('should forward the z-index of the primitive label', () => {
		const wrapper = wrapperFor([viewWithZIndex(7)]);

		expect(wrapper.timeAxisViews()[0].zIndex()).to.be.equal(7);
		expect(wrapper.priceAxisViews()[0].zIndex()).to.be.equal(7);
	});
});
