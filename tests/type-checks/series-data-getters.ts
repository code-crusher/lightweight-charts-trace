import { AreaSeries, BarSeries, createChart } from '../../src';
import { AreaData, BarData } from '../../src/model/data-consumer';
import { Time } from '../../src/model/horz-scale-behavior-time/types';

const chart = createChart('container', { autoSize: true });

const areaSeries = chart.addSeries(AreaSeries);
areaSeries.setData([
	{ time: '2018-12-12', value: 24.11 },
	{ time: '2018-12-13' }, // whitespace
	{ time: '2018-12-14', value: 31.74 },
]);

// dataByIndex returns fulfilled data only, so `value` is accessible
// without narrowing (issue #1699)
const lastIndex = areaSeries.data().length - 1;
const latestData = areaSeries.dataByIndex(lastIndex);
if (latestData !== null) {
	const latestValue: number = latestData.value;
	void latestValue;
}

// data() items expose `value` directly as well
for (const item of areaSeries.data()) {
	const value: number = item.value;
	void value;
}

// pop() returns fulfilled data only
const popped = areaSeries.pop(1);
const poppedValue: number = popped[0].value;
void poppedValue;

areaSeries.data() satisfies readonly AreaData<Time>[];

// ohlc-based series expose price fields directly
const barSeries = chart.addSeries(BarSeries);
barSeries.setData([
	{ time: '2018-12-12', open: 24.11, high: 25.11, low: 23.11, close: 24.51 },
]);
const barDataItem = barSeries.dataByIndex(0);
if (barDataItem !== null) {
	const openPrice: number = barDataItem.open;
	void openPrice;
	// @ts-expect-error bar series data has no `value` field
	void barDataItem.value;
}
barSeries.data() satisfies readonly BarData<Time>[];
