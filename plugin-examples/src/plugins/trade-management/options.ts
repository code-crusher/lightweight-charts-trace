import { LineStyle } from 'lightweight-charts';

/** Options for the trade management plugin. */
export interface TradeManagementOptions {
	/** Colour of the entry line and its axis label. */
	entryColor: string;
	/** Colour of the stop loss line and its axis label. */
	stopLossColor: string;
	/** Colour of the take profit line and its axis label. */
	takeProfitColor: string;
	/** Fill colour of the area between the entry and the take profit. */
	profitFillColor: string;
	/** Fill colour of the area between the entry and the stop loss. */
	lossFillColor: string;
	/** Colour of the P&L badge and zone labels text. */
	textColor: string;
	/** Style of the stop loss and take profit lines. */
	exitLineStyle: LineStyle;
	/** Width of the entry, stop loss and take profit lines, in CSS pixels. */
	lineWidth: number;
	/** Show a label for each level on the price axis. */
	showPriceAxisLabels: boolean;
	/** Show the P&L badge next to the entry line. */
	showProfitLabel: boolean;
	/** Show the amount of each profit and loss zone inside the zone. */
	showZoneAmounts: boolean;
	/** Text of the entry line's axis label. */
	entryLabelText: string;
	/** Text of the stop loss line's axis label. */
	stopLossLabelText: string;
	/** Text of the take profit line's axis label. */
	takeProfitLabelText: string;
	/** Currency symbol prepended to the P&L amounts. */
	currencySymbol: string;
	/** Number of decimals of the P&L amounts. */
	amountDecimals: number;
	/** Distance from a line, in CSS pixels, still counted as a hit while dragging. */
	dragHitTolerance: number;
	/** Whether the levels can be dragged. */
	draggable: boolean;
}

/** Defaults for {@link TradeManagementOptions}. */
export const tradeManagementDefaults: TradeManagementOptions = {
	entryColor: '#2962FF',
	stopLossColor: '#F2333A',
	takeProfitColor: '#26A69A',
	profitFillColor: 'rgba(38, 166, 154, 0.15)',
	lossFillColor: 'rgba(242, 51, 58, 0.15)',
	textColor: '#FFFFFF',
	exitLineStyle: LineStyle.Dashed,
	lineWidth: 2,
	showPriceAxisLabels: true,
	showProfitLabel: true,
	showZoneAmounts: true,
	entryLabelText: 'Position',
	stopLossLabelText: 'SL',
	takeProfitLabelText: 'TP',
	currencySymbol: '$',
	amountDecimals: 2,
	dragHitTolerance: 4,
	draggable: true,
};

/** Constants used by the drawing code, kept next to the options they style. */
export const tradeManagementColors = {
	zoneLabelText: '#131722',
	badgeText: '#FFFFFF',
};

/** Font sizes and family used by the labels drawn on the canvas. */
export const tradeManagementFonts = {
	fontFamily:
		'-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif',
	zoneLabelFontSize: 12,
	badgeFontSize: 12,
	badgePadding: 6,
	badgeMargin: 8,
	badgeCornerRadius: 4,
	dashLength: 6,
};

/** The price level of one managed trade line, and the text drawn on it. */
export interface TradeLevelRendererData {
	/** Price of the level. */
	price: number;
	/** Vertical position of the level's price, or `null` when it is off scale. */
	y: number | null;
	/** Whether the line is drawn dashed, the entry line is always solid. */
	dashed: boolean;
	/** Colour of the line, the label background and the badges. */
	color: string;
	/** Text of the axis label, drawn in `labelTextColor`. */
	labelText: string;
}

/** A filled rectangle between the entry and one exit level. */
export interface TradeZoneRendererData {
	/** Vertical position of the top edge. */
	topY: number;
	/** Vertical position of the bottom edge. */
	bottomY: number;
	/** Fill colour of the zone. */
	color: string;
	/** The P&L of closing the whole position at the zone's far edge, in price units. */
	amount: number;
}

/** The entry level plus the profit and loss zones around it, for one pane. */
export interface TradeEntryRendererData extends TradeLevelRendererData {
	/** Vertical position of the current price the P&L is measured against. */
	currentPriceY: number | null;
	/** Profit or loss per unit held, at the current price. */
	profit: number;
	/** The profit zone between the entry and the current price, when it is a profit. */
	profitZone: TradeZoneRendererData | null;
	/** The loss zone between the entry and the current price, when it is a loss. */
	lossZone: TradeZoneRendererData | null;
}

/** Everything the pane renderer draws: the zones, the levels and the P&L badge. */
export interface TradeRendererData {
	/** The levels in draw order: entry, stop loss, take profit. */
	levels: TradeLevelRendererData[];
	/** The entry level with its zones, or `null` while there is no current price. */
	entry: TradeEntryRendererData | null;
	/** The price the P&L is measured against. */
	currentPrice: number;
	/** True while the position is being dragged, which hides the P&L badge. */
	dragging: boolean;
}
