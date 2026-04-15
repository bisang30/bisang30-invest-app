import React, { useMemo, useState } from 'react';
import { Trade, Stock, TradeType, InitialPortfolio, AlertThresholds } from '../types';
import Card from '../components/ui/Card';
import { ChevronDownIcon, ChevronUpIcon } from '../components/Icons';

interface HoldingsStatusScreenProps {
  trades: Trade[];
  stocks: Stock[];
  stockPrices: { [key: string]: number };
  initialPortfolio: InitialPortfolio;
  alertThresholds: AlertThresholds;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(Math.round(value));

interface HoldingItemProps {
    holding: any;
}

const HoldingItem: React.FC<HoldingItemProps> = ({ holding }) => {
    const { name, quantity, sharesToTrade, currentValue, targetShares, status } = holding;
    const isBuy = sharesToTrade > 0;
    const isSell = sharesToTrade < 0;

    const progress = targetShares > 0 ? (quantity / targetShares) * 100 : 0;
    
    const statusStyles: { [key: string]: { borderColor: string } } = {
      warning: { borderColor: '#ef4444' }, // loss color
      caution: { borderColor: '#f59e0b' }, // amber-500
      normal: { borderColor: '#22c55e' }, // profit color for 'good' status
    };
    
    const currentStyle = statusStyles[status] || statusStyles.normal;

    return (
        <div className="p-4 bg-light-bg dark:bg-dark-bg/50 rounded-lg space-y-3 border-l-4 shadow-sm" style={{ borderColor: currentStyle.borderColor }}>
            {/* Top section: Quantity, Name, and Action */}
            <div className="flex justify-between items-start gap-2">
                <div>
                    <p className="text-3xl font-black text-light-text dark:text-dark-text tracking-tighter leading-tight">
                        {quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        <span className="text-xl font-bold ml-1">주</span>
                    </p>
                    <div className="flex items-center mt-1">
                        <p className="font-semibold text-light-secondary dark:text-dark-secondary">{name}</p>
                        {status !== 'normal' && (
                            <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                            status === 'warning' 
                            ? 'bg-loss text-white' 
                            : 'bg-yellow-200 dark:bg-yellow-600/50 text-yellow-800 dark:text-yellow-200'
                            }`}>
                            {status === 'warning' ? '경고' : '주의'}
                            </span>
                        )}
                    </div>
                </div>
                {(isBuy || isSell) && (
                    <div className="text-right flex-shrink-0">
                        <p className={`font-bold text-base md:text-lg ${isBuy ? 'text-profit' : 'text-loss'}`}>
                            {isBuy ? `+${sharesToTrade.toLocaleString()}주 더 모으기` : `${sharesToTrade.toLocaleString()}주 덜어내기`}
                        </p>
                    </div>
                )}
            </div>

            {/* Gauge section */}
            {targetShares > 0 && (
                <div className="pt-2">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 relative overflow-hidden">
                        <div 
                            className="h-3 rounded-full bg-light-primary dark:bg-dark-primary transition-width duration-500"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                        ></div>
                        {progress > 100 && (
                            <div 
                                className="absolute top-0 h-3 bg-loss"
                                style={{ left: '100%', width: `calc(${Math.min(progress, 200) - 100}% - 100%)`}}
                            ></div>
                        )}
                    </div>
                    <div className="flex justify-between text-xs font-mono text-light-secondary dark:text-dark-secondary mt-1">
                        <span>0주</span>
                        <span>{targetShares.toLocaleString(undefined, { maximumFractionDigits: 2 })}주 (목표)</span>
                    </div>
                </div>
            )}
            
            {/* Bottom section: Value */}
            <div className="text-right text-sm text-light-secondary dark:text-dark-secondary pt-3 border-t border-dashed border-gray-200/50 dark:border-slate-700/50">
                <p>평가액: {formatCurrency(currentValue)}</p>
            </div>
        </div>
    );
};

const HoldingsStatusScreen: React.FC<HoldingsStatusScreenProps> = ({ trades, stocks, stockPrices, initialPortfolio, alertThresholds }) => {
  const stockMap = useMemo(() => new Map((stocks || []).map(s => [s.id, s])), [stocks]);
  const [isGoodListOpen, setIsGoodListOpen] = useState(false);

  const categorizedHoldings = useMemo(() => {
    const holdingsMap: { [stockId: string]: { quantity: number } } = {};
    (trades || []).forEach(trade => {
      if (!trade || !trade.stockId) return;
      if (!holdingsMap[trade.stockId]) {
        holdingsMap[trade.stockId] = { quantity: 0 };
      }
      const quantity = Number(trade.quantity) || 0;
      if (trade.tradeType === TradeType.Buy) {
        holdingsMap[trade.stockId].quantity += quantity;
      } else {
        holdingsMap[trade.stockId].quantity -= quantity;
      }
    });

    const holdingsWithValue = Object.entries(holdingsMap)
      .filter(([, data]) => data.quantity > 0.00001)
      .map(([stockId, data]) => {
        const stock = stockMap.get(stockId);
        if (!stock || !stock.isPortfolio) return null;

        const currentPrice = stockPrices[stock.ticker] || 0;
        const currentValue = data.quantity * currentPrice;

        return {
          ...stock,
          quantity: data.quantity,
          currentValue,
          currentPrice,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const totalPortfolioValue = holdingsWithValue.reduce((sum, h) => sum + h.currentValue, 0);
    
    if (totalPortfolioValue === 0) {
      return { underTargetList: [], overTargetList: [], onTargetList: [] };
    }
    
    const allPortfolioStocks = holdingsWithValue.map(holding => {
      const currentWeight = (holding.currentValue / totalPortfolioValue) * 100;
      const targetWeight = (initialPortfolio || {})[holding.id] || 0;
      const deviation = currentWeight - targetWeight;
      
      let sharesToTrade = 0;
      let targetShares = 0;
      let status: 'warning' | 'caution' | 'normal' = 'normal';

      if (targetWeight > 0) {
        const disparityRatio = ((currentWeight - targetWeight) / targetWeight) * 100;
        const disparityDeviation = Math.abs(disparityRatio);
        const stockThresh = alertThresholds.stocks[holding.id] || {};
        const warningThreshold = stockThresh.warning ?? alertThresholds.global.warning;
        const cautionThreshold = stockThresh.caution ?? alertThresholds.global.caution;
        
        if (disparityDeviation > warningThreshold) {
          status = 'warning';
        } else if (disparityDeviation > cautionThreshold) {
          status = 'caution';
        }

        const targetValue = totalPortfolioValue * (targetWeight / 100);
        const valueDifference = targetValue - holding.currentValue;

        if (holding.currentPrice > 0) {
            targetShares = targetValue / holding.currentPrice;
            if (valueDifference > 0) { // Buy
                sharesToTrade = Math.ceil(valueDifference / holding.currentPrice);
            } else { // Sell
                sharesToTrade = -Math.floor(Math.abs(valueDifference) / holding.currentPrice);
            }
        }
      } else if (holding.quantity > 0) { // Target is 0% but has shares
          sharesToTrade = -Math.floor(holding.quantity);
          targetShares = 0;
          status = 'warning';
      }
      
      return { ...holding, currentWeight, targetWeight, sharesToTrade, targetShares, status, deviation };
    });

    const underTargetList = allPortfolioStocks.filter(h => h.status !== 'normal' && h.sharesToTrade > 0);
    const overTargetList = allPortfolioStocks.filter(h => h.status !== 'normal' && h.sharesToTrade < 0);
    const onTargetList = allPortfolioStocks.filter(h => h.status === 'normal');

    underTargetList.sort((a,b) => Math.abs(b.deviation) - Math.abs(a.deviation));
    overTargetList.sort((a,b) => Math.abs(b.deviation) - Math.abs(a.deviation));
    onTargetList.sort((a,b) => Math.abs(b.deviation) - Math.abs(a.deviation));

    return { underTargetList, overTargetList, onTargetList };

  }, [trades, stockMap, stockPrices, initialPortfolio, alertThresholds]);
  
  const hasActions = categorizedHoldings.underTargetList.length > 0 || categorizedHoldings.overTargetList.length > 0;
  const hasHoldings = hasActions || categorizedHoldings.onTargetList.length > 0;

  if (!hasHoldings) {
    return (
      <Card>
        <p className="text-center text-light-secondary dark:text-dark-secondary py-8">
          포트폴리오에 포함된 보유 종목이 없습니다.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {!hasActions && (
        <Card>
          <p className="text-center font-semibold text-profit py-8">
            ✅ 모든 포트폴리오 종목이 목표 수량에 가깝게 잘 유지되고 있습니다.
          </p>
        </Card>
      )}

      {categorizedHoldings.underTargetList.length > 0 && (
        <Card title="수량 채우기 🌱 (목표 미달)">
          <div className="space-y-3">
            {categorizedHoldings.underTargetList.map(holding => (
              <HoldingItem key={holding.id} holding={holding} />
            ))}
          </div>
        </Card>
      )}

      {categorizedHoldings.overTargetList.length > 0 && (
        <Card title="덜어내기 ✂️ (목표 초과)">
          <div className="space-y-3">
            {categorizedHoldings.overTargetList.map(holding => (
              <HoldingItem key={holding.id} holding={holding} />
            ))}
          </div>
        </Card>
      )}
      
      {categorizedHoldings.onTargetList.length > 0 && (
         <Card className="p-0 overflow-hidden">
            <details className="group" open={isGoodListOpen}>
                <summary 
                    className="p-4 cursor-pointer font-semibold text-light-text dark:text-dark-text list-none"
                    onClick={(e) => { e.preventDefault(); setIsGoodListOpen(!isGoodListOpen); }}
                >
                    <div className="flex justify-between items-center">
                        <span>잘 자라는 중 ✅ (목표 근접) ({categorizedHoldings.onTargetList.length})</span>
                        <ChevronDownIcon className="w-5 h-5 transition-transform transform group-open:rotate-180" />
                    </div>
                </summary>
                <div className="px-4 pb-4 border-t border-gray-200/80 dark:border-slate-700 space-y-3">
                    {categorizedHoldings.onTargetList.map(holding => (
                        <HoldingItem key={holding.id} holding={holding} />
                    ))}
                </div>
            </details>
        </Card>
      )}
    </div>
  );
};

export default HoldingsStatusScreen;
