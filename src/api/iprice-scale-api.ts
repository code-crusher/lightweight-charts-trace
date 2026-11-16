import { DeepPartial } from '../helpers/strict-type-checks';

import { PriceScaleOptions } from '../model/price-scale';
import { IRange } from '../model/time-data';

/**
 * A handler for price scale auto scale mode changes.
 */
export type AutoScaleChangeHandler = (autoScale: boolean) => void;

/** Interface to control chart's price scale */
export interface IPriceScaleApi {
	/**
	 * Applies new options to the price scale
	 *
	 * @param options - Any subset of options.
	 */
	applyOptions(options: DeepPartial<PriceScaleOptions>): void;

	/**
	 * Returns currently applied options of the price scale
	 *
	 * For an overlay price scale that has no series yet, returns the `overlayPriceScales` defaults.
	 *
	 * @returns Full set of currently applied options, including defaults
	 */
	options(): Readonly<PriceScaleOptions>;

	/**
	 * Returns a width of the price scale if it's visible or 0 if invisible.
	 */
	width(): number;

	/**
	 * Sets the visible range of the price scale.
	 *
	 * @param range - The visible range to set, with `from` and `to` properties.
	 */
	setVisibleRange(range: IRange<number>): void;

	/**
	 * Returns the visible range of the price scale.
	 *
	 * @returns The visible range of the price scale, or null if the range is not set.
	 */
	getVisibleRange(): IRange<number> | null;

	/**
	 * Sets the auto scale mode of the price scale.
	 *
	 * @param on - If true, enables auto scaling; if false, disables it.
	 */
	setAutoScale(on: boolean): void;

	/**
	 * Subscribes to auto scale mode changes of the price scale.
	 *
	 * The handler is called whenever the auto scale mode changes, regardless of whether it was
	 * changed programmatically (via {@link setAutoScale}, {@link applyOptions}, or the
	 * `autoScale` chart option) or by a user interaction such as dragging or double-clicking the
	 * price axis. This allows keeping an external source of truth in sync with the price scale.
	 *
	 * @param handler - Handler to be called with the new auto scale mode value.
	 */
	subscribeAutoScaleChange(handler: AutoScaleChangeHandler): void;

	/**
	 * Removes a subscription to auto scale mode changes of the price scale.
	 *
	 * @param handler - Previously subscribed handler.
	 */
	unsubscribeAutoScaleChange(handler: AutoScaleChangeHandler): void;
}
