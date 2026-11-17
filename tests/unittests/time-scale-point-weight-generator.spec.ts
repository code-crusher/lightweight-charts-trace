/* eslint-disable @typescript-eslint/no-floating-promises */
import { expect } from 'chai';
import { describe, it } from 'node:test';

import { Mutable } from '../../src/helpers/mutable';
import { fillWeightsForPoints } from '../../src/model/horz-scale-behavior-time/time-scale-point-weight-generator';
import { convertTime } from '../../src/model/horz-scale-behavior-time/time-utils';
import { TickMarkWeight, UTCTimestamp } from '../../src/model/horz-scale-behavior-time/types';
import { TickMarkWeightValue, TimeScalePoint } from '../../src/model/time-data';

function createPoints(timestamps: number[]): Mutable<TimeScalePoint>[] {
	return timestamps.map((timestamp: number) => ({
		timeWeight: TickMarkWeight.LessThanSecond as TickMarkWeightValue,
		time: convertTime(timestamp as UTCTimestamp),
		originalTime: timestamp as UTCTimestamp,
	}));
}

function weights(points: Mutable<TimeScalePoint>[]): TickMarkWeightValue[] {
	return points.map((point: Mutable<TimeScalePoint>) => point.timeWeight);
}

describe('fillWeightsForPoints', () => {
	it('should estimate the weight of the first point from the average time diff', () => {
		// a year of daily bars starting mid-year: the first point is estimated from the average spacing
		const day = 24 * 60 * 60;
		const start = Date.UTC(2023, 9, 1) / 1000;
		const timestamps: number[] = [];
		for (let i = 0; i < 365; i++) {
			timestamps.push(start + i * day);
		}
		const points = createPoints(timestamps);

		fillWeightsForPoints(points);

		expect(points[0].timeWeight).to.be.equal(TickMarkWeight.Month);
		expect(points[1].timeWeight).to.be.equal(TickMarkWeight.Day);
	});

	it('should include the gap between the first two points in the average time diff', () => {
		// the gap between the first two points is a year, the rest are daily;
		// the average gap over the whole series is ~1/3 of a year,
		// so the estimated previous point lands before the year boundary and the first point is a Year
		const day = 24 * 60 * 60;
		const start = Date.UTC(2022, 0, 1) / 1000;
		const timestamps = [start, start + 365 * day, start + 366 * day, start + 367 * day];
		const points = createPoints(timestamps);

		fillWeightsForPoints(points);

		expect(points[0].timeWeight).to.be.equal(TickMarkWeight.Year);
	});

	it('should not drop the time difference when a point is at the unix epoch', () => {
		// a timestamp of 0 is falsy, so `prevTime || currentTime` would silently drop the gap between the points
		const day = 24 * 60 * 60;
		const points = createPoints([0, day]);

		fillWeightsForPoints(points);

		// without the fix the gap between the points is lost and the average diff becomes 0,
		// so the first point would get TickMarkWeight.LessThanSecond instead of TickMarkWeight.Year
		expect(points[0].timeWeight).to.be.equal(TickMarkWeight.Year);
		expect(points[1].timeWeight).to.be.equal(TickMarkWeight.Day);
	});

	it('should include the gap between the first two points when the first one is at the unix epoch', () => {
		// the whole series spans the 1969 -> 1970 year boundary
		const day = 24 * 60 * 60;
		const points = createPoints([0, day, 2 * day]);

		fillWeightsForPoints(points);

		expect(points[0].timeWeight).to.be.equal(TickMarkWeight.Year);
		expect(points[1].timeWeight).to.be.equal(TickMarkWeight.Day);
		expect(points[2].timeWeight).to.be.equal(TickMarkWeight.Day);
	});

	it('should set weights only for the points from the given index', () => {
		const day = 24 * 60 * 60;
		const start = Date.UTC(2024, 0, 1) / 1000;
		const timestamps = [start, start + day, start + 2 * day];
		const points = createPoints(timestamps);
		points[0].timeWeight = 123 as TickMarkWeightValue;

		fillWeightsForPoints(points, 1);

		expect(points[0].timeWeight).to.be.equal(123 as TickMarkWeightValue);
		expect(weights(points).slice(1)).to.deep.equal([TickMarkWeight.Day, TickMarkWeight.Day]);
	});

	it('should handle an empty array and a single point', () => {
		expect(() => fillWeightsForPoints([])).to.not.throw();

		const points = createPoints([Date.UTC(2024, 0, 1) / 1000]);
		expect(() => fillWeightsForPoints(points)).to.not.throw();
	});
});
