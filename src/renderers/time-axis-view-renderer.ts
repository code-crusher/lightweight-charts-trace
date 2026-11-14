import { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D, MediaCoordinatesRenderingScope } from 'fancy-canvas';

import { ensureNotNull } from '../helpers/assertions';

import { ITimeAxisViewRenderer, TimeAxisViewRendererOptions } from './itime-axis-view-renderer';

export interface TimeAxisViewRendererData {
	width: number;
	text: string;
	coordinate: number;
	fixedCoordinate?: number;
	color: string;
	background: string;
	visible: boolean;
	tickVisible: boolean;
}

const optimizationReplacementRe = /[1-9]/g;

const radius = 2;

export class TimeAxisViewRenderer implements ITimeAxisViewRenderer {
	private _data: TimeAxisViewRendererData | null;
	private _renderCoordinate: number | null = null;

	public constructor() {
		this._data = null;
	}

	public setData(data: TimeAxisViewRendererData): void {
		this._data = data;
	}

	/**
	 * The coordinate requested by the view, without any adjustment made by the axis layout. A fixed
	 * coordinate takes precedence over it.
	 */
	public coordinate(): number {
		return this._data?.fixedCoordinate ?? this._data?.coordinate ?? 0;
	}

	/**
	 * Whether the view asks for the label to be drawn at a fixed coordinate.
	 */
	public isFixed(): boolean {
		return this._data?.fixedCoordinate !== undefined;
	}

	/**
	 * The coordinate the label is drawn at: the render coordinate assigned by the axis layout when
	 * there is one, otherwise the coordinate requested by the view.
	 */
	public getRenderCoordinate(): number {
		return this._renderCoordinate ?? this.coordinate();
	}

	/**
	 * Assigns the coordinate to draw the label at. Pass `null` to draw it at the coordinate requested
	 * by the view again.
	 */
	public setRenderCoordinate(value: number | null): void {
		this._renderCoordinate = value;
	}

	/**
	 * The width the label takes on the axis, including the space around the text, in media pixels.
	 * Returns `0` for a label which is not drawn.
	 */
	public labelWidth(rendererOptions: TimeAxisViewRendererOptions, ctx: CanvasRenderingContext2D): number {
		const textWidth = this._textWidth(rendererOptions, ctx);
		return textWidth <= 0 ? 0 : textWidth + 2 * rendererOptions.paddingHorizontal;
	}

	public draw(target: CanvasRenderingTarget2D, rendererOptions: TimeAxisViewRendererOptions): void {
		if (this._data === null || this._data.visible === false || this._data.text.length === 0) {
			return;
		}

		const textWidth = target.useMediaCoordinateSpace(({ context: ctx }: MediaCoordinatesRenderingScope) => this._textWidth(rendererOptions, ctx));
		if (textWidth <= 0) {
			return;
		}

		const horzMargin = rendererOptions.paddingHorizontal;
		const labelWidth = textWidth + 2 * horzMargin;
		const labelWidthHalf = labelWidth / 2;
		const timeScaleWidth = this._data.width;
		let x1: number;

		if (this._renderCoordinate === null) {
			// no coordinate assigned by the axis layout: center the label on the requested coordinate
			// and move it back inside the axis if it does not fit
			let coordinate = this.coordinate();
			x1 = Math.floor(coordinate - labelWidthHalf) + 0.5;

			if (x1 < 0) {
				coordinate = coordinate + Math.abs(0 - x1);
				x1 = Math.floor(coordinate - labelWidthHalf) + 0.5;
			} else if (x1 + labelWidth > timeScaleWidth) {
				coordinate = coordinate - Math.abs(timeScaleWidth - (x1 + labelWidth));
				x1 = Math.floor(coordinate - labelWidthHalf) + 0.5;
			}
		} else {
			// the axis layout has already placed the label, so draw it exactly where it asks
			x1 = this._renderCoordinate - labelWidthHalf;
		}

		const x2 = x1 + labelWidth;

		const y1 = 0;
		const y2 = Math.ceil(
			y1 +
			rendererOptions.borderSize +
			rendererOptions.tickLength +
			rendererOptions.paddingTop +
			rendererOptions.fontSize +
			rendererOptions.paddingBottom
		);

		target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio, verticalPixelRatio }: BitmapCoordinatesRenderingScope) => {
			const data = ensureNotNull(this._data);

			ctx.fillStyle = data.background;

			const x1scaled = Math.round(x1 * horizontalPixelRatio);
			const y1scaled = Math.round(y1 * verticalPixelRatio);
			const x2scaled = Math.round(x2 * horizontalPixelRatio);
			const y2scaled = Math.round(y2 * verticalPixelRatio);
			const radiusScaled = Math.round(radius * horizontalPixelRatio);
			ctx.beginPath();
			ctx.moveTo(x1scaled, y1scaled);
			ctx.lineTo(x1scaled, y2scaled - radiusScaled);
			ctx.arcTo(x1scaled, y2scaled, x1scaled + radiusScaled, y2scaled, radiusScaled);
			ctx.lineTo(x2scaled - radiusScaled, y2scaled);
			ctx.arcTo(x2scaled, y2scaled, x2scaled, y2scaled - radiusScaled, radiusScaled);
			ctx.lineTo(x2scaled, y1scaled);
			ctx.fill();

			if (data.tickVisible) {
				const tickX = Math.round(data.coordinate * horizontalPixelRatio);
				const tickTop = y1scaled;
				const tickBottom = Math.round((tickTop + rendererOptions.tickLength) * verticalPixelRatio);

				ctx.fillStyle = data.color;
				const tickWidth = Math.max(1, Math.floor(horizontalPixelRatio));
				const tickOffset = Math.floor(horizontalPixelRatio * 0.5);
				ctx.fillRect(tickX - tickOffset, tickTop, tickWidth, tickBottom - tickTop);
			}
		});

		target.useMediaCoordinateSpace(({ context: ctx }: MediaCoordinatesRenderingScope) => {
			const data = ensureNotNull(this._data);

			const yText =
				y1 +
				rendererOptions.borderSize +
				rendererOptions.tickLength +
				rendererOptions.paddingTop +
				rendererOptions.fontSize / 2;

			ctx.font = rendererOptions.font;
			ctx.textAlign = 'left';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = data.color;

			const textYCorrection = rendererOptions.widthCache.yMidCorrection(ctx, 'Apr0');

			ctx.translate(x1 + horzMargin, yText + textYCorrection);
			ctx.fillText(data.text, 0, 0);
		});
	}

	private _textWidth(rendererOptions: TimeAxisViewRendererOptions, ctx: CanvasRenderingContext2D): number {
		if (this._data === null || this._data.visible === false || this._data.text.length === 0) {
			return 0;
		}

		ctx.font = rendererOptions.font;
		return Math.round(rendererOptions.widthCache.measureText(ctx, this._data.text, optimizationReplacementRe));
	}
}
