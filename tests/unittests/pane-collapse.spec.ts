/* eslint-disable @typescript-eslint/no-floating-promises */
import { expect } from 'chai';
import { describe, it } from 'node:test';

import { chartOptionsDefaults } from '../../src/api/options/chart-options-defaults';
import { ChartModel } from '../../src/model/chart-model';
import { HorzScaleBehaviorTime } from '../../src/model/horz-scale-behavior-time/horz-scale-behavior-time';
import { Time } from '../../src/model/horz-scale-behavior-time/types';

function createModel(): ChartModel<Time> {
	const options = chartOptionsDefaults<Time>();
	return new ChartModel<Time>(() => {}, options, new HorzScaleBehaviorTime());
}

describe('Pane collapse', () => {
	it('stretchFactor() should return 0 for a collapsed pane and the previous value after restore()', () => {
		const model = createModel();

		const firstPane = model.addPane();
		const secondPane = model.addPane();
		const secondPaneIndex = model.getPaneIndex(secondPane);

		const stretchBefore = secondPane.stretchFactor();
		expect(stretchBefore).to.be.greaterThan(0);
		expect(firstPane.isCollapsed()).to.be.equal(false);

		model.collapsePane(secondPaneIndex);

		expect(secondPane.isCollapsed()).to.be.equal(true);
		expect(secondPane.stretchFactor()).to.be.equal(0);

		model.restorePane(secondPaneIndex);

		expect(secondPane.isCollapsed()).to.be.equal(false);
		expect(secondPane.stretchFactor()).to.be.equal(stretchBefore);
	});

	it('setStretchFactor() on a collapsed pane should not affect the reported stretch factor until restored', () => {
		const model = createModel();

		model.addPane();
		const secondPane = model.addPane();
		const secondPaneIndex = model.getPaneIndex(secondPane);

		model.collapsePane(secondPaneIndex);
		secondPane.setStretchFactor(100);

		expect(secondPane.stretchFactor()).to.be.equal(0);

		model.restorePane(secondPaneIndex);

		expect(secondPane.stretchFactor()).to.be.equal(100);
	});

	it('collapse() and restore() should be no-ops when already collapsed/restored', () => {
		const model = createModel();

		const pane = model.addPane();

		pane.restore();
		expect(pane.isCollapsed()).to.be.equal(false);

		pane.collapse();
		pane.collapse();
		expect(pane.isCollapsed()).to.be.equal(true);

		pane.restore();
		pane.restore();
		expect(pane.isCollapsed()).to.be.equal(false);
	});
});
