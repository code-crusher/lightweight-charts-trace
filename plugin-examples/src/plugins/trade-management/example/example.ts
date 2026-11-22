import { CandlestickSeries, LineSeries, createChart } from 'lightweight-charts';
import { generateCandleData, generateLineData } from '../../../sample-data';
import { TradeManagement } from '../trade-management';

const chart = ((window as unknown as any).chart = createChart('chart', {
	autoSize: true,
}));

const candleSeries = chart.addSeries(CandlestickSeries);
const data = generateCandleData(150);
candleSeries.setData(data);

const averagePriceSeries = chart.addSeries(LineSeries, {
	color: 'rgba(41, 98, 255, 0.6)',
	lineWidth: 1,
	lineStyle: 2,
	priceLineVisible: false,
	lastValueVisible: false,
	autoscaleInfoProvider: () => ({
		priceRange: {
			minValue: 0,
			maxValue: 500,
		},
	}),
});
averagePriceSeries.setData(
	generateLineData(150).map((_point, index) => ({
		time: data[index].time,
		value: 100 + Math.sin(index / 12) * 20,
	}))
);

// A long position with a stop loss and a take profit around the last price.
const lastClose = data[data.length - 1].close;
const trade = new TradeManagement({
	entry: lastClose,
	stopLoss: lastClose - 20,
	takeProfit: lastClose + 30,
	quantity: 10,
	long: true,
});
candleSeries.attachPrimitive(trade);

// Log the position's figures as the levels move, the way a hosting app would.
const figures = document.querySelector<HTMLPreElement>('#figures')!;
const renderFigures = (): void => {
	const model = trade.model();
	const profit = trade.currentProfit();
	const riskReward = model.riskRewardRatio();
	figures.textContent = [
		`Entry:        ${model.entry().toFixed(2)}`,
		`Stop loss:    ${model.stopLoss()?.toFixed(2) ?? '—'}`,
		`Take profit:  ${model.takeProfit()?.toFixed(2) ?? '—'}`,
		`Quantity:     ${model.quantity()}`,
		`Risk:         ${model.risk()?.toFixed(2) ?? '—'}`,
		`Reward:       ${model.reward()?.toFixed(2) ?? '—'}`,
		`R/R ratio:    ${riskReward === null ? '—' : riskReward.toFixed(2)}`,
		`P&L:          ${profit === null ? '—' : profit.toFixed(2)}`,
	].join('\n');
};
trade.levelChanged().subscribe(() => renderFigures());
trade.dragEnded().subscribe(() => renderFigures());
renderFigures();

chart.timeScale().fitContent();
