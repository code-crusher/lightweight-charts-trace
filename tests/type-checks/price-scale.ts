import { createChart, LineSeries } from '../../src';

const chart = createChart('container');

const priceScale = chart.priceScale('right');

// the handler receives the new auto scale value
priceScale.subscribeAutoScaleChange((autoScale: boolean) => {
	const value: boolean = autoScale;
	void value;
});

const handler = (autoScale: boolean) => {
	void autoScale;
};
priceScale.subscribeAutoScaleChange(handler);
priceScale.unsubscribeAutoScaleChange(handler);

// the same API is available on the price scale of a series
chart.addSeries(LineSeries).priceScale().subscribeAutoScaleChange(handler);

// @ts-expect-error the handler must accept a boolean
priceScale.subscribeAutoScaleChange((autoScale: string) => {
	void autoScale;
});

// @ts-expect-error a handler is required
priceScale.subscribeAutoScaleChange();
