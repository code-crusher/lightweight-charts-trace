import { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D, MediaCoordinatesRenderingScope } from 'fancy-canvas';

import { ensureDefined } from '../helpers/assertions';
import { drawRoundRectWithBorder } from '../helpers/canvas-helpers';
import { makeFont } from '../helpers/make-font';

import { TextWidthCache } from '../model/text-width-cache';

import {
	IPriceAxisViewRenderer,
	PriceAxisViewRendererCommonData,
	PriceAxisViewRendererData,
	PriceAxisViewRendererOptions,
} from './iprice-axis-view-renderer';

interface Geometry {
	alignRight: boolean;

	// bitmap coordinate space geometry
	bitmap: {
		yTop: number;
		yMid: number;
		yBottom: number;
		totalWidth: number;
		totalHeight: number;
		radius: number;
		horzBorder: number;
		xOutside: number;
		xInside: number;
		xTick: number;
		tickHeight: number;
		right: number;
	};

	// media coordinate space geometry
	media: {
		yTop: number;
		yBottom: number;
		xText: number;
		firstLineY: number;
		textMidCorrection: number;
		secondLineY?: number;
		secondLineMidCorrection?: number;
	};
}

export class PriceAxisViewRenderer implements IPriceAxisViewRenderer {
	private _data!: PriceAxisViewRendererData;
	private _commonData!: PriceAxisViewRendererCommonData;

	public constructor(data: PriceAxisViewRendererData, commonData: PriceAxisViewRendererCommonData) {
		this.setData(data, commonData);
	}

	public setData(data: PriceAxisViewRendererData, commonData: PriceAxisViewRendererCommonData): void {
		this._data = data;
		this._commonData = commonData;
	}

	public height(rendererOptions: PriceAxisViewRendererOptions, useSecondLine: boolean): number {
		if (!this._data.visible) {
			return 0;
		}

		let height = rendererOptions.fontSize + rendererOptions.paddingTop + rendererOptions.paddingBottom;
		if (this._data.secondLineText !== undefined) {
			height += this._secondLineHeight(rendererOptions);
		}

		return height;
	}

	private _secondLineHeight(rendererOptions: PriceAxisViewRendererOptions): number {
		return this._secondLineFontSize(rendererOptions) + rendererOptions.paddingBottom;
	}

	private _secondLineFontSize(rendererOptions: PriceAxisViewRendererOptions): number {
		// the second line is slightly smaller than the main one, similar to TradingView charts
		return Math.max(rendererOptions.fontSize - 2, Math.floor(rendererOptions.fontSize * 0.75));
	}

	public draw(
		target: CanvasRenderingTarget2D,
		rendererOptions: PriceAxisViewRendererOptions,
		textWidthCache: TextWidthCache,
		align: 'left' | 'right'
	): void {
		if (!this._data.visible || this._data.text.length === 0) {
			return;
		}

		const textColor = this._data.color;
		const backgroundColor = this._commonData.background;
		const secondLineText = this._data.secondLineText ?? '';
		const hasSecondLine = secondLineText.length > 0;
		const secondLineFont = hasSecondLine ? this._secondLineFont(rendererOptions) : '';

		const geometry = target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => {
			const ctx = scope.context;
			ctx.font = rendererOptions.font;
			const geom = this._calculateGeometry(scope, rendererOptions, textWidthCache, align, secondLineFont);
			const gb = geom.bitmap;

			/*
			 draw label. backgroundColor will always be a solid color (no alpha) [see generateContrastColors in color.ts].
			 Therefore we can draw the rounded label using simplified code (drawRoundRectWithBorder) that doesn't need to ensure the background and the border don't overlap.
			*/
			if (geom.alignRight) {
				drawRoundRectWithBorder(
					ctx,
					gb.xOutside,
					gb.yTop,
					gb.totalWidth,
					gb.totalHeight,
					backgroundColor,
					gb.horzBorder,
					[gb.radius, 0, 0, gb.radius],
					backgroundColor
				);
			} else {
				drawRoundRectWithBorder(
					ctx,
					gb.xInside,
					gb.yTop,
					gb.totalWidth,
					gb.totalHeight,
					backgroundColor,
					gb.horzBorder,
					[0, gb.radius, gb.radius, 0],
					backgroundColor
				);
			}
			// draw tick
			if (this._data.tickVisible) {
				ctx.fillStyle = textColor;
				ctx.fillRect(gb.xInside, gb.yMid, gb.xTick - gb.xInside, gb.tickHeight);
			}

			// draw separator
			if (this._data.borderVisible) {
				ctx.fillStyle = rendererOptions.paneBackgroundColor;
				ctx.fillRect(
					geom.alignRight ? gb.right - gb.horzBorder : 0,
					gb.yTop,
					gb.horzBorder,
					gb.yBottom - gb.yTop
				);
			}

			return geom;
		});

		target.useMediaCoordinateSpace(({ context: ctx }: MediaCoordinatesRenderingScope) => {
			const gm = geometry.media;
			ctx.textAlign = geometry.alignRight ? 'right' : 'left';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = textColor;
			if (!hasSecondLine) {
				ctx.font = rendererOptions.font;
				ctx.fillText(this._data.text, gm.xText, (gm.yTop + gm.yBottom) / 2 + gm.textMidCorrection);
				return;
			}

			ctx.font = rendererOptions.font;
			ctx.fillText(this._data.text, gm.xText, gm.firstLineY + gm.textMidCorrection);
			ctx.font = secondLineFont;
			ctx.fillText(secondLineText, gm.xText, ensureDefined(gm.secondLineY) + ensureDefined(gm.secondLineMidCorrection));
		});
	}

	private _calculateGeometry(
		scope: BitmapCoordinatesRenderingScope,
		rendererOptions: PriceAxisViewRendererOptions,
		textWidthCache: TextWidthCache,
		align: 'left' | 'right',
		secondLineFont: string
	): Geometry {
		const { context: ctx, bitmapSize, mediaSize, horizontalPixelRatio, verticalPixelRatio } = scope;
		const tickSize = (this._data.tickVisible || !this._data.moveTextToInvisibleTick) ? rendererOptions.tickLength : 0;
		const horzBorder = this._data.separatorVisible ? rendererOptions.borderSize : 0;
		const paddingTop = rendererOptions.paddingTop + this._commonData.additionalPaddingTop;
		const paddingBottom = rendererOptions.paddingBottom + this._commonData.additionalPaddingBottom;
		const paddingInner = rendererOptions.paddingInner;
		const paddingOuter = rendererOptions.paddingOuter;
		const text = this._data.text;
		const actualTextHeight = rendererOptions.fontSize;
		const textMidCorrection = textWidthCache.yMidCorrection(ctx, text);

		const secondLineText = this._data.secondLineText ?? '';
		const hasSecondLine = secondLineFont !== '' && secondLineText.length > 0;
		const secondLineTextHeight = hasSecondLine ? this._secondLineFontSize(rendererOptions) : 0;

		let textWidth = Math.ceil(textWidthCache.measureText(ctx, text));
		let secondLineMidCorrection = 0;
		if (hasSecondLine) {
			// the second line is drawn with a smaller font, so both its metrics
			// (width - it can be wider than the price text, e.g. a full date below
			// a short price - and the mid correction) must be measured with that font
			const savedFont = ctx.font;
			ctx.font = secondLineFont;
			const secondLineWidth = Math.ceil(textWidthCache.measureText(ctx, secondLineText));
			secondLineMidCorrection = textWidthCache.yMidCorrection(ctx, secondLineText);
			ctx.font = savedFont;
			textWidth = Math.max(textWidth, secondLineWidth);
		}

		const totalHeight = actualTextHeight + paddingTop + paddingBottom
			+ (hasSecondLine ? secondLineTextHeight + paddingBottom : 0);

		const totalWidth = rendererOptions.borderSize + paddingInner + paddingOuter + textWidth + tickSize;

		const tickHeightBitmap = Math.max(1, Math.floor(verticalPixelRatio));
		let totalHeightBitmap = Math.round(totalHeight * verticalPixelRatio);
		if (totalHeightBitmap % 2 !== tickHeightBitmap % 2) {
			totalHeightBitmap += 1;
		}
		const horzBorderBitmap = horzBorder > 0 ? Math.max(1, Math.floor(horzBorder * horizontalPixelRatio)) : 0;
		const totalWidthBitmap = Math.round(totalWidth * horizontalPixelRatio);
		// tick overlaps scale border
		const tickSizeBitmap = Math.round(tickSize * horizontalPixelRatio);

		const yMid = this._commonData.fixedCoordinate ?? this._commonData.renderCoordinate ?? this._commonData.coordinate;
		const yMidBitmap = Math.round(yMid * verticalPixelRatio) - Math.floor(verticalPixelRatio * 0.5);
		const yTopBitmap = Math.floor(yMidBitmap + tickHeightBitmap / 2 - totalHeightBitmap / 2);
		const yBottomBitmap = yTopBitmap + totalHeightBitmap;

		const alignRight = align === 'right';

		const xInside = alignRight ? mediaSize.width - horzBorder : horzBorder;
		const xInsideBitmap = alignRight ? bitmapSize.width - horzBorderBitmap : horzBorderBitmap;

		let xOutsideBitmap: number;
		let xTickBitmap: number;
		let xText: number;

		if (alignRight) {
			// 2               1
			//
			//              6  5
			//
			// 3               4
			xOutsideBitmap = xInsideBitmap - totalWidthBitmap;
			xTickBitmap = xInsideBitmap - tickSizeBitmap;
			xText = xInside - tickSize - paddingInner - horzBorder;
		} else {
			// 1               2
			//
			// 6  5
			//
			// 4               3
			xOutsideBitmap = xInsideBitmap + totalWidthBitmap;
			xTickBitmap = xInsideBitmap + tickSizeBitmap;
			xText = xInside + tickSize + paddingInner;
		}

		const yTop = yTopBitmap / verticalPixelRatio;
		const yBottom = yBottomBitmap / verticalPixelRatio;

		let firstLineY = (yTop + yBottom) / 2;
		let secondLineY: number | undefined;
		if (hasSecondLine) {
			// the first (price) line is centered within its own slice of the label,
			// the second (date/time) line within the slice below it
			const firstLineBottom = yTop + paddingTop + actualTextHeight + paddingBottom / 2;
			firstLineY = yTop + paddingTop + actualTextHeight / 2;
			secondLineY = firstLineBottom + secondLineTextHeight / 2;
		}

		return {
			alignRight,
			bitmap: {
				yTop: yTopBitmap,
				yMid: yMidBitmap,
				yBottom: yBottomBitmap,
				totalWidth: totalWidthBitmap,
				totalHeight: totalHeightBitmap,
				// TODO: it is better to have different horizontal and vertical radii
				radius: 2 * horizontalPixelRatio,
				horzBorder: horzBorderBitmap,
				xOutside: xOutsideBitmap,
				xInside: xInsideBitmap,
				xTick: xTickBitmap,
				tickHeight: tickHeightBitmap,
				right: bitmapSize.width,
			},
			media: {
				yTop,
				yBottom,
				xText,
				firstLineY,
				textMidCorrection,
				secondLineY,
				secondLineMidCorrection: hasSecondLine ? secondLineMidCorrection : undefined,
			},
		};
	}

	private _secondLineFont(rendererOptions: PriceAxisViewRendererOptions): string {
		return makeFont(this._secondLineFontSize(rendererOptions), rendererOptions.fontFamily);
	}
}
