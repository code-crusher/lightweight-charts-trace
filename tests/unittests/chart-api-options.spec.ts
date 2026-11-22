/* eslint-disable @typescript-eslint/no-floating-promises */
import { expect } from 'chai';
import { after, describe, it } from 'node:test';

import { ChartOptions } from '../../src/api/create-chart';
import { Mutable } from '../../src/helpers/mutable';
import { SolidColor } from '../../src/model/layout-options';

/**
 * A minimal stand-in DOM, enough to construct a chart in Node. Nothing is
 * rendered, so elements only remember their children.
 */
class FakeElement {
	public readonly tagName: string;
	public readonly style: Record<string, string> = {};
	public readonly children: FakeElement[] = [];
	public readonly classList: { add: () => void; remove: () => void } = { add: (): void => {}, remove: (): void => {} };
	public readonly ownerDocument: FakeDocument;
	public readonly defaultView: FakeWindow;
	public parentElement: FakeElement | null = null;
	public clientWidth: number = 16;
	public clientHeight: number = 16;
	public width: number = 16;
	public height: number = 16;

	public constructor(tagName: string, ownerDocument: FakeDocument, defaultView: FakeWindow) {
		this.tagName = tagName;
		this.ownerDocument = ownerDocument;
		this.defaultView = defaultView;
	}

	public setAttribute(): void {}
	public removeAttribute(): void {}
	public addEventListener(): void {}
	public removeEventListener(): void {}
	public setPointerCapture(): void {}
	public releasePointerCapture(): void {}
	public focus(): void {}
	public toggleAttribute(): void {}
	public hasAttribute(): boolean {
		return false;
	}

	public querySelector(): null {
		return null;
	}

	public querySelectorAll(): FakeElement[] {
		return [];
	}

	public appendChild(child: FakeElement): FakeElement {
		this.children.push(child);
		child.parentElement = this;
		return child;
	}

	public removeChild(child: FakeElement): FakeElement {
		const index = this.children.indexOf(child);
		if (index !== -1) {
			this.children.splice(index, 1);
		}
		return child;
	}

	public insertBefore(child: FakeElement): FakeElement {
		return this.appendChild(child);
	}

	public getBoundingClientRect(): { width: number; height: number; left: number; top: number; right: number; bottom: number } {
		return { width: 600, height: 300, left: 0, top: 0, right: 600, bottom: 300 };
	}

	public getClientRects(): { width: number; height: number; left: number; top: number }[] {
		return [{ width: 16, height: 16, left: 0, top: 0 }];
	}

	public getContext(): Record<string, () => void> {
		return { clearRect: (): void => {}, fillRect: (): void => {}, save: (): void => {}, restore: (): void => {} };
	}
}

class FakeWindow {
	public readonly devicePixelRatio: number = 1;
	public readonly navigator: { platform: string; userAgent: string } = { platform: '', userAgent: '' };

	public requestAnimationFrame(): number {
		return 1;
	}

	public cancelAnimationFrame(): void {}

	public matchMedia(): { addListener: () => void; removeListener: () => void } {
		return { addListener: (): void => {}, removeListener: (): void => {} };
	}

	public getComputedStyle(): { color: string } {
		return { color: 'rgb(0, 0, 0)' };
	}
}

class FakeDocument {
	public readonly body: FakeElement;
	public readonly documentElement: FakeElement;
	public readonly defaultView: FakeWindow;
	public readonly addedEventListeners: string[] = [];

	public constructor() {
		this.defaultView = new FakeWindow();
		this.body = this.createElement('body');
		this.documentElement = this.createElement('html');
	}

	public createElement(tagName: string): FakeElement {
		return new FakeElement(tagName, this, this.defaultView);
	}

	public addEventListener(type: string): void {
		this.addedEventListeners.push(type);
	}

	public removeEventListener(): void {}
}

const globals = globalThis as unknown as Record<string, unknown>;
const fakeDocument = new FakeDocument();
const savedGlobals = new Map<string, unknown>([
	['document', globals.document],
	['window', globals.window],
	['location', globals.location],
	['ResizeObserver', globals.ResizeObserver],
]);

class FakeResizeObserver {
	public observe(): void {}
	public disconnect(): void {}
}

globals.document = fakeDocument;
globals.window = fakeDocument.defaultView;
globals.location = { href: 'http://localhost/' };
globals.ResizeObserver = FakeResizeObserver;

after(() => {
	for (const [name, value] of savedGlobals) {
		if (value === undefined) {
			delete globals[name];
		} else {
			globals[name] = value;
		}
	}
});

// imported after the globals above are installed, because the modules read them on import
const chartApiModule = await import('../../src/api/chart-api');
const createChartModule = await import('../../src/api/create-chart');
const horzScaleBehaviorTimeModule = await import('../../src/model/horz-scale-behavior-time/horz-scale-behavior-time');
const lineSeriesModule = await import('../../src/model/series/line-series');

function createContainer(): HTMLElement {
	return fakeDocument.createElement('div') as unknown as HTMLElement;
}

describe('ChartApi.options()', () => {
	it('returns currently applied options', () => {
		const chart = createChartModule.createChart(createContainer(), { width: 600, height: 300 });

		try {
			const options = chart.options();

			expect(options.width).to.equal(600);
			expect(options.height).to.equal(300);
			expect(options.layout.background).to.deep.equal({ type: 'solid', color: '#FFFFFF' });
		} finally {
			chart.remove();
		}
	});

	it('returns a copy that is not shared with the chart', () => {
		const chart = createChartModule.createChart(createContainer());

		try {
			const options = chart.options();
			const again = chart.options();

			expect(options).to.not.equal(again);
			expect(options.layout).to.not.equal(again.layout);
			expect(options).to.deep.equal(again);
		} finally {
			chart.remove();
		}
	});

	it('does not let the caller change the chart by mutating the returned options', () => {
		const chart = createChartModule.createChart(createContainer());

		try {
			const options = chart.options() as Mutable<ChartOptions>;
			options.width = 100;
			(options.layout.background as SolidColor).color = '#FF0000';
			options.timeScale.barSpacing = 100;

			const current = chart.options();
			expect(current.width).to.not.equal(100);
			expect(current.layout.background).to.deep.equal({ type: 'solid', color: '#FFFFFF' });
			expect(current.timeScale.barSpacing).to.not.equal(100);
		} finally {
			chart.remove();
		}
	});

	it('returns options that are not changed by a later applyOptions call', () => {
		const chart = createChartModule.createChart(createContainer());

		try {
			const options = chart.options();
			chart.applyOptions({ layout: { background: { color: '#FF0000' } } });

			expect(options.layout.background).to.deep.equal({ type: 'solid', color: '#FFFFFF' });
			expect(chart.options().layout.background).to.deep.equal({ type: 'solid', color: '#FF0000' });
		} finally {
			chart.remove();
		}
	});

	it('returns options that are not changed by adding a series', () => {
		const chart = createChartModule.createChart(createContainer());

		try {
			const options = chart.options();
			chart.addSeries(lineSeriesModule.lineSeries);

			expect(options.layout).to.deep.equal(chart.options().layout);
		} finally {
			chart.remove();
		}
	});
});

describe('ChartApi horizontal scale behaviour options', () => {
	it('shares the chart options object with the behaviour', () => {
		const behavior = new horzScaleBehaviorTimeModule.HorzScaleBehaviorTime();
		const chart = new chartApiModule.ChartApi(createContainer(), behavior);

		try {
			expect(behavior.options()).to.equal(chart.horzBehaviour().options());
		} finally {
			chart.remove();
		}
	});

	it('lets the behaviour see the options applied later', () => {
		const behavior = new horzScaleBehaviorTimeModule.HorzScaleBehaviorTime();
		const chart = new chartApiModule.ChartApi(createContainer(), behavior);

		try {
			chart.applyOptions({ timeScale: { timeVisible: true, secondsVisible: true } });
			expect(behavior.options().timeScale.timeVisible).to.equal(true);
			expect(behavior.options().timeScale.secondsVisible).to.equal(true);

			chart.applyOptions({ localization: { locale: 'de-DE' } });
			expect(behavior.options().localization.locale).to.equal('de-DE');
		} finally {
			chart.remove();
		}
	});

	it('gives the behaviour the full options, including the defaults', () => {
		const behavior = new horzScaleBehaviorTimeModule.HorzScaleBehaviorTime();
		const chart = new chartApiModule.ChartApi(createContainer(), behavior, { width: 600 });

		try {
			expect(behavior.options()).to.deep.equal(chart.options());
		} finally {
			chart.remove();
		}
	});
});
