import { TimeAxisViewRenderer } from '../../renderers/time-axis-view-renderer';

import { ZIndexedAxisView } from '../axis-view-z-order';

export interface ITimeAxisView extends ZIndexedAxisView {
	renderer(): TimeAxisViewRenderer;
}
