import { Delegate, ISubscription } from '@tradingview/lwc-toolkit/delegate';

/**
 * The kind of a price level, which decides its colour and how it is labelled.
 */
export type TradeLevelKind = 'entry' | 'stopLoss' | 'takeProfit';

/**
 * The one position managed by {@link TradeManagement}. A long position is
 * entered at `entry` and profits as the price rises; a short position is the
 * other way around. `quantity` is the number of units held, used for the
 * profit and loss figures.
 */
export interface TradePosition {
	/** Average entry price of the position. */
	entry: number;
	/** Exit price which limits the position's loss, or `null` for none. */
	stopLoss: number | null;
	/** Exit price which takes the position's profit, or `null` for none. */
	takeProfit: number | null;
	/** Number of units held. */
	quantity: number;
	/** Whether the position gains when the price rises. */
	long: boolean;
}

/** A price level that can change, and the event fired when it does. */
class TradeLevel {
	private readonly _kind: TradeLevelKind;
	private readonly _changed: Delegate<number | void>;
	private _price: number;

	public constructor(kind: TradeLevelKind, price: number, changed: Delegate<number | void>) {
		this._kind = kind;
		this._price = price;
		this._changed = changed;
	}

	public kind(): TradeLevelKind {
		return this._kind;
	}

	public price(): number {
		return this._price;
	}

	/** Moves the level, firing only when the price actually changes. */
	public setPrice(price: number): void {
		if (price === this._price || !Number.isFinite(price)) {
			return;
		}
		this._price = price;
		this._changed.fire(price);
	}
}

/**
 * One position plus the events and the derived quantities the chart needs:
 * the level drag subscriptions, the profit and loss against a given price, and
 * the risk / reward ratio of the current stop loss and take profit.
 *
 * The state is kept apart from the drawing code so that it can be driven and
 * asserted without a chart, which is what the unit tests do.
 */
export class TradeManagementModel {
	private readonly _changed: Delegate<number | void> = new Delegate<number | void>();
	private readonly _entry: TradeLevel;
	private _stopLoss: TradeLevel | null = null;
	private _takeProfit: TradeLevel | null = null;
	private _quantity: number;
	private _long: boolean;

	public constructor(position: TradePosition) {
		this._entry = new TradeLevel('entry', position.entry, this._changed);
		this._quantity = position.quantity;
		this._long = position.long;
		if (position.stopLoss !== null) {
			this._stopLoss = this._createLevel('stopLoss', position.stopLoss);
		}
		if (position.takeProfit !== null) {
			this._takeProfit = this._createLevel('takeProfit', position.takeProfit);
		}
	}

	/** Fired whenever any level, the quantity or the side changes. */
	public changed(): ISubscription<number | void> {
		return this._changed;
	}

	/** The average entry price of the position. */
	public entry(): number {
		return this._entry.price();
	}

	/** The stop loss price, or `null` while there is none. */
	public stopLoss(): number | null {
		return this._stopLoss === null ? null : this._stopLoss.price();
	}

	/** The take profit price, or `null` while there is none. */
	public takeProfit(): number | null {
		return this._takeProfit === null ? null : this._takeProfit.price();
	}

	/** The number of units held. */
	public quantity(): number {
		return this._quantity;
	}

	/** Whether the position gains when the price rises. */
	public isLong(): boolean {
		return this._long;
	}

	/** Moves the entry price, keeping the stop loss and take profit on their own sides of it. */
	public setEntry(price: number): void {
		this._entry.setPrice(price);
		this._keepLevelsOnTheirSides();
	}

	/** Moves the stop loss, or creates it when the position has none. */
	public setStopLoss(price: number): void {
		this.level('stopLoss').setPrice(price);
	}

	/** Moves the take profit, or creates it when the position has none. */
	public setTakeProfit(price: number): void {
		this.level('takeProfit').setPrice(price);
	}

	/** Sets the number of units held. */
	public setQuantity(quantity: number): void {
		if (quantity === this._quantity || !Number.isFinite(quantity)) {
			return;
		}
		this._quantity = quantity;
		this._changed.fire();
	}

	/** Replaces the whole position, firing once for the whole change. */
	public setPosition(position: TradePosition): void {
		this._entry.setPrice(position.entry);
		this._quantity = position.quantity;
		this._long = position.long;
		if (position.stopLoss === null) {
			this._stopLoss = null;
		} else {
			this.level('stopLoss').setPrice(position.stopLoss);
		}
		if (position.takeProfit === null) {
			this._takeProfit = null;
		} else {
			this.level('takeProfit').setPrice(position.takeProfit);
		}
		this._changed.fire();
	}

	/**
	 * The levels that exist, in draw order: the entry line first, then the
	 * stop loss and the take profit. The array is new each call, which is what
	 * the hit test expects.
	 */
	public levels(): TradeLevel[] {
		return [
			this._entry,
			...(this._stopLoss === null ? [] : [this._stopLoss]),
			...(this._takeProfit === null ? [] : [this._takeProfit]),
		];
	}

	/** The price at which the position is exited by the given level, or `null`. */
	public levelPrice(kind: TradeLevelKind): number | null {
		switch (kind) {
			case 'entry':
				return this._entry.price();
			case 'stopLoss':
				return this.stopLoss();
			case 'takeProfit':
				return this.takeProfit();
		}
	}

	/** Moves one level by kind, creating a missing stop loss or take profit. */
	public setLevelPrice(kind: TradeLevelKind, price: number): void {
		switch (kind) {
			case 'entry':
				this.setEntry(price);
				break;
			case 'stopLoss':
				this.setStopLoss(price);
				break;
			case 'takeProfit':
				this.setTakeProfit(price);
				break;
		}
	}

	/**
	 * The profit or loss of closing the whole position at `price`, in price
	 * units per unit held. Negative for a loss.
	 */
	public profitAtPrice(price: number): number {
		const direction = this._long ? 1 : -1;
		return (price - this._entry.price()) * direction * this._quantity;
	}

	/** The profit or loss at the stop loss, or `null` while there is none. */
	public risk(): number | null {
		const stopLoss = this.stopLoss();
		return stopLoss === null ? null : this.profitAtPrice(stopLoss);
	}

	/** The profit or loss at the take profit, or `null` while there is none. */
	public reward(): number | null {
		const takeProfit = this.takeProfit();
		return takeProfit === null ? null : this.profitAtPrice(takeProfit);
	}

	/**
	 * The reward divided by the risk. `null` while either level is missing or
	 * the risk is zero; a negative ratio means the levels are on the wrong
	 * sides of the entry.
	 */
	public riskRewardRatio(): number | null {
		const risk = this.risk();
		const reward = this.reward();
		if (risk === null || reward === null || risk === 0) {
			return null;
		}
		return reward / risk;
	}

	/** The largest loss the position can take, which is always a positive number of price units. */
	public maximumRisk(): number | null {
		const stopLoss = this.stopLoss();
		if (stopLoss === null) {
			return null;
		}
		return Math.abs(this._entry.price() - stopLoss) * this._quantity;
	}

	private _createLevel(kind: TradeLevelKind, price: number): TradeLevel {
		return new TradeLevel(kind, price, this._changed);
	}

	private level(kind: TradeLevelKind): TradeLevel {
		if (kind === 'stopLoss' && this._stopLoss !== null) {
			return this._stopLoss;
		}
		if (kind === 'takeProfit' && this._takeProfit !== null) {
			return this._takeProfit;
		}
		const level = this._createLevel(kind, this._fallbackLevelPrice(kind));
		if (kind === 'stopLoss') {
			this._stopLoss = level;
		} else {
			this._takeProfit = level;
		}
		return level;
	}

	// A new stop loss or take profit starts one price unit on its own side of
	// the entry, rather than on the wrong side or exactly at the entry.
	private _fallbackLevelPrice(kind: TradeLevelKind): number {
		const entry = this._entry.price();
		const offset = Math.max(1, Math.abs(entry) * 0.01);
		if (kind === 'stopLoss') {
			return this._long ? entry - offset : entry + offset;
		}
		return this._long ? entry + offset : entry - offset;
	}

	// Keeps the stop loss below a long entry (above a short one) and the take
	// profit on the other side, which is what dragging the entry around expects.
	private _keepLevelsOnTheirSides(): void {
		const entry = this._entry.price();
		const bound = (kind: TradeLevelKind, level: TradeLevel | null): void => {
			if (level === null) {
				return;
			}
			const below = level.price() < entry;
			const wantBelow = kind === 'stopLoss' ? this._long : !this._long;
			if (below !== wantBelow && level.price() !== entry) {
				level.setPrice(entry + (wantBelow ? -1 : 1) * Math.max(1, Math.abs(entry) * 0.01));
			}
		};
		bound('stopLoss', this._stopLoss);
		bound('takeProfit', this._takeProfit);
	}
}
