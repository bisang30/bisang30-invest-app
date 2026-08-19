

import React, { useMemo, useState } from 'react';
import Card from '../components/ui/Card';
import { Trade, Stock, TradeType, InitialPortfolio, PortfolioCategory, FeeSettings, Account, Broker, AccountTransaction, TransactionType, HistoricalGain } from '../types';
import { PORTFOLIO_CATEGORIES } from '../constants';
import { ChevronDownIcon, ChevronUpIcon, BanknotesIcon, CircleStackIcon, ChartBarIcon, CurrencyWonIcon, ChartLineIcon } from '../components/Icons';
import { normalizeCategory } from './IndexScreen';
import { calculateAccountCashBalance } from '../services/feeService';

interface StockStatusScreenProps {
  trades: Trade[];
  stocks: Stock[];
  stockPrices: { [key: string]: number };
  initialPortfolio: InitialPortfolio;
  feeSettings?: FeeSettings;
  totalCashBalance?: number;
  accounts?: Account[];
  brokers?: Broker[];
  transactions?: AccountTransaction[];
  historicalGains?: HistoricalGain[];
}

const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);

const categoryVisuals: Record<PortfolioCategory, { icon: React.ComponentType<{ className: string }>, color: string, bgColor: string, darkBgColor: string }> = {
  [PortfolioCategory.Cash]: { icon: BanknotesIcon, color: 'text-blue-500 dark:text-blue-400', bgColor: 'bg-blue-100', darkBgColor: 'dark:bg-blue-900/50' },
  [PortfolioCategory.Alternatives]: { icon: CircleStackIcon, color: 'text-green-500 dark:text-green-400', bgColor: 'bg-green-100', darkBgColor: 'dark:bg-green-900/50' },
  [PortfolioCategory.Stock]: { icon: ChartLineIcon, color: 'text-purple-500 dark:text-purple-400', bgColor: 'bg-purple-100', darkBgColor: 'dark:bg-purple-900/50' },
};

const StockStatusScreen: React.FC<StockStatusScreenProps> = ({ 
  trades, stocks, stockPrices, initialPortfolio, feeSettings, totalCashBalance = 0,
  accounts, brokers, transactions, historicalGains
}) => {
  const stockMap = useMemo(() => new Map((stocks || []).map(s => [s.id, s])), [stocks]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showCashAccountDetails, setShowCashAccountDetails] = useState(false);

  const accountCashBalances = useMemo(() => {
    if (!accounts || accounts.length === 0) return [];
    const brokerMap = new Map((brokers || []).map(b => [b.id, b.name]));

    return accounts.map(account => {
      const cashBalance = calculateAccountCashBalance(
        account,
        trades,
        transactions,
        historicalGains,
        feeSettings,
        stockMap
      );

      return {
        id: account.id,
        name: account.name,
        brokerName: brokerMap.get(account.brokerId) || '기타',
        accountType: account.accountType,
        cashBalance,
      };
    }).sort((a, b) => b.cashBalance - a.cashBalance);
  }, [accounts, brokers, trades, transactions, historicalGains, feeSettings, stockMap]);

  const effectiveCashBalance = useMemo(() => {
    if (accounts && accounts.length > 0) {
      return accountCashBalances.reduce((sum, a) => sum + a.cashBalance, 0);
    }
    return totalCashBalance;
  }, [accounts, accountCashBalances, totalCashBalance]);

  const holdingsByCategory = useMemo(() => {
    const holdingsMap: { [stockId: string]: { quantity: number; totalCost: number } } = {};
    const order = feeSettings?.sameDayTradeOrder || 'sellFirst';

    // Critical fix: Sort trades by date and type/order to ensure correct calculation of quantity and average cost.
    [...(trades || [])]
      .sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        if (order === 'inputOrder') {
          return (a.id || '').localeCompare(b.id || '');
        }
        if (a.tradeType !== b.tradeType) {
          if (order === 'buyFirst') {
            return a.tradeType === TradeType.Buy ? -1 : 1;
          } else {
            return a.tradeType === TradeType.Sell ? -1 : 1;
          }
        }
        return (a.id || '').localeCompare(b.id || '');
      })
      .forEach(trade => {
        if (!trade || !trade.stockId) return;

        if (!holdingsMap[trade.stockId]) {
          holdingsMap[trade.stockId] = { quantity: 0, totalCost: 0 };
        }

        const quantity = Number(trade.quantity) || 0;
        const price = Number(trade.price) || 0;

        if (trade.tradeType === TradeType.Buy) {
          holdingsMap[trade.stockId].quantity += quantity;
          holdingsMap[trade.stockId].totalCost += quantity * price;
        } else {
          const avgCost = holdingsMap[trade.stockId].quantity > 0 ? holdingsMap[trade.stockId].totalCost / holdingsMap[trade.stockId].quantity : 0;
          holdingsMap[trade.stockId].quantity -= quantity;
          holdingsMap[trade.stockId].totalCost -= quantity * avgCost;
          if (holdingsMap[trade.stockId].quantity < 1e-9) {
              holdingsMap[trade.stockId].quantity = 0;
              holdingsMap[trade.stockId].totalCost = 0;
          }
        }
    });

    const holdingsWithValues = Object.entries(holdingsMap)
      .filter(([, data]) => data.quantity > 0.00001)
      .map(([stockId, data]) => {
        const stock = stockMap.get(stockId);
        if (!stock || stock.id === 'stock-cash-balance' || stock.ticker === 'CASH') return null;

        const avgPrice = data.quantity > 0 ? data.totalCost / data.quantity : 0;
        const currentPrice = stockPrices[stock.ticker] || 0;
        const currentValue = data.quantity * currentPrice;
        const profitLoss = currentValue - data.totalCost;
        const profitLossRate = data.totalCost > 0 ? (profitLoss / data.totalCost) * 100 : 0;

        return {
          ...stock,
          category: normalizeCategory(stock.category),
          ...data,
          avgPrice,
          currentPrice,
          currentValue,
          profitLoss,
          profitLossRate,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // Include cash deposit (예수금) in holdings
    const cashStock = (stocks || []).find(s => s.id === 'stock-cash-balance' || s.ticker === 'CASH');
    const cashTargetWeight = (initialPortfolio || {})[cashStock?.id || 'stock-cash-balance'] || (initialPortfolio || {})['CASH'] || 0;

    if (effectiveCashBalance !== 0 || cashTargetWeight > 0 || holdingsWithValues.length === 0) {
      holdingsWithValues.push({
        id: cashStock?.id || 'stock-cash-balance',
        ticker: cashStock?.ticker || 'CASH',
        name: cashStock?.name || '예수금 (원화/외화)',
        category: PortfolioCategory.Cash,
        isPortfolio: true,
        isEtf: false,
        country: '한국',
        stockStrategy: '현금',
        quantity: 1,
        totalCost: effectiveCashBalance,
        avgPrice: effectiveCashBalance,
        currentPrice: effectiveCashBalance,
        currentValue: effectiveCashBalance,
        profitLoss: 0,
        profitLossRate: 0,
      } as any);
    }

    const totalPortfolioValue = holdingsWithValues.reduce((sum, h) => sum + h.currentValue, 0);

    const holdingsWithWeight = holdingsWithValues.map(holding => {
      const currentWeight = totalPortfolioValue > 0 ? (holding.currentValue / totalPortfolioValue) * 100 : 0;
      const targetWeight = (initialPortfolio || {})[holding.id] || 0;
      const deviation = currentWeight - targetWeight;
      const disparityRatio = targetWeight > 0 ? ((currentWeight - targetWeight) / targetWeight) * 100 : (currentWeight > 0 ? Infinity : 0);
      return { ...holding, currentWeight, targetWeight, deviation, disparityRatio };
    });

    const grouped: { [key in PortfolioCategory]?: { totalValue: number, totalWeight: number, stocks: typeof holdingsWithWeight } } = {};
    
    holdingsWithWeight.forEach(stock => {
      const category = normalizeCategory(stock.category);
      if (!grouped[category]) {
        grouped[category] = { totalValue: 0, totalWeight: 0, stocks: [] };
      }
      grouped[category]!.totalValue += stock.currentValue;
      grouped[category]!.totalWeight += stock.currentWeight;
      grouped[category]!.stocks.push(stock);
    });
    
    for(const category in grouped){
        grouped[category as PortfolioCategory]!.stocks.sort((a,b) => b.currentValue - a.currentValue);
    }

    const CATEGORY_ORDER = [
      PortfolioCategory.Cash,
      PortfolioCategory.Alternatives,
      PortfolioCategory.Stock,
    ];

    return CATEGORY_ORDER
        .map(category => ({ category, data: grouped[category] }))
        .filter(item => item.data);

  }, [trades, stockMap, stockPrices, initialPortfolio, totalCashBalance, stocks, feeSettings]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
        const newSet = new Set(prev);
        if (newSet.has(category)) {
            newSet.delete(category);
        } else {
            newSet.add(category);
        }
        return newSet;
    });
  };

  return (
    <div className="space-y-4">
      {holdingsByCategory.length === 0 ? (
        <Card>
          <p className="text-center text-light-secondary dark:text-dark-secondary py-8">보유 중인 종목이 없습니다.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {holdingsByCategory.map(({ category, data }) => {
            if (!data) return null;
            const isExpanded = expandedCategories.has(category);
            const visual = categoryVisuals[category as PortfolioCategory];
            const Icon = visual?.icon;

            return (
                <Card key={category} className="p-0 overflow-hidden">
                    <div 
                        className="p-4 cursor-pointer flex justify-between items-center hover:bg-gray-50 dark:hover:bg-slate-800/50"
                        onClick={() => toggleCategory(category)}
                        aria-expanded={isExpanded}
                        aria-controls={`category-content-${category}`}
                    >
                        <div className="flex items-center gap-4">
                            {Icon && (
                                <div className={`p-3 rounded-lg ${visual.bgColor} ${visual.darkBgColor}`}>
                                    <Icon className={`w-6 h-6 ${visual.color}`} />
                                </div>
                            )}
                            <div>
                                <h2 className="text-xl font-bold text-light-text dark:text-dark-text">
                                  {category === PortfolioCategory.Cash ? '현금성 (현금형)' : category}
                                </h2>
                                <p className="text-sm text-light-secondary dark:text-dark-secondary">
                                    평가금액: {formatCurrency(data.totalValue)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center">
                            <span className="text-lg font-bold text-light-primary dark:text-dark-primary mr-4">{data.totalWeight.toFixed(2)}%</span>
                            {isExpanded ? <ChevronUpIcon className="w-6 h-6"/> : <ChevronDownIcon className="w-6 h-6"/>}
                        </div>
                    </div>
                    {isExpanded && (
                        <div id={`category-content-${category}`} className="px-4 pb-4 space-y-3 border-t border-gray-200/80 dark:border-slate-700">
                           {data.stocks.map((holding) => {
                                const isCashItem = holding.ticker === 'CASH' || holding.id === 'stock-cash-balance';
                                return (
                                <div key={holding.id} className="p-4 space-y-3 bg-light-bg dark:bg-dark-bg/50 rounded-lg mt-3">
                                  <div className="flex flex-col sm:flex-row justify-between sm:items-start">
                                    <div className="flex-1 pr-2">
                                      <div className="flex items-baseline flex-wrap">
                                          <h3 className="text-lg font-bold text-light-text dark:text-dark-text mr-2">{holding.name}</h3>
                                          {isCashItem ? (
                                            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-1.5 py-px rounded-full mr-2">
                                                예수금
                                            </span>
                                          ) : holding.isEtf && (
                                            <span className="text-[11px] font-semibold text-gray-700 dark:text-slate-300 bg-gray-200 dark:bg-slate-700 px-1.5 py-px rounded-full mr-2">
                                                ETF
                                            </span>
                                          )}
                                          <p className="text-xs text-light-secondary dark:text-dark-secondary">
                                              {holding.ticker}
                                              {holding.isEtf && holding.expenseRatio !== undefined && (
                                                <span className="ml-1.5">({holding.expenseRatio.toFixed(3)}%)</span>
                                              )}
                                          </p>
                                      </div>
                                      {isCashItem ? (
                                        <p className="text-sm text-light-secondary dark:text-dark-secondary mt-1">
                                            계좌 예수금 (원화/외화)
                                        </p>
                                      ) : (
                                        <p className="text-sm text-light-secondary dark:text-dark-secondary mt-1">
                                            수량: {holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                            <span className="mx-1.5">·</span>
                                            평단가: {formatCurrency(holding.avgPrice)}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right flex-shrink-0 mt-2 sm:mt-0 sm:ml-2">
                                      {isCashItem ? (
                                        <button 
                                          onClick={() => setShowCashAccountDetails(prev => !prev)}
                                          className="text-right flex flex-col items-end group focus:outline-none cursor-pointer"
                                          title="클릭하여 계좌별 예수금 상세 보기"
                                        >
                                          <div className="text-xl font-bold text-light-primary dark:text-dark-primary group-hover:underline flex items-center gap-1">
                                            {formatCurrency(holding.currentValue)}
                                            {showCashAccountDetails ? <ChevronUpIcon className="w-4 h-4 text-light-secondary dark:text-dark-secondary" /> : <ChevronDownIcon className="w-4 h-4 text-light-secondary dark:text-dark-secondary" />}
                                          </div>
                                          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                            {showCashAccountDetails ? '계좌별 상세보기 닫기' : '계좌별 잔액 보기 ▾'}
                                          </span>
                                        </button>
                                      ) : (
                                        <>
                                          <div className={`text-xl font-bold ${holding.profitLoss >= 0 ? 'text-profit' : 'text-loss'}`}>
                                              {holding.profitLossRate.toFixed(2)}%
                                          </div>
                                          <div className={`text-sm ${holding.profitLoss >= 0 ? 'text-profit' : 'text-loss'}`}>
                                              {formatCurrency(holding.profitLoss)}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <div className="pt-3 border-t border-gray-200/50 dark:border-slate-700/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <div>
                                          <span className="text-xs text-light-secondary dark:text-dark-secondary">평가금액</span>
                                          <p 
                                            onClick={() => isCashItem && setShowCashAccountDetails(prev => !prev)}
                                            className={`text-lg font-bold text-light-primary dark:text-dark-primary ${isCashItem ? 'cursor-pointer hover:underline' : ''}`}
                                          >
                                            {formatCurrency(holding.currentValue)}
                                          </p>
                                        </div>
                                        {isCashItem ? (
                                          <button
                                            onClick={() => setShowCashAccountDetails(prev => !prev)}
                                            className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors flex items-center gap-1 cursor-pointer"
                                          >
                                            <span>계좌별 예수금</span>
                                            {showCashAccountDetails ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
                                          </button>
                                        ) : (
                                          <div className="text-right">
                                            <span className="text-xs text-light-secondary dark:text-dark-secondary">현재가</span>
                                            <p className="text-base font-semibold text-light-text dark:text-dark-text">{formatCurrency(holding.currentPrice)}</p>
                                          </div>
                                        )}
                                    </div>

                                    {isCashItem && showCashAccountDetails && (
                                      <div className="mt-3 pt-3 border-t border-dashed border-blue-200 dark:border-blue-800/80 bg-blue-50/50 dark:bg-blue-950/30 -mx-4 -mb-3 p-4 rounded-b-lg space-y-2">
                                        <div className="flex justify-between items-center mb-2">
                                          <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1">
                                            <BanknotesIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                            계좌별 예수금 상세 ({accountCashBalances.length}개 계좌)
                                          </span>
                                          <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                                            합계: {formatCurrency(holding.currentValue)}
                                          </span>
                                        </div>
                                        {accountCashBalances.length === 0 ? (
                                          <p className="text-xs text-light-secondary dark:text-dark-secondary py-1">등록된 증권 계좌가 없습니다.</p>
                                        ) : (
                                          <div className="space-y-1.5">
                                            {accountCashBalances.map(acc => {
                                              const ratio = holding.currentValue > 0 ? Math.max(0, (acc.cashBalance / holding.currentValue) * 100) : 0;
                                              return (
                                                <div key={acc.id} className="flex justify-between items-center text-xs p-2.5 bg-white dark:bg-slate-800/80 rounded-lg border border-blue-100 dark:border-slate-700/80 shadow-xs">
                                                  <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-bold text-gray-800 dark:text-slate-200">{acc.name}</span>
                                                    <span className="text-[10px] text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                                      {acc.brokerName}{acc.accountType ? ` · ${acc.accountType}` : ''}
                                                    </span>
                                                  </div>
                                                  <div className="text-right">
                                                    <span className={`font-bold ${acc.cashBalance < 0 ? 'text-loss' : 'text-gray-900 dark:text-slate-100'}`}>
                                                      {formatCurrency(acc.cashBalance)}
                                                    </span>
                                                    <span className="text-[10px] text-light-secondary dark:text-dark-secondary ml-1.5">
                                                      ({ratio.toFixed(1)}%)
                                                    </span>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {holding.isPortfolio && (
                                      <div className="mt-2">
                                        <div className="flex justify-between text-sm mb-1 flex-wrap">
                                            <span className="font-medium">현재 비중: {holding.currentWeight.toFixed(2)}%</span>
                                            <span className="text-light-secondary dark:text-dark-secondary">
                                              목표: {holding.targetWeight.toFixed(2)}%
                                              <span className={`ml-2 font-semibold ${holding.deviation >= 0 ? 'text-profit' : 'text-loss'}`}>
                                                (편차: {holding.deviation > 0 ? '+' : ''}{holding.deviation.toFixed(2)}%p, 이격률: {holding.disparityRatio > 0 ? '+' : ''}{holding.disparityRatio.toFixed(1)}%)
                                              </span>
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 relative">
                                            <div className="bg-light-primary dark:bg-dark-primary h-2.5 rounded-full" style={{ width: `${holding.currentWeight}%` }}></div>
                                            {holding.targetWeight > 0 &&
                                                <div 
                                                    title={`목표: ${holding.targetWeight.toFixed(2)}%`}
                                                    className="absolute top-[-2px] h-4 w-1 bg-red-500 rounded-sm" 
                                                    style={{ left: `calc(${holding.targetWeight}% - 2px)` }}
                                                ></div>
                                            }
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                    )}
                </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StockStatusScreen;