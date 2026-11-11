import { PriceScale } from '../../model/price-scale';
import {
	IPriceAxisViewRenderer,
	PriceAxisViewRendererOptions,
} from '../../renderers/iprice-axis-view-renderer';

import { ZIndexedAxisView } from '../axis-view-z-order';

export interface IPriceAxisView extends ZIndexedAxisView {
	coordinate(): number;
	getFixedCoordinate(): number | null;
	getRenderCoordinate(): number;
	height(rendererOptions: PriceAxisViewRendererOptions, useSecondLine?: boolean): number;
	isVisible(): boolean;
	isAxisLabelVisible(): boolean;
	renderer(priceScale: PriceScale): IPriceAxisViewRenderer;
	paneRenderer(): IPriceAxisViewRenderer;
	setRenderCoordinate(value: number | null): void;
	text(): string;
	update(): void;
}
