/* eslint-disable @typescript-eslint/no-floating-promises */
import { expect } from 'chai';
import { describe, it } from 'node:test';

import { alignTimeAxisViews, TimeAxisViewLayoutItem } from '../../src/gui/time-axis-view-layout';

class TestAxisView {
	public renderCoordinate: number | null = null;
	private readonly _coordinate: number;
	private readonly _fixed: boolean;

	public constructor(coordinate: number, fixed: boolean = false) {
		this._coordinate = coordinate;
		this._fixed = fixed;
	}

	public coordinate(): number {
		return this._coordinate;
	}

	public getRenderCoordinate(): number {
		return this.renderCoordinate ?? this._coordinate;
	}

	public setRenderCoordinate(value: number | null): void {
		this.renderCoordinate = value;
	}

	public isFixed(): boolean {
		return this._fixed;
	}
}

interface PlacedLabel {
	view: TestAxisView;
	width: number;
}

interface LabelSpec {
	coordinate: number;
	width: number;
	fixed?: boolean;
}

function placeLabels(specs: readonly LabelSpec[], axisWidth: number): PlacedLabel[] {
	const labels = specs.map((spec: LabelSpec) => ({
		view: new TestAxisView(spec.coordinate, spec.fixed ?? false),
		width: spec.width,
	}));

	const items: TimeAxisViewLayoutItem[] = labels.map((label: PlacedLabel) => ({
		view: label.view,
		width: label.width,
	}));

	alignTimeAxisViews(items, axisWidth);

	return labels;
}

function left(label: PlacedLabel): number {
	return label.view.getRenderCoordinate() - label.width / 2;
}

function right(label: PlacedLabel): number {
	return label.view.getRenderCoordinate() + label.width / 2;
}

function expectNoOverlap(labels: readonly PlacedLabel[]): void {
	const sorted = labels.slice().sort((l: PlacedLabel, r: PlacedLabel) => left(l) - left(r));
	for (let i = 1; i < sorted.length; i++) {
		expect(left(sorted[i]), `label ${i} overlaps the previous one`).to.be.at.least(right(sorted[i - 1]));
	}
}

/** The coordinate the renderer centers a label at when no layout coordinate is assigned. */
function freeCoordinate(coordinate: number, width: number): number {
	return Math.floor(coordinate - width / 2) + 0.5 + width / 2;
}

describe('alignTimeAxisViews', () => {
	it('does not move a single label which fits', () => {
		const [label] = placeLabels([{ coordinate: 100, width: 40 }], 600);
		expect(label.view.getRenderCoordinate()).to.be.equal(freeCoordinate(100, 40));
	});

	it('separates two labels which would overlap', () => {
		const labels = placeLabels([{ coordinate: 100, width: 40 }, { coordinate: 110, width: 40 }], 600);

		expectNoOverlap(labels);
		// the first label stays where it was asked to be
		expect(labels[0].view.getRenderCoordinate()).to.be.equal(freeCoordinate(100, 40));
		expect(left(labels[1])).to.be.equal(right(labels[0]));
	});

	it('separates labels supplied in any order', () => {
		const labels = placeLabels([{ coordinate: 110, width: 40 }, { coordinate: 100, width: 40 }], 600);

		expectNoOverlap(labels);
		// the leftmost label stays where it was asked to be
		expect(labels[1].view.getRenderCoordinate()).to.be.equal(freeCoordinate(100, 40));
	});

	it('separates a run of many labels which share a coordinate', () => {
		const labels = placeLabels(
			[0, 1, 2, 3, 4, 5].map(() => ({ coordinate: 300, width: 50 })),
			600
		);

		expectNoOverlap(labels);
	});

	it('keeps a label inside the right edge of the axis', () => {
		const [label] = placeLabels([{ coordinate: 600, width: 40 }], 600);
		expect(right(label)).to.be.at.most(600);
	});

	it('moves a run back to the left when it is pushed past the right edge', () => {
		const labels = placeLabels(
			[
				{ coordinate: 100, width: 40 },
				{ coordinate: 590, width: 40 },
				{ coordinate: 592, width: 40 },
			],
			600
		);

		expectNoOverlap(labels);
		// the run is moved back by exactly the overflow, and no further
		expect(right(labels[2])).to.be.equal(600);
		expect(left(labels[1])).to.be.at.least(right(labels[0]));
		// the label which did not overlap anything is not moved
		expect(labels[0].view.getRenderCoordinate()).to.be.equal(freeCoordinate(100, 40));
	});

	it('does not move fixed labels and does not lay other labels out around them', () => {
		const labels = placeLabels(
			[
				{ coordinate: 100, width: 40, fixed: true },
				{ coordinate: 105, width: 40 },
			],
			600
		);

		expect(labels[0].view.renderCoordinate).to.be.equal(null);
		expect(labels[0].view.getRenderCoordinate()).to.be.equal(100);
		// the unfixed label is drawn where it asks, even though it covers the fixed one
		expect(labels[1].view.getRenderCoordinate()).to.be.equal(freeCoordinate(105, 40));
	});

	it('ignores labels which are not drawn', () => {
		const labels = placeLabels(
			[
				{ coordinate: 100, width: 40 },
				{ coordinate: 105, width: 0 },
				{ coordinate: 110, width: 40 },
			],
			600
		);

		expect(left(labels[2])).to.be.equal(right(labels[0]));
		expect(labels[1].view.renderCoordinate).to.be.equal(null);
	});

	it('does nothing when there are no labels', () => {
		expect(() => alignTimeAxisViews([], 600)).to.not.throw();
	});

	it('does nothing when all labels are hidden', () => {
		const labels = placeLabels([{ coordinate: 100, width: 0 }, { coordinate: 100, width: 0 }], 600);
		expect(labels[0].view.renderCoordinate).to.be.equal(null);
		expect(labels[1].view.renderCoordinate).to.be.equal(null);
	});
});
