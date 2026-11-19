/* eslint-disable @typescript-eslint/no-floating-promises */
import { expect } from 'chai';
import { describe, it } from 'node:test';

import { Mutable } from '../../src/helpers/mutable';
import { fillWeightsForPoints } from '../../src/model/horz-scale-behavior-time/time-scale-point-weight-generator';
import { TickMarkWeight, TimePoint } from '../../src/model/horz-scale-behavior-time/types';
import { InternalHorzScaleItem } from '../../src/model/ihorz-scale-behavior';
import { TickMarkWeightValue, TimeScalePoint } from '../../src/model/time-data';

function makePoints(timestamps: number[]): Mutable<TimeScalePoint>[] {
	return timestamps.map((timestamp: number) => ({
		timeWeight: 0 as TickMarkWeightValue,
		time: { timestamp: timestamp as TimePoint['timestamp'] } as unknown as InternalHorzScaleItem,
		originalTime: timestamp,
	}));
}

function weightsOf(points: Mutable<TimeScalePoint>[]): number[] {
	return points.map((point: Mutable<TimeScalePoint>) => point.timeWeight);
}

/**
 * The original implementation, kept here as a reference to make sure the optimized
 * version (which avoids allocating a Date per data point, see gh#1631) produces
 * exactly the same weights.
 */
function referenceWeight(currentMs: number, prevMs: number): TickMarkWeight {
	const currentDate = new Date(currentMs);
	const prevDate = new Date(prevMs);

	if (currentDate.getUTCFullYear() !== prevDate.getUTCFullYear()) {
		return TickMarkWeight.Year;
	} else if (currentDate.getUTCMonth() !== prevDate.getUTCMonth()) {
		return TickMarkWeight.Month;
	} else if (currentDate.getUTCDate() !== prevDate.getUTCDate()) {
		return TickMarkWeight.Day;
	}

	const divisors = [
		{ divisor: 1000, weight: TickMarkWeight.Second },
		{ divisor: 60 * 1000, weight: TickMarkWeight.Minute1 },
		{ divisor: 5 * 60 * 1000, weight: TickMarkWeight.Minute5 },
		{ divisor: 30 * 60 * 1000, weight: TickMarkWeight.Minute30 },
		{ divisor: 60 * 60 * 1000, weight: TickMarkWeight.Hour1 },
		{ divisor: 3 * 60 * 60 * 1000, weight: TickMarkWeight.Hour3 },
		{ divisor: 6 * 60 * 60 * 1000, weight: TickMarkWeight.Hour6 },
		{ divisor: 12 * 60 * 60 * 1000, weight: TickMarkWeight.Hour12 },
	];

	for (let i = divisors.length - 1; i >= 0; --i) {
		if (Math.floor(prevMs / divisors[i].divisor) !== Math.floor(currentMs / divisors[i].divisor)) {
			return divisors[i].weight;
		}
	}

	return TickMarkWeight.LessThanSecond;
}

function referenceWeights(timestamps: number[], startIndex: number = 0): number[] {
	const result: number[] = [];
	let prevTime: number | null = startIndex === 0 ? null : timestamps[startIndex - 1];
	for (let index = startIndex; index < timestamps.length; ++index) {
		if (prevTime !== null) {
			result.push(referenceWeight(timestamps[index] * 1000, prevTime * 1000));
		}
		prevTime = timestamps[index];
	}

	if (startIndex === 0 && timestamps.length > 1) {
		// the first point's weight is guessed as if the previous point was an average step back
		let totalDiff = 0;
		prevTime = null;
		for (const time of timestamps) {
			totalDiff += time - (prevTime ?? time);
			prevTime = time;
		}
		const averageDiff = Math.ceil(totalDiff / (timestamps.length - 1));
		result.unshift(referenceWeight(timestamps[0] * 1000, (timestamps[0] - averageDiff) * 1000));
	}

	return result;
}

describe('fillWeightsForPoints', () => {
	it('should produce the same weights as the reference implementation for intraday data', () => {
		const timestamps: number[] = [];
		// a day of second-by-second data
		const dayStart = Date.UTC(2019, 0, 1) / 1000;
		for (let time = dayStart; time < dayStart + 24 * 60 * 60; time += 1) {
			timestamps.push(time);
		}

		const points = makePoints(timestamps);
		fillWeightsForPoints(points);
		expect(weightsOf(points)).to.be.deep.equal(referenceWeights(timestamps));
	});

	it('should produce the same weights as the reference implementation when days change', () => {
		const timestamps: number[] = [];
		// a few months of hourly data crossing day and month boundaries
		for (let time = Date.UTC(2019, 0, 1) / 1000; time < Date.UTC(2019, 2, 15) / 1000; time += 60 * 60) {
			timestamps.push(time);
		}

		const points = makePoints(timestamps);
		fillWeightsForPoints(points);
		expect(weightsOf(points)).to.be.deep.equal(referenceWeights(timestamps));
	});

	it('should produce the same weights as the reference implementation when years change', () => {
		const timestamps: number[] = [];
		// a few years of daily data
		for (let time = Date.UTC(2017, 0, 1) / 1000; time < Date.UTC(2021, 0, 1) / 1000; time += 24 * 60 * 60) {
			timestamps.push(time);
		}

		const points = makePoints(timestamps);
		fillWeightsForPoints(points);
		expect(weightsOf(points)).to.be.deep.equal(referenceWeights(timestamps));
	});

	it('should produce the same weights as the reference implementation for a leap year', () => {
		const timestamps: number[] = [];
		// daily data over Feb 29 of a leap year
		for (let time = Date.UTC(2020, 1, 27) / 1000; time <= Date.UTC(2020, 2, 2) / 1000; time += 24 * 60 * 60) {
			timestamps.push(time);
		}

		const points = makePoints(timestamps);
		fillWeightsForPoints(points);
		expect(weightsOf(points)).to.be.deep.equal(referenceWeights(timestamps));
	});

	it('should produce the same weights as the reference implementation for irregular steps', () => {
		const timestamps: number[] = [];
		let time = Date.UTC(2019, 0, 1) / 1000;
		for (let i = 0; i < 200; ++i) {
			timestamps.push(time);
			// random-ish steps between 1 second and 2 days
			time += ((i * 7919) % 172800) + 1;
		}

		const points = makePoints(timestamps);
		fillWeightsForPoints(points);
		expect(weightsOf(points)).to.be.deep.equal(referenceWeights(timestamps));
	});

	it('should guess the same first point weight as the reference implementation', () => {
		const timestamps = [3, 5, 8, 11, 15, 18].map((seconds: number) => Date.UTC(2019, 0, 1) / 1000 + seconds);

		const points = makePoints(timestamps);
		fillWeightsForPoints(points);

		const reference = referenceWeights(timestamps);
		expect(points[0].timeWeight).to.be.equal(reference[0]);
	});

	it('should fill weights starting from the given index without touching previous points', () => {
		const timestamps: number[] = [];
		for (let time = Date.UTC(2019, 0, 1) / 1000; time < Date.UTC(2019, 0, 5) / 1000; time += 60) {
			timestamps.push(time);
		}

		const points = makePoints(timestamps);
		fillWeightsForPoints(points, 0);

		const previousWeights = weightsOf(points);
		fillWeightsForPoints(points, 10);
		// weights before the start index must not change
		expect(weightsOf(points).slice(0, 10)).to.be.deep.equal(previousWeights.slice(0, 10));
		expect(weightsOf(points)).to.be.deep.equal([
			...previousWeights.slice(0, 10),
			...referenceWeights(timestamps, 10),
		]);
	});

	it('should do nothing for an empty list of points', () => {
		expect(() => fillWeightsForPoints([])).to.not.throw();
	});
});
