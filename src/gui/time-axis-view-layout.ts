/** The part of a time axis label the layout moves around. */
export interface TimeAxisViewLayoutTarget {
	/** The coordinate the view asks to be drawn at. Used to order the labels. */
	coordinate(): number;
	/** The coordinate the label is currently assigned to be drawn at. */
	getRenderCoordinate(): number;
	/** Assigns the coordinate to draw the label at. */
	setRenderCoordinate(value: number | null): void;
	/** Whether the label has a fixed coordinate, which the layout must not change. */
	isFixed(): boolean;
}

/** A time axis label taking part in the layout and the width it takes on the axis. */
export interface TimeAxisViewLayoutItem {
	view: TimeAxisViewLayoutTarget;
	/** The full width of the label, in media pixels. */
	width: number;
}

/**
 * The left edge the renderer uses for a label drawn at `coordinate` when the layout has not
 * assigned a coordinate: the coordinate is the center of the label, and a label outside of the axis
 * is moved back inside.
 */
function freeLabelLeft(coordinate: number, width: number, axisWidth: number): number {
	const halfWidth = width / 2;
	let labelCoordinate = coordinate;
	let left = Math.floor(labelCoordinate - halfWidth) + 0.5;

	if (left < 0) {
		labelCoordinate += Math.abs(0 - left);
		left = Math.floor(labelCoordinate - halfWidth) + 0.5;
	} else if (left + width > axisWidth) {
		labelCoordinate -= Math.abs(axisWidth - (left + width));
		left = Math.floor(labelCoordinate - halfWidth) + 0.5;
	}

	return left;
}

/**
 * Moves the labels of the given views so that they do not overlap, keeping them inside the axis.
 *
 * A label is drawn at the coordinate its view requests. When it would overlap the label before it,
 * it is moved to the right of that label. When a run of labels is pushed past the right edge of the
 * axis, the whole run is moved back to the left, as far as the free space before it allows.
 *
 * Labels with a fixed coordinate are left where they are: the axis draws them on top of the others,
 * and they do not take part in the layout. A label which is not drawn (its width is `0`) does not
 * affect the position of the other labels either.
 *
 * The render coordinates of the views are updated in place.
 *
 * @param items - the labels to lay out.
 * @param axisWidth - the width of the axis in media pixels.
 */
export function alignTimeAxisViews(items: readonly TimeAxisViewLayoutItem[], axisWidth: number): void {
	const sorted = items
		.filter((item: TimeAxisViewLayoutItem) => item.width > 0 && !item.view.isFixed())
		.slice()
		.sort((l: TimeAxisViewLayoutItem, r: TimeAxisViewLayoutItem) => l.view.coordinate() - r.view.coordinate());

	if (sorted.length === 0) {
		return;
	}

	// start every label where it would be drawn on its own, so that a label which does not overlap
	// anything stays exactly where it was before
	const lefts: number[] = sorted.map((item: TimeAxisViewLayoutItem) => freeLabelLeft(item.view.coordinate(), item.width, axisWidth));

	let currentGroupStart = 0;
	let spaceBeforeCurrentGroup = Math.max(0, lefts[0]);

	for (let i = 1; i < sorted.length; i++) {
		const item = sorted[i];
		const prevItem = sorted[i - 1];
		const prevRight = lefts[i - 1] + prevItem.width;

		if (lefts[i] < prevRight) {
			lefts[i] = prevRight;
			const right = lefts[i] + item.width;
			if (right > axisWidth && spaceBeforeCurrentGroup > 0) {
				// move the whole run of labels back to the left
				const possibleShift = Math.min(right - axisWidth, spaceBeforeCurrentGroup);
				for (let k = currentGroupStart; k <= i; k++) {
					lefts[k] -= possibleShift;
				}
				spaceBeforeCurrentGroup -= possibleShift;
			}
		} else {
			currentGroupStart = i;
			spaceBeforeCurrentGroup = lefts[i] - prevRight;
		}
	}

	for (let i = 0; i < sorted.length; i++) {
		sorted[i].view.setRenderCoordinate(lefts[i] + sorted[i].width / 2);
	}
}
