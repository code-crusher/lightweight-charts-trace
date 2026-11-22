import {
	AutoscaleInfo,
	Coordinate,
	IChartApi,
	IPrimitivePaneRenderer,
	IPrimitivePaneView,
	ISeriesApi,
	ISeriesPrimitive,
	Logical,
	MismatchDirection,
	PrimitiveHoveredItem,
	PrimitivePaneViewZOrder,
	SeriesAttachedParameter,
	SeriesType,
	Time,
} from 'lightweight-charts';
import { AxisLabelView } from '@tradingview/lwc-toolkit/axis-label-view';
import { Delegate, ISubscription } from '@tradingview/lwc-toolkit/delegate';
import { TradeLevelKind, TradeManagementModel, TradePosition } from './model';
import {
	TradeEntryRendererData,
	TradeLevelRendererData,
	TradeManagementOptions,
	TradeRendererData,
	TradeZoneRendererData,
	tradeManagementDefaults,
} from './options';
import { TradeManagementPaneRenderer } from './renderer';

/** Fired when a level's price changes, while dragging and on a direct call. */
export interface TradeLevelChangedEventArgs {
	/** Which level changed. */
	kind: TradeLevelKind;
	/** The level's new price. */
	price: number;
	/** True while the change comes from a drag which is still in progress. */
	dragging: boolean;
}

/** One price axis label of a trade level, reading the model on every call. */
class TradeAxisLabelView extends AxisLabelView {
	public constructor(
		source: TradeManagement,
		kind: TradeLevelKind,
		text: () => string
	) {
		super({
			coordinate: () => {
				const series = source.seriesOrNull();
				const price = source.model().levelPrice(kind);
				if (series === null || price === null) {
					return null;
				}
				return series.priceToCoordinate(price);
			},
			text,
			textColor: () => source.options().textColor,
			backColor: () => source.levelColor(kind),
			visible: () => source.options().showPriceAxisLabels,
		});
	}
}

/** The pane view of the whole position: the zones, the lines and the badge. */
class TradePaneView implements IPrimitivePaneView {
	private readonly _source: TradeManagement;
	private readonly _renderer: TradeManagementPaneRenderer;

	public constructor(source: TradeManagement) {
		this._source = source;
		this._renderer = new TradeManagementPaneRenderer(
			source.options().currencySymbol
		);
	}

	public zOrder(): PrimitivePaneViewZOrder {
		return 'top';
	}

	public renderer(): IPrimitivePaneRenderer {
		return this._renderer;
	}

	public update(): void {
		this._renderer.update(this._source.rendererData());
	}
}

/**
 * A series primitive which draws a trading position the way TradingView does:
 * a solid entry line with the position's P&L badge, dashed stop loss and take
 * profit lines with filled profit and loss zones between them and the entry,
 * and an axis label on each level.
 *
 * Every level can be dragged on the chart; while a drag is in progress the
 * chart's own scrolling and scaling is suspended. The current P&L is measured
 * against the series' last bar and follows it as new data arrives.
 *
 * @example
 * ```js
 * const trade = new TradeManagement({
 *     entry: 100,
 *     stopLoss: 95,
 *     takeProfit: 110,
 *     quantity: 2,
 *     long: true,
 * });
 * series.attachPrimitive(trade);
 * ```
 */
export class TradeManagement implements ISeriesPrimitive<Time> {
	private _chart: IChartApi | null = null;
	private _series: ISeriesApi<SeriesType> | null = null;
	private _requestUpdate: (() => void) | null = null;

	private readonly _model: TradeManagementModel;
	private _options: TradeManagementOptions;

	private readonly _paneViews: TradePaneView[] = [];
	private readonly _priceAxisViews: TradeAxisLabelView[] = [];

	private readonly _levelChanged: Delegate<TradeLevelChangedEventArgs> = new Delegate();
	private readonly _dragStarted: Delegate<TradeLevelChangedEventArgs> = new Delegate();
	private readonly _dragEnded: Delegate<TradeLevelChangedEventArgs> = new Delegate();

	private _pointerY: number | null = null;
	private _dragKind: TradeLevelKind | null = null;
	private _restoreInteractions: (() => void) | null = null;
	private _unsubscribers: (() => void)[] = [];

	public constructor(
		position: TradePosition,
		options: Partial<TradeManagementOptions> = {}
	) {
		this._model = new TradeManagementModel(position);
		this._options = { ...tradeManagementDefaults, ...options };
		this._model.changed().subscribe(() => this._onModelChanged(), this);
	}

	// --- ISeriesPrimitive --------------------------------------------------------

	public attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>): void {
		this._chart = chart;
		this._series = series;
		this._requestUpdate = requestUpdate;
		series.subscribeDataChanged(this._onDataChanged);
		this._paneViews.length = 0;
		this._paneViews.push(new TradePaneView(this));
		this._priceAxisViews.length = 0;
		for (const kind of ['entry', 'stopLoss', 'takeProfit'] as TradeLevelKind[]) {
			this._priceAxisViews.push(
				new TradeAxisLabelView(this, kind, () => this._axisLabelText(kind))
			);
		}
		this._subscribePointerEvents();
		requestUpdate();
	}

	public detached(): void {
		this._endDrag();
		this._unsubscribePointerEvents();
		this._series?.unsubscribeDataChanged(this._onDataChanged);
		this._paneViews.length = 0;
		this._priceAxisViews.length = 0;
		this._chart = null;
		this._series = null;
		this._requestUpdate = null;
	}

	public updateAllViews(): void {
		this._paneViews.forEach(view => view.update());
	}

	public paneViews(): readonly IPrimitivePaneView[] {
		return this._paneViews;
	}

	public priceAxisViews(): readonly TradeAxisLabelView[] {
		return this._options.showPriceAxisLabels ? this._priceAxisViews : [];
	}

	public autoscaleInfo(): AutoscaleInfo | null {
		const prices = [
			this._model.entry(),
			this._model.stopLoss(),
			this._model.takeProfit(),
		].filter((price: number | null): price is number => price !== null);
		if (prices.length === 0) {
			return null;
		}
		return {
			priceRange: {
				minValue: Math.min(...prices),
				maxValue: Math.max(...prices),
			},
		};
	}

	/**
	 * Reports a hit on one of the position's lines, so that the library shows
	 * the drag cursor over them and the pane can suspend the chart's own
	 * scrolling while one is dragged.
	 */
	public hitTest(x: number, y: number): PrimitiveHoveredItem | null {
		void x;
		if (!this._options.draggable) {
			return null;
		}
		const kind = this._levelAt(y);
		if (kind === null) {
			return null;
		}
		return {
			externalId: `trade-${kind}`,
			zOrder: 'top',
			cursorStyle: 'ns-resize',
			distance: this._levelDistance(y, kind),
		};
	}

	// --- public API --------------------------------------------------------------

	/** The position's model, which holds the levels and the derived figures. */
	public model(): TradeManagementModel {
		return this._model;
	}

	/** The primitive's current options. */
	public options(): Readonly<TradeManagementOptions> {
		return this._options;
	}

	/** Merges `options` into the primitive's options and redraws it. */
	public applyOptions(options: Partial<TradeManagementOptions>): void {
		const wasDraggable = this._options.draggable;
		this._options = { ...this._options, ...options };
		if (this._options.draggable !== wasDraggable && this._attached()) {
			this._unsubscribePointerEvents();
			this._subscribePointerEvents();
		}
		this._requestUpdate?.();
	}

	/** Fired whenever a level's price changes, including on every drag step. */
	public levelChanged(): ISubscription<TradeLevelChangedEventArgs> {
		return this._levelChanged;
	}

	/** Fired when a level drag starts. */
	public dragStarted(): ISubscription<TradeLevelChangedEventArgs> {
		return this._dragStarted;
	}

	/** Fired when a level drag ends, with the level's final price. */
	public dragEnded(): ISubscription<TradeLevelChangedEventArgs> {
		return this._dragEnded;
	}

	/** Moves the average entry price of the position. */
	public setEntry(price: number): void {
		this._model.setEntry(price);
	}	/** Moves the stop loss, creating it when the position has none. */
	public setStopLoss(price: number): void {
		this._model.setStopLoss(price);
	}	/** Moves the take profit, creating it when the position has none. */
	public setTakeProfit(price: number): void {
		this._model.setTakeProfit(price);
	}

	/** Replaces the whole position in one call. */
	public setPosition(position: TradePosition): void {
		this._model.setPosition(position);
	}

	/** The profit or loss of the position at the series' last price. */
	public currentProfit(): number | null {
		const price = this._lastBarPrice();
		return price === null ? null : this._model.profitAtPrice(price);
	}

	// --- internals ----------------------------------------------------------------

	/** The chart, while the primitive is attached; used by the axis labels. */
	private _chartOrNull(): IChartApi | null {
		return this._chart;
	}

	/** The series, while the primitive is attached. */
	public seriesOrNull(): ISeriesApi<SeriesType> | null {
		return this._series;
	}

	private _attached(): boolean {
		return this._chart !== null && this._series !== null;
	}
	private _onModelChanged(): void {
		if (this._dragKind !== null) {
			this._levelChanged.fire({
				kind: this._dragKind,
				price: this._model.levelPrice(this._dragKind) ?? this._model.entry(),
				dragging: true,
			});
		}
		this._requestUpdate?.();
	}

	private readonly _onDataChanged = (): void => {
		// The last bar's price is what the P&L is measured against; a new bar
		// or an update of the current one changes it, so the badge must follow.
		this._requestUpdate?.();
	};

	/** The colour of one level's line and axis label. */
	public levelColor(kind: TradeLevelKind): string {
		if (kind === 'entry') {
			return this._options.entryColor;
		}
		if (kind === 'stopLoss') {
			return this._options.stopLossColor;
		}
		return this._options.takeProfitColor;
	}

	/** The text of one level's price axis label, empty when the level is absent. */
	private _axisLabelText(kind: TradeLevelKind): string {
		const price = this._model.levelPrice(kind);
		if (price === null) {
			return '';
		}
		const labelText =
			kind === 'entry'
				? this._options.entryLabelText
				: kind === 'stopLoss'
					? this._options.stopLossLabelText
					: this._options.takeProfitLabelText;
		const formatter = this._series?.priceFormatter();
		const priceText =
			formatter === undefined ? price.toFixed(2) : formatter.format(price);
		return `${labelText} ${priceText}`;
	}

	/**
	 * The price the position's P&L is measured against: the close of the last
	 * bar of the series the primitive is attached to. The index is taken from
	 * the visible range so that a series being updated in steps, where the last
	 * bar is not the last logical index, is still resolved.
	 */
	private _lastBarPrice(): number | null {
		const series = this._series;
		const chart = this._chart;
		if (series === null || chart === null) {
			return null;
		}
		const visibleRange = chart.timeScale().getVisibleLogicalRange();
		const lastIndex = visibleRange === null
			? null
			: Math.ceil(visibleRange.to) as Logical;
		const bar = series.dataByIndex(
			lastIndex ?? Number.MAX_SAFE_INTEGER as Logical,
			MismatchDirection.NearestLeft
		);
		if (bar === null) {
			return null;
		}
		const close = (bar as { close?: number }).close;
		const value = (bar as { value?: number }).value;
		if (typeof close === 'number') {
			return close;
		}
		if (typeof value === 'number') {
			return value;
		}
		return null;
	}

	private _levelY(kind: TradeLevelKind): Coordinate | null {
		const price = this._model.levelPrice(kind);
		const series = this._series;
		if (price === null || series === null) {
			return null;
		}
		return series.priceToCoordinate(price);
	}

	/** The level whose line is nearest to `y`, within the drag tolerance. */
	private _levelAt(y: number): TradeLevelKind | null {
		let closest: TradeLevelKind | null = null;
		let closestDistance = Infinity;
		for (const kind of ['entry', 'stopLoss', 'takeProfit'] as TradeLevelKind[]) {
			const levelY = this._levelY(kind);
			if (levelY === null) {
				continue;
			}
			const distance = Math.abs(y - levelY);
			if (
				distance <= this._options.dragHitTolerance &&
				distance < closestDistance
			) {
				closest = kind;
				closestDistance = distance;
			}
		}
		return closest;
	}

	private _levelDistance(y: number, kind: TradeLevelKind): number {
		const levelY = this._levelY(kind);
		return levelY === null ? Infinity : Math.abs(y - levelY);
	}

	/** Everything the pane renderer draws, from the model and the last bar. */
	public rendererData(): TradeRendererData {
		const series = this._series;
		const dragging = this._dragKind !== null;
		if (series === null) {
			return { levels: [], entry: null, currentPrice: 0, dragging };
		}
		const currentPrice = this._lastBarPrice();
		if (currentPrice === null) {
			return { levels: [], entry: null, currentPrice: 0, dragging };
		}
		const entryY = this._levelY('entry');
		const profit = this._model.profitAtPrice(currentPrice);
		const levels: TradeLevelRendererData[] = [
			{
				price: this._model.entry(),
				y: entryY,
				dashed: false,
				color: this.levelColor('entry'),
				labelText: this._options.entryLabelText,
			},
		];
		this._pushLevelData(levels, 'stopLoss');
		this._pushLevelData(levels, 'takeProfit');
		const currentPriceY = series.priceToCoordinate(currentPrice);
		const entry: TradeEntryRendererData = {
			price: this._model.entry(),
			y: entryY,
			dashed: false,
			color: this.levelColor('entry'),
			labelText: this._options.entryLabelText,
			currentPriceY,
			profit,
			profitZone: null,
			lossZone: null,
		};
		if (entryY !== null && currentPriceY !== null) {
			const zone: TradeZoneRendererData = {
				topY: Math.min(entryY, currentPriceY),
				bottomY: Math.max(entryY, currentPriceY),
				color:
					profit >= 0
						? this._options.profitFillColor
						: this._options.lossFillColor,
				amount: profit,
			};
			if (profit >= 0) {
				entry.profitZone = zone;
			} else {
				entry.lossZone = zone;
			}
		}
		return { levels, entry, currentPrice, dragging };
	}

	private _pushLevelData(
		levels: TradeLevelRendererData[],
		kind: 'stopLoss' | 'takeProfit'
	): void {
		const y = this._levelY(kind);
		if (y === null) {
			return;
		}
		levels.push({
			price: this._model.levelPrice(kind) ?? 0,
			y,
			dashed: true,
			color: this.levelColor(kind),
			labelText:
				kind === 'stopLoss'
					? this._options.stopLossLabelText
					: this._options.takeProfitLabelText,
		});
	}

	// --- pointer handling ----------------------------------------------------------

	private _subscribePointerEvents(): void {
		const chart = this._chartOrNull();
		if (chart === null || !this._options.draggable) {
			return;
		}
		const element = chart.chartElement();
		const add = <K extends keyof HTMLElementEventMap>(
			type: K,
			handler: (event: HTMLElementEventMap[K]) => void
		): void => {
			const listener = handler as EventListener;
			element.addEventListener(type, listener);
			this._unsubscribers.push(() =>
				element.removeEventListener(type, listener)
			);
		};
		add('pointerdown', this._onPointerDown);
		add('pointermove', this._onPointerMove);
		add('pointerup', this._onPointerUp);
		add('pointercancel', this._onPointerUp);
	}

	private _unsubscribePointerEvents(): void {
		this._unsubscribers.forEach(unsubscribe => unsubscribe());
		this._unsubscribers = [];
	}

	/** The pointer's vertical position within the primitive's pane, or `null`. */
	private _paneY(clientY: number): number | null {
		const chart = this._chartOrNull();
		const series = this.seriesOrNull();
		if (chart === null || series === null) {
			return null;
		}
		const element = chart.chartElement();
		const box = element.getBoundingClientRect();
		const y = clientY - box.top;
		if (y < 0 || y > element.clientHeight) {
			return null;
		}
		return y;
	}

	private _onPointerDown = (event: PointerEvent): void => {
		if (this._dragKind !== null || !event.isPrimary || event.button !== 0) {
			return;
		}
		const y = this._paneY(event.clientY);
		if (y === null) {
			return;
		}
		const kind = this._levelAt(y);
		if (kind === null) {
			return;
		}
		this._startDrag(kind);
	};

	private _onPointerMove = (event: PointerEvent): void => {
		this._pointerY = this._paneY(event.clientY);
		if (this._dragKind === null || this._pointerY === null) {
			return;
		}
		const series = this.seriesOrNull();
		if (series === null) {
			return;
		}
		const price = series.coordinateToPrice(this._pointerY);
		if (price === null) {
			return;
		}
		this._model.setLevelPrice(this._dragKind, price);
	};

	private _onPointerUp = (): void => {
		this._endDrag();
	};

	/** Starts dragging a level, suspending the chart's own interactions. */
	private _startDrag(kind: TradeLevelKind): void {
		const chart = this._chartOrNull();
		const price = this._model.levelPrice(kind);
		if (chart === null || price === null) {
			return;
		}
		this._dragKind = kind;
		// The chart would otherwise pan and scale under the pointer while the
		// level moves. The previous values are captured so the drag can put them
		// back exactly, whatever they were.
		const { handleScroll, handleScale } = chart.options();
		chart.applyOptions({ handleScroll: false, handleScale: false });
		this._restoreInteractions = () =>
			chart.applyOptions({ handleScroll, handleScale });
		this._dragStarted.fire({ kind, price, dragging: true });
		this._requestUpdate?.();
	}

	/** Ends the drag in progress, if any, and restores the chart's interactions. */
	private _endDrag(): void {
		const kind = this._dragKind;
		this._dragKind = null;
		this._pointerY = null;
		if (this._restoreInteractions !== null) {
			const restore = this._restoreInteractions;
			this._restoreInteractions = null;
			restore();
		}
		if (kind !== null) {
			const price = this._model.levelPrice(kind);
			if (price !== null) {
				this._dragEnded.fire({ kind, price, dragging: false });
			}
		}
	}
}
