import {
	BitmapCoordinatesRenderingScope,
	CanvasRenderingTarget2D,
} from 'fancy-canvas';
import { IPrimitivePaneRenderer } from 'lightweight-charts';
import {
	positionsBox,
	positionsLine,
} from '@tradingview/lwc-toolkit/dimensions/positions';
import { drawRoundRect } from '@tradingview/lwc-toolkit/canvas/round-rect';
import {
	TradeEntryRendererData,
	TradeLevelRendererData,
	TradeRendererData,
	TradeZoneRendererData,
	tradeManagementColors,
	tradeManagementDefaults,
	tradeManagementFonts,
} from './options';

/** A zone label is only drawn when the zone is at least this tall, in bitmap pixels. */
const ZONE_LABEL_MIN_HEIGHT = 16;
/** Horizontal space, in bitmap pixels, kept clear around a zone label. */
const ZONE_LABEL_PADDING = 4;

/**
 * Draws one filled zone between the entry and an exit level, with the amount
 * of the P&L closing the position at the zone's far edge.
 */
function drawZone(
	scope: BitmapCoordinatesRenderingScope,
	zone: TradeZoneRendererData,
	currencySymbol: string
): void {
	const ctx = scope.context;
	const vertical = positionsBox(
		zone.topY,
		zone.bottomY,
		scope.verticalPixelRatio
	);
	if (vertical.length <= 0) {
		return;
	}
	ctx.fillStyle = zone.color;
	ctx.fillRect(0, vertical.position, scope.bitmapSize.width, vertical.length);
	if (!tradeManagementDefaults.showZoneAmounts) {
		return;
	}
	const text = `${zone.amount > 0 ? '+' : ''}${formatAmount(
		zone.amount,
		currencySymbol
	)}`;
	const font = `${tradeManagementFonts.zoneLabelFontSize}px ${tradeManagementFonts.fontFamily}`;
	ctx.save();
	try {
		ctx.font = font;
		const width = ctx.measureText(text).width;
		if (vertical.length < ZONE_LABEL_MIN_HEIGHT * scope.verticalPixelRatio) {
			return;
		}
		if (scope.bitmapSize.width <= width + 2 * ZONE_LABEL_PADDING * scope.horizontalPixelRatio) {
			return;
		}
		ctx.fillStyle = tradeManagementColors.zoneLabelText;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(
			text,
			scope.bitmapSize.width / 2,
			vertical.position + vertical.length / 2
		);
	} finally {
		ctx.restore();
	}
}

/** Draws one price level line across the whole pane. */
function drawLevelLine(
	scope: BitmapCoordinatesRenderingScope,
	level: TradeLevelRendererData
): void {
	if (level.y === null) {
		return;
	}
	const ctx = scope.context;
	const line = positionsLine(
		level.y,
		scope.verticalPixelRatio,
		tradeManagementDefaults.lineWidth
	);
	const centre = line.position + line.length / 2;
	ctx.save();
	try {
		ctx.strokeStyle = level.color;
		ctx.lineWidth = line.length;
		if (level.dashed) {
			const dash = tradeManagementFonts.dashLength * scope.verticalPixelRatio;
			ctx.setLineDash([dash, dash]);
		}
		ctx.beginPath();
		ctx.moveTo(0, centre);
		ctx.lineTo(scope.bitmapSize.width, centre);
		ctx.stroke();
	} finally {
		ctx.restore();
	}
}

/**
 * Draws the P&L badge of the position: a small rounded label hung off the
 * entry line, at the right edge of the pane.
 */
function drawProfitBadge(
	scope: BitmapCoordinatesRenderingScope,
	entry: TradeEntryRendererData & { y: number },
	currencySymbol: string
): void {
	const ctx = scope.context;
	const profit = entry.profit;
	const text = `${profit >= 0 ? '+' : ''}${formatAmount(profit, currencySymbol)}`;
	const font = `${tradeManagementFonts.badgeFontSize}px ${tradeManagementFonts.fontFamily}`;
	const badgeHeight =
		(tradeManagementFonts.badgeFontSize + tradeManagementFonts.badgePadding) *
		scope.verticalPixelRatio;
	ctx.save();
	try {
		ctx.font = font;
		const badgeWidth =
			ctx.measureText(text).width +
			tradeManagementFonts.badgePadding * 2 * scope.horizontalPixelRatio;
		const margin = tradeManagementFonts.badgeMargin * scope.horizontalPixelRatio;
		const left = Math.max(0, scope.bitmapSize.width - badgeWidth - margin);
		// The badge sits against the entry line, on the side the current price is:
		// towards the profit for a gain, towards the loss for a drawdown.
		const top =
			profit >= 0
				? entry.y - badgeHeight - margin
				: entry.y + margin;
		const radius = tradeManagementFonts.badgeCornerRadius * scope.horizontalPixelRatio;
		drawRoundRect(ctx, left, top, badgeWidth, badgeHeight, [
			radius,
			radius,
			radius,
			radius,
		]);
		ctx.fillStyle =
			profit >= 0
				? tradeManagementDefaults.profitFillColor
				: tradeManagementDefaults.lossFillColor;
		ctx.fill();
		// A translucent fill needs the text on top of a solid edge, or it washes
		// out against the zone behind it.
		ctx.font = font;
		ctx.fillStyle = tradeManagementColors.badgeText;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(
			text,
			left + tradeManagementFonts.badgePadding * scope.horizontalPixelRatio,
			top + badgeHeight / 2
		);
	} finally {
		ctx.restore();
	}
}

/** Formats an amount for a badge or a zone label: symbol, sign, fixed decimals. */
export function formatAmount(amount: number, currencySymbol: string): string {
	const value = amount.toFixed(tradeManagementDefaults.amountDecimals);
	return `${currencySymbol}${value}`;
}

/** Everything the pane renderer draws, from the model's current state. */
export class TradeManagementPaneRenderer implements IPrimitivePaneRenderer {
	private _data: TradeRendererData | null = null;
	private readonly _currencySymbol: string;

	public constructor(currencySymbol: string) {
		this._currencySymbol = currencySymbol;
	}

	public update(data: TradeRendererData | null): void {
		this._data = data;
	}

	public draw(target: CanvasRenderingTarget2D): void {
		const data = this._data;
		if (data === null) {
			return;
		}
		target.useBitmapCoordinateSpace(scope => {
			const entry = data.entry;
			if (entry !== null) {
				if (entry.profitZone !== null) {
					drawZone(scope, entry.profitZone, this._currencySymbol);
				}
				if (entry.lossZone !== null) {
					drawZone(scope, entry.lossZone, this._currencySymbol);
				}
			}
			for (const level of data.levels) {
				drawLevelLine(scope, level);
			}
			const entryY = entry === null ? null : entry.y;
			if (
				entry !== null &&
				entryY !== null &&
				!data.dragging &&
				tradeManagementDefaults.showProfitLabel
			) {
				drawProfitBadge(scope, { ...entry, y: entryY }, this._currencySymbol);
			}
		});
	}
}
