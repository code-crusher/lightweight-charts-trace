import { createChart, LineSeries } from '../../src';
import { ISeriesPrimitive } from '../../src/api/iseries-primitive-api';
import { ISeriesPrimitiveAxisView } from '../../src/model/iseries-primitive';

class LabeledPrimitive implements ISeriesPrimitive {
	private readonly _axisViews: readonly ISeriesPrimitiveAxisView[] = [{
		coordinate: () => 10,
		text: () => 'label',
		textColor: () => '#000000',
		backColor: () => '#ffffff',
		zIndex: () => 1,
	}];

	public priceAxisViews(): readonly ISeriesPrimitiveAxisView[] {
		return this._axisViews;
	}
}

class PrimitiveWithoutZIndex implements ISeriesPrimitive {
	private readonly _axisViews: readonly ISeriesPrimitiveAxisView[] = [{
		coordinate: () => 10,
		text: () => 'label',
		textColor: () => '#000000',
		backColor: () => '#ffffff',
	}];

	public timeAxisViews(): readonly ISeriesPrimitiveAxisView[] {
		return this._axisViews;
	}
}

const chart = createChart('anything');
const series = chart.addSeries(LineSeries);

series.attachPrimitive(new LabeledPrimitive());
series.attachPrimitive(new PrimitiveWithoutZIndex());
