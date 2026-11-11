/**
 * A view drawn on one of the chart axes which can be ordered relative to the
 * other views drawn on the same axis.
 */
export interface ZIndexedAxisView {
	/**
	 * Defines the order in which the view is drawn. Views with a higher z-index
	 * are drawn on top of views with a lower one.
	 */
	zIndex(): number;
}

/**
 * Returns a copy of `views` sorted by their z-index, from the lowest to the
 * highest. The sort is stable, so views with the same z-index keep their
 * relative order (which is the order in which their sources were attached).
 */
export function sortAxisViewsByZIndex<T extends ZIndexedAxisView>(views: readonly T[]): T[] {
	return views.slice().sort((left: T, right: T) => left.zIndex() - right.zIndex());
}
