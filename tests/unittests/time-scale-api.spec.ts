/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { expect } from 'chai';
import { describe, it } from 'node:test';

import { chartOptionsDefaults } from '../../src/api/options/chart-options-defaults';
import { TimeScaleApi } from '../../src/api/time-scale-api';
import { ChartModel } from '../../src/model/chart-model';
import { HorzScaleBehaviorTime } from '../../src/model/horz-scale-behavior-time/horz-scale-behavior-time';
import { Time, UTCTimestamp } from '../../src/model/horz-scale-behavior-time/types';
import { InternalHorzScaleItem } from '../../src/model/ihorz-scale-behavior';
import { InvalidateMask, TimeScaleInvalidation, TimeScaleInvalidationType } from '../../src/model/invalidate-mask';
import { TickMarkWeightValue, TimePointIndex, TimeScalePoint } from '../../src/model/time-data';

function points(count: number): TimeScalePoint[] {
	const result: TimeScalePoint[] = [];
	for (let i = 0; i < count; ++i) {
		result.push({
			time: { timestamp: i as UTCTimestamp } as unknown as InternalHorzScaleItem,
			timeWeight: 20 as TickMarkWeightValue,
			originalTime: i as UTCTimestamp,
		});
	}
	return result;
}

describe('TimeScaleApi visible range reads (gh#1710)', () => {
	// The chart widget applies time scale changes (fitContent, setRightOffset, ...)
	// on the next animation frame. This fake replicates just that part: it collects
	// the invalidation masks the model hands over and applies their time scale
	// invalidations when asked to, either by a "draw" or by the flush the
	// getVisibleLogicalRange getter performs.
	function createFixture(): { timeScaleApi: TimeScaleApi<Time>; model: ChartModel<Time>; draw: () => void; appliedInvalidations: TimeScaleInvalidation[] } {
		const options = chartOptionsDefaults<Time>();
		options.timeScale = { ...options.timeScale, barSpacing: 1, rightOffset: 0 };

		let pendingMask: InvalidateMask | null = null;
		const appliedInvalidations: TimeScaleInvalidation[] = [];

		const invalidateHandler = (mask: InvalidateMask): void => {
			if (pendingMask === null) {
				pendingMask = mask;
			} else {
				pendingMask.merge(mask);
			}
		};
		const model = new ChartModel<Time>(invalidateHandler, options, new HorzScaleBehaviorTime());

		const apply = (mask: InvalidateMask): void => {
			const timeScale = model.timeScale();
			for (const invalidation of mask.timeScaleInvalidations()) {
				appliedInvalidations.push(invalidation);
				switch (invalidation.type) {
					case TimeScaleInvalidationType.FitContent:
						timeScale.fitContent();
						break;
					case TimeScaleInvalidationType.ApplyRange:
						timeScale.setLogicalRange(invalidation.value);
						break;
					case TimeScaleInvalidationType.ApplyBarSpacing:
						timeScale.setBarSpacing(invalidation.value);
						break;
					case TimeScaleInvalidationType.ApplyRightOffset:
						timeScale.setRightOffset(invalidation.value);
						break;
					case TimeScaleInvalidationType.Reset:
						timeScale.restoreDefault();
						break;
				}
			}
		};

		const fakeChartWidget = {
			flushPendingTimeScaleInvalidations: () => {
				if (pendingMask === null) {
					return;
				}
				const mask = pendingMask;
				pendingMask = null;
				apply(mask);
			},
		};
		const fakeTimeAxisWidget = {
			sizeChanged: () => ({ subscribe: () => {}, unsubscribe: () => {} }),
		};

		const timeScaleApi = new TimeScaleApi<Time>(
			model,
			fakeChartWidget as any,
			fakeTimeAxisWidget as any,
			new HorzScaleBehaviorTime()
		);

		return {
			timeScaleApi,
			model,
			draw: () => {
				if (pendingMask === null) {
					return;
				}
				const mask = pendingMask;
				pendingMask = null;
				apply(mask);
			},
			appliedInvalidations,
		};
	}

	it('getVisibleLogicalRange should return the range from before the fit until the invalidation is applied', () => {
		const { timeScaleApi, model, draw } = createFixture();
		const timeScale = model.timeScale();
		timeScale.setWidth(600);
		model.updateTimeScale(999 as TimePointIndex, points(1000), 0);
		draw();

		// the widget has applied everything; a read is up to date
		const initialRange = timeScaleApi.getVisibleLogicalRange();
		expect(initialRange?.from).to.be.equal(400);
		expect(initialRange?.to).to.be.equal(999);

		// fitContent queues an invalidation applied on the next animation frame...
		timeScaleApi.fitContent();
		// ...but the getter flushes it so it never reports a stale range (gh#1710)
		const fittedRange = timeScaleApi.getVisibleLogicalRange();
		expect(fittedRange?.from).to.be.equal(0);
		expect(fittedRange?.to).to.be.equal(999);

		// the next frame finds nothing left to apply and keeps the range
		draw();
		const afterDraw = timeScaleApi.getVisibleLogicalRange();
		expect(afterDraw?.from).to.be.equal(0);
		expect(afterDraw?.to).to.be.equal(999);
	});

	it('getVisibleLogicalRange should reflect fitContent and scrollToPosition called in the same frame (gh#1710 repro)', () => {
		const { timeScaleApi, model, draw } = createFixture();
		const timeScale = model.timeScale();
		timeScale.setWidth(600);
		model.updateTimeScale(999 as TimePointIndex, points(1000), 0);
		draw();

		timeScaleApi.fitContent();
		timeScaleApi.scrollToPosition(10, false);

		// both calls happened since the last draw; the read must see the result of both
		const range = timeScaleApi.getVisibleLogicalRange();
		expect(range?.from).to.be.equal(10);
		expect(range?.to).to.be.equal(1009);
	});

	it('scrollPosition should reflect a pending scrollToPosition call', () => {
		const { timeScaleApi, model, draw } = createFixture();
		const timeScale = model.timeScale();
		timeScale.setWidth(600);
		model.updateTimeScale(999 as TimePointIndex, points(1000), 0);
		draw();

		timeScaleApi.scrollToPosition(10, false);
		expect(timeScaleApi.scrollPosition()).to.be.equal(10);
	});

	it('getVisibleRange should reflect a pending fitContent call', () => {
		const { timeScaleApi, model, draw } = createFixture();
		const timeScale = model.timeScale();
		timeScale.setWidth(600);
		model.updateTimeScale(999 as TimePointIndex, points(1000), 0);
		draw();

		timeScaleApi.fitContent();
		const visibleRange = timeScaleApi.getVisibleRange();
		expect(visibleRange?.from).to.be.equal(0 as UTCTimestamp);
		expect(visibleRange?.to).to.be.equal(999 as UTCTimestamp);
	});
});
