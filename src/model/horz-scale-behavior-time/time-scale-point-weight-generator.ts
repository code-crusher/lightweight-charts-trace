import { Mutable } from '../../helpers/mutable';

import { InternalHorzScaleItem } from '../ihorz-scale-behavior';
import { TickMarkWeightValue, TimeScalePoint } from '../time-data';
import { TickMarkWeight, TimePoint } from './types';

function hours(count: number): number {
	return count * 60 * 60 * 1000;
}

function minutes(count: number): number {
	return count * 60 * 1000;
}

function seconds(count: number): number {
	return count * 1000;
}

interface WeightDivisor {
	divisor: number;
	weight: TickMarkWeight;
}

const intradayWeightDivisors: WeightDivisor[] = [
	{ divisor: seconds(1), weight: TickMarkWeight.Second },
	{ divisor: minutes(1), weight: TickMarkWeight.Minute1 },
	{ divisor: minutes(5), weight: TickMarkWeight.Minute5 },
	{ divisor: minutes(30), weight: TickMarkWeight.Minute30 },
	{ divisor: hours(1), weight: TickMarkWeight.Hour1 },
	{ divisor: hours(3), weight: TickMarkWeight.Hour3 },
	{ divisor: hours(6), weight: TickMarkWeight.Hour6 },
	{ divisor: hours(12), weight: TickMarkWeight.Hour12 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function weightByTime(currentDate: Date, prevDate: Date): TickMarkWeight {
	if (currentDate.getUTCFullYear() !== prevDate.getUTCFullYear()) {
		return TickMarkWeight.Year;
	} else if (currentDate.getUTCMonth() !== prevDate.getUTCMonth()) {
		return TickMarkWeight.Month;
	} else if (currentDate.getUTCDate() !== prevDate.getUTCDate()) {
		return TickMarkWeight.Day;
	}

	for (let i = intradayWeightDivisors.length - 1; i >= 0; --i) {
		if (Math.floor(prevDate.getTime() / intradayWeightDivisors[i].divisor) !== Math.floor(currentDate.getTime() / intradayWeightDivisors[i].divisor)) {
			return intradayWeightDivisors[i].weight;
		}
	}

	return TickMarkWeight.LessThanSecond;
}

/**
 * Returns the weight for a point followed by another point, avoiding Date allocations
 * while the points stay within the same UTC day (the common case for large data sets).
 */
function weightByTimestamps(currentMs: number, prevMs: number): TickMarkWeight {
	if (Math.floor(currentMs / DAY_MS) === Math.floor(prevMs / DAY_MS)) {
		// the same UTC day means the same year, month and day - only intraday divisors matter
		return intradayWeightByMs(currentMs, prevMs);
	}

	// a different UTC day - dates are required to compare year/month/day
	return weightByTime(new Date(currentMs), new Date(prevMs));
}

function intradayWeightByMs(currentMs: number, prevMs: number): TickMarkWeight {
	for (let i = intradayWeightDivisors.length - 1; i >= 0; --i) {
		if (Math.floor(prevMs / intradayWeightDivisors[i].divisor) !== Math.floor(currentMs / intradayWeightDivisors[i].divisor)) {
			return intradayWeightDivisors[i].weight;
		}
	}

	return TickMarkWeight.LessThanSecond;
}

function cast(t: InternalHorzScaleItem): TimePoint {
	return t as unknown as TimePoint;
}

export function fillWeightsForPoints(sortedTimePoints: readonly Mutable<TimeScalePoint>[], startIndex: number = 0): void {
	if (sortedTimePoints.length === 0) {
		return;
	}

	let prevTime = startIndex === 0 ? null : cast(sortedTimePoints[startIndex - 1].time).timestamp;
	let prevMs = prevTime !== null ? prevTime * 1000 : null;

	let totalTimeDiff = 0;

	for (let index = startIndex; index < sortedTimePoints.length; ++index) {
		const currentPoint = sortedTimePoints[index];
		const currentTime = cast(currentPoint.time).timestamp;
		const currentMs = currentTime * 1000;

		if (prevMs !== null) {
			currentPoint.timeWeight = weightByTimestamps(currentMs, prevMs) as TickMarkWeightValue;
		}

		totalTimeDiff += currentTime - (prevTime ?? currentTime);

		prevTime = currentTime;
		prevMs = currentMs;
	}

	if (startIndex === 0 && sortedTimePoints.length > 1) {
		// let's guess a weight for the first point
		// let's say the previous point was average time back in the history
		const averageTimeDiff = Math.ceil(totalTimeDiff / (sortedTimePoints.length - 1));
		const firstTime = cast(sortedTimePoints[0].time).timestamp;
		sortedTimePoints[0].timeWeight = weightByTimestamps(firstTime * 1000, (firstTime - averageTimeDiff) * 1000) as TickMarkWeightValue;
	}
}
