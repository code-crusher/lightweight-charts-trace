/* eslint-disable @typescript-eslint/no-floating-promises */
import { expect } from 'chai';
import { describe, it } from 'node:test';

import { IChartApiBase } from '../../src/api/ichart-api';
import { ISeriesApi } from '../../src/api/iseries-api';
import { ensureNotNull } from '../../src/helpers/assertions';
import { Coordinate } from '../../src/model/coordinate';
import { Time } from '../../src/model/horz-scale-behavior-time/types';
import { IHorzScaleBehavior } from '../../src/model/ihorz-scale-behavior';
import { SeriesType } from '../../src/model/series-options';
import { Logical, TimePointIndex } from '../../src/model/time-data';
import { seriesMarkerOptionsDefaults } from '../../src/plugins/series-markers/options';
import { SeriesMarkersPaneView } from '../../src/plugins/series-markers/pane-view';
import { SeriesMarkersPrimitive } from '../../src/plugins/series-markers/primitive';
import { SeriesMarkerRendererData, SeriesMarkerRendererDataItem } from '../../src/plugins/series-markers/renderer';
import { InternalSeriesMarker, SeriesMarker } from '../../src/plugins/series-markers/types';
import { calculateMarkerSpacing, calculateShapeHeight, shapeMargin } from '../../src/plugins/series-markers/utils';

const barSpacing = 6;
const priceCoordinate = 100;

interface TestMarker {
	time: number;
	position: 'aboveBar' | 'belowBar';
	spacing?: number;
}

function createPaneView(markers: TestMarker[]): SeriesMarkersPaneView<Time> {
	const timeScale = {
		options: () => ({ barSpacing }),
		getVisibleLogicalRange: () => ({ from: 0, to: 10 }),
		logicalToCoordinate: (logical: number) => logical * 10 as Coordinate,
	};

	const series = {
		options: () => ({ visible: true }),
		dataByIndex: () => ({ open: 100, high: 100, low: 100, close: 100 }),
		priceToCoordinate: () => priceCoordinate as Coordinate,
		priceScale: () => ({ options: () => ({ invertScale: false }) }),
	};

	const chart = {
		options: () => ({ layout: { fontSize: 12, fontFamily: 'sans-serif' } }),
		timeScale: () => timeScale,
	};

	const paneView = new SeriesMarkersPaneView<Time>(
		series as unknown as ISeriesApi<SeriesType, Time>,
		chart as unknown as IChartApiBase<Time>,
		seriesMarkerOptionsDefaults
	);

	paneView.setMarkers(markers.map((marker: TestMarker, index: number): InternalSeriesMarker<TimePointIndex> => ({
		time: marker.time as unknown as TimePointIndex,
		position: marker.position,
		shape: 'circle',
		color: 'red',
		internalId: index,
		originalTime: marker.time,
		spacing: marker.spacing,
	})));

	return paneView;
}

function markerCoordinates(markers: TestMarker[]): number[] {
	const renderer = ensureNotNull(createPaneView(markers).renderer());
	// the pane view recalculates the renderer data synchronously in renderer()
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const data = (renderer as unknown as { _data: SeriesMarkerRendererData })._data;
	return data.items.map((item: SeriesMarkerRendererDataItem) => item.y as number);
}

describe('series markers spacing', () => {
	const shapeSize = calculateShapeHeight(barSpacing);
	const margin = shapeMargin(barSpacing);

	it('calculateMarkerSpacing falls back to 1 for an undefined or invalid value', () => {
		expect(calculateMarkerSpacing(undefined)).to.be.equal(1);
		expect(calculateMarkerSpacing(NaN)).to.be.equal(1);
		expect(calculateMarkerSpacing(Infinity)).to.be.equal(1);
	});

	it('calculateMarkerSpacing keeps valid values and clamps negative ones to 0', () => {
		expect(calculateMarkerSpacing(0)).to.be.equal(0);
		expect(calculateMarkerSpacing(2)).to.be.equal(2);
		expect(calculateMarkerSpacing(-1)).to.be.equal(0);
	});

	it('uses the same position as before for markers without spacing', () => {
		const [y] = markerCoordinates([{ time: 0, position: 'aboveBar' }]);
		expect(y).to.be.equal(priceCoordinate - shapeSize / 2 - margin);
	});

	it('moves an aboveBar marker further from the bar when spacing grows', () => {
		const [defaultY] = markerCoordinates([{ time: 0, position: 'aboveBar', spacing: 1 }]);
		const [spacedY] = markerCoordinates([{ time: 0, position: 'aboveBar', spacing: 2 }]);
		expect(spacedY).to.be.equal(defaultY - margin);
	});

	it('places an aboveBar marker against the wick when spacing is 0', () => {
		const [y] = markerCoordinates([{ time: 0, position: 'aboveBar', spacing: 0 }]);
		expect(y).to.be.equal(priceCoordinate - shapeSize / 2);
	});

	it('moves a belowBar marker further from the bar when spacing grows', () => {
		const [defaultY] = markerCoordinates([{ time: 0, position: 'belowBar', spacing: 1 }]);
		const [spacedY] = markerCoordinates([{ time: 0, position: 'belowBar', spacing: 2 }]);
		expect(spacedY).to.be.equal(defaultY + margin);
	});

	it('places a belowBar marker against the wick when spacing is 0', () => {
		const [y] = markerCoordinates([{ time: 0, position: 'belowBar', spacing: 0 }]);
		expect(y).to.be.equal(priceCoordinate + shapeSize / 2);
	});

	it('scales the gap between markers stacked on the same bar', () => {
		const [firstY, secondY] = markerCoordinates([
			{ time: 0, position: 'aboveBar', spacing: 2 },
			{ time: 0, position: 'aboveBar', spacing: 2 },
		]);
		// stacked markers keep a shape-sized step plus the spacing-scaled margin between them
		expect(firstY - secondY).to.be.equal(shapeSize + margin * 2);
	});

	it('does not change the gap between markers stacked with the default spacing', () => {
		const [firstY, secondY] = markerCoordinates([
			{ time: 0, position: 'aboveBar' },
			{ time: 0, position: 'aboveBar' },
		]);
		expect(firstY - secondY).to.be.equal(shapeSize + margin);
	});

	it('resets the stack offset for markers attached to another bar', () => {
		const [firstY, secondY] = markerCoordinates([
			{ time: 0, position: 'aboveBar', spacing: 2 },
			{ time: 1, position: 'aboveBar', spacing: 2 },
		]);
		expect(secondY).to.be.equal(firstY);
	});
});

describe('series markers autoscale margins with spacing', () => {
	const defaultMargin = calculateShapeHeight(barSpacing) * 1.5 + shapeMargin(barSpacing) * 2;

	function createPrimitive(markers: SeriesMarker<Time>[]): SeriesMarkersPrimitive<Time> {
		const timeScale = {
			options: () => ({ barSpacing }),
			getVisibleLogicalRange: () => ({ from: 0, to: 10 }),
			timeToIndex: (time: Time) => time as unknown as number,
		};

		const series = {
			data: () => [{ time: 0 as Time }],
			dataByIndex: () => ({ time: 0 as Time }),
			subscribeDataChanged: () => {},
		};

		const chart = {
			timeScale: () => timeScale,
		};

		const primitive = new SeriesMarkersPrimitive<Time>({});
		primitive.attached({
			chart: chart as unknown as IChartApiBase<Time>,
			series: series as unknown as ISeriesApi<SeriesType, Time>,
			requestUpdate: () => {},
			horzScaleBehavior: {} as unknown as IHorzScaleBehavior<Time>,
		});
		primitive.setMarkers(markers);
		return primitive;
	}

	function margins(markers: SeriesMarker<Time>[]): { above: number; below: number } {
		const info = ensureNotNull(createPrimitive(markers).autoscaleInfo(0 as Logical, 10 as Logical));
		return ensureNotNull(info.margins ?? null);
	}

	it('does not change the margins for markers with the default spacing', () => {
		const { above, below } = margins([
			{ time: 0 as Time, position: 'aboveBar', shape: 'circle', color: 'red' },
			{ time: 0 as Time, position: 'belowBar', shape: 'circle', color: 'red' },
		]);

		expect(above).to.be.equal(defaultMargin);
		expect(below).to.be.equal(defaultMargin);
	});

	it('expands the margin on the side where markers use a larger spacing', () => {
		const { above, below } = margins([
			{ time: 0 as Time, position: 'aboveBar', shape: 'circle', color: 'red', spacing: 3 },
			{ time: 0 as Time, position: 'belowBar', shape: 'circle', color: 'red' },
		]);

		expect(above).to.be.equal(defaultMargin + 2 * shapeMargin(barSpacing));
		expect(below).to.be.equal(defaultMargin);
	});
});
