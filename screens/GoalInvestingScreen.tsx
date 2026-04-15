import React, { useMemo, useState } from 'react';
import { InvestmentGoal, Trade, Stock, Account, TradeType, AccountTransaction, TransactionType } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { FlagIcon, ChevronDownIcon, ChevronUpIcon, TrophyIcon, ChartBarSquareIcon, SparklesIcon, InformationCircleIcon } from '../components/Icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface GoalInvestingScreenProps {
  investmentGoals: InvestmentGoal[];
  trades: Trade[];
  setTrades: React.Dispatch<React.SetStateAction<Trade[]>>;
  transactions: AccountTransaction[];
  stocks: Stock[];
  stockPrices: { [key: string]: number };
  accounts: Account[];
}

const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(Math.round(value));
const formatNumber = (value: number | string): string => {
  if (value === '' || value === null || value === undefined || Number(value) === 0) return '';
  const num = Number(String(value).replace(/,/g, ''));
  if (isNaN(num)) return '';
  return num.toLocaleString('ko-KR');
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF6347', '#4682B4'];

const SHARE_GOAL_COLORS = [
  { bg: 'bg-blue-50', darkBg: 'dark:bg-blue-900/40', progress: 'bg-blue-500' },
  { bg: 'bg-green-50', darkBg: 'dark:bg-green-900/40', progress: 'bg-green-500' },
  { bg: 'bg-indigo-50', darkBg: 'dark:bg-indigo-900/40', progress: 'bg-indigo-500' },
  { bg: 'bg-purple-50', darkBg: 'dark:bg-purple-900/40', progress: 'bg-purple-500' },
];

/**
 * 시작일을 기준으로 상대적 주차를 계산 (시작일이 포함된 7일간이 1주차)
 */
const getRelativeWeek = (startDateStr: string, tradeDateStr: string): number => {
  const start = new Date(startDateStr);
  start.setHours(0,0,0,0);
  const trade = new Date(tradeDateStr);
  trade.setHours(0,0,0,0);
  
  const diffTime = trade.getTime() - start.getTime();
  if (diffTime < 0) return 1; // 시작일 이전 거래는 1주차로 처리하거나 필터링
  
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
};

const GoalInvestingScreen: React.FC<GoalInvestingScreenProps> = ({
  investmentGoals,
  trades, setTrades,
  transactions,
  stocks,
  stockPrices,
  accounts,
}) => {
  const stockMap = useMemo(() => new Map(stocks.map(s => [s.id, s])), [stocks]);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  
  const [tradeFormState, setTradeFormState] = useState<Omit<Trade, 'id'>>({
    accountId: (accounts || [])[0]?.id || '', date: new Date().toISOString().split('T')[0], stockId: (stocks || [])[0]?.id || '',
    quantity: 0, price: 0, tradeType: TradeType.Buy, tradeMethod: '자동매매', goalId: undefined,
  });

  const toggleGoalExpansion = (goalId: string) => {
    setExpandedGoals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(goalId)) newSet.delete(goalId);
      else newSet.add(goalId);
      return newSet;
    });
  };

  const goalDetails = useMemo(() => {
    return (investmentGoals || []).map(goal => {
      const goalTrades = trades.filter(t => t.goalId === goal.id).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const holdings: { [stockId: string]: { quantity: number, totalCost: number } } = {};
      goalTrades.forEach(trade => {
        if (!holdings[trade.stockId]) holdings[trade.stockId] = { quantity: 0, totalCost: 0 };
        const qty = Number(trade.quantity) || 0;
        const price = Number(trade.price) || 0;
        if (trade.tradeType === TradeType.Buy) {
          holdings[trade.stockId].quantity += qty;
          holdings[trade.stockId].totalCost += qty * price;
        } else {
          const avgCost = holdings[trade.stockId].quantity > 0 ? holdings[trade.stockId].totalCost / holdings[trade.stockId].quantity : 0;
          holdings[trade.stockId].quantity -= qty;
          holdings[trade.stockId].totalCost -= qty * avgCost;
        }
      });
      
      const investedPrincipal = goalTrades.reduce((sum: number, t) => {
        const amount = (Number(t.quantity) || 0) * (Number(t.price) || 0);
        return t.tradeType === TradeType.Buy ? sum + amount : sum - amount;
      }, 0);

      const currentValue = Object.entries(holdings).reduce((sum, [stockId, data]) => {
        const stock = stockMap.get(stockId);
        const price = stock ? stockPrices[stock.ticker] || 0 : 0;
        return sum + (Number(data.quantity) * price);
      }, 0);

      const detailedHoldings = Object.entries(holdings).filter(([, data]) => data.quantity > 0).map(([stockId, data]) => {
        const stock = stockMap.get(stockId);
        const currentPrice = stock ? stockPrices[stock.ticker] || 0 : 0;
        const stockCurrentValue = data.quantity * currentPrice;
        const avgPrice = data.quantity > 0 ? data.totalCost / data.quantity : 0;
        const profitLoss = stockCurrentValue - data.totalCost;
        const pnlRate = data.totalCost > 0 ? (profitLoss / data.totalCost) * 100 : 0;
        return { id: stockId, name: stock?.name || '', quantity: data.quantity, avgPrice, currentValue: stockCurrentValue, profitLoss, pnlRate };
      }).sort((a,b) => b.currentValue - a.currentValue);
      
      const today = new Date();
      today.setHours(0,0,0,0);
      const startDay = goal.creationDate ? new Date(goal.creationDate) : today;
      const daysPassed = Math.max(1, Math.floor((today.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)));
      
      let progress = 0;
      if ((goal.goalType || 'amount') === 'amount' && goal.targetAmount && goal.targetAmount > 0) {
        progress = (currentValue / goal.targetAmount) * 100;
      } else if (goal.goalType === 'shares' && goal.targetShares) {
        const targetValue = Object.entries(goal.targetShares).reduce((sum: number, [stockId, shares]) => {
            const stock = stockMap.get(stockId);
            const price = stock ? stockPrices[stock.ticker] || 0 : 0;
            return sum + (Number(shares) * price);
        }, 0);
        if (targetValue > 0) progress = (currentValue / targetValue) * 100;
      }

      // 주별 매수 현황 데이터 (상대 주차 기준, 매주 순수 매수량)
      const weeklyDataPerStock: { [stockId: string]: { name: string; '매수량': number }[] } = {};
      if (goal.goalType === 'shares' && goalTrades.length > 0) {
        const weeklyNetSharesByStock: { [stockId: string]: { [week: number]: number } } = {};
        
        goalTrades.forEach(trade => {
            const week = getRelativeWeek(goal.creationDate, trade.date);
            if (!weeklyNetSharesByStock[trade.stockId]) weeklyNetSharesByStock[trade.stockId] = {};
            if (!weeklyNetSharesByStock[trade.stockId][week]) weeklyNetSharesByStock[trade.stockId][week] = 0;
            
            const netChange = trade.tradeType === TradeType.Buy ? Number(trade.quantity) : -Number(trade.quantity);
            weeklyNetSharesByStock[trade.stockId][week] += netChange;
        });

        for (const stockId in weeklyNetSharesByStock) {
            const sortedWeeks = Object.keys(weeklyNetSharesByStock[stockId]).map(Number).sort((a, b) => a - b);
            const maxWeek = sortedWeeks.length > 0 ? sortedWeeks[sortedWeeks.length - 1] : 1;
            
            const chartData = [];
            for (let w = 1; w <= maxWeek; w++) {
                chartData.push({
                    name: `${w}주차`,
                    '매수량': weeklyNetSharesByStock[stockId][w] || 0
                });
            }
            weeklyDataPerStock[stockId] = chartData;
        }
      }

      // 달성 가능성 및 필요 속도 분석
      let feasibilityStatus: 'none' | 'achievable' | 'warning' | 'expired' = 'none';
      let feasibilityMsg = '';
      let remainingDays: number | null = null;
      let paceDetails: { stockName: string; remainingQty: number; requiredWeeklyRate: number; currentWeeklyRate: number }[] = [];

      if (goal.goalType === 'shares' && goal.targetShares && goal.targetDate) {
        const targetDay = new Date(goal.targetDate);
        targetDay.setHours(0,0,0,0);
        remainingDays = Math.ceil((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        for (const [stockId, targetQty] of Object.entries(goal.targetShares)) {
            const currentQty = holdings[stockId]?.quantity || 0;
            const targetQtyNum = Number(targetQty);
            const remainingQty = targetQtyNum - currentQty;
            const stock = stockMap.get(stockId);

            if (remainingQty > 0 && stock) {
                const currentDailyRate = currentQty / daysPassed;
                const requiredDailyRate = remainingDays > 0 ? remainingQty / remainingDays : Infinity;
                
                if (remainingDays <= 0) {
                    feasibilityStatus = 'expired';
                } else if (currentDailyRate < requiredDailyRate) {
                    if (feasibilityStatus !== 'expired') feasibilityStatus = 'warning';
                    
                    paceDetails.push({
                        stockName: stock.name,
                        remainingQty,
                        requiredWeeklyRate: requiredDailyRate * 7,
                        currentWeeklyRate: currentDailyRate * 7
                    });
                }
            }
        }

        if (feasibilityStatus === 'none' && remainingDays !== null && remainingDays > 0) feasibilityStatus = 'achievable';

        if (feasibilityStatus === 'achievable') feasibilityMsg = '현재 페이스라면 목표일에 달성 가능합니다! 🚀';
        else if (feasibilityStatus === 'warning') feasibilityMsg = '목표 달성을 위해 매수 속도를 조금 더 높여야 해요! 📈';
        else if (feasibilityStatus === 'expired') feasibilityMsg = '목표 기한이 지났습니다. 목표를 수정하거나 정비해보세요.';
      }

      return { ...goal, currentValue, progress, investedPrincipal, holdings: detailedHoldings, daysPassed, weeklyDataPerStock, feasibilityStatus, feasibilityMsg, remainingDays, paceDetails };
    });
  }, [investmentGoals, trades, transactions, stockPrices, stockMap]);

  const openTradeModal = (goalId: string, stockId: string) => {
    const lastTradeForStock = trades
      .filter(t => t.goalId === goalId && t.stockId === stockId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    
    let initialState = {
      accountId: (accounts || [])[0]?.id || '', date: new Date().toISOString().split('T')[0], stockId: stockId,
      quantity: 0, price: 0, tradeType: TradeType.Buy as TradeType, tradeMethod: '자동매매', goalId
    };

    if (lastTradeForStock) {
      initialState.accountId = lastTradeForStock.accountId;
    }
    setTradeFormState(initialState);
    setIsTradeModalOpen(true);
  };
  
  const handleTradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = Number(tradeFormState.quantity);
    const price = Number(tradeFormState.price);

    if (isNaN(quantity) || isNaN(price) || quantity <= 0 || price <= 0) {
        alert('수량과 단가를 올바르게 입력해주세요.');
        return;
    }
    if (!tradeFormState.accountId || !tradeFormState.stockId) {
        alert('계좌와 종목을 선택해주세요.');
        return;
    }
    setTrades(prev => [{ ...tradeFormState, quantity, price, id: Date.now().toString() }, ...prev]);
    setIsTradeModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {(goalDetails || []).length === 0 ? (
        <Card><p className="text-center py-8 text-light-secondary dark:text-dark-secondary">'설정' &gt; '투자 목표 관리'에서 새 목표를 추가해보세요.</p></Card>
      ) : (
        goalDetails.map(goal => (
          <Card key={goal.id} className="p-0 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-lime-50 to-white dark:from-lime-900/20 dark:to-dark-card border-b border-gray-100 dark:border-slate-800">
              <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <FlagIcon className="w-6 h-6 text-lime-500" /><span>{goal.name}</span>
                    </h2>
                    <p className="text-xs text-light-secondary dark:text-dark-secondary mt-1">
                        {goal.creationDate} 시작 &middot; {goal.daysPassed}일 경과
                        {goal.targetDate && <span className="ml-2">&middot; 목표일: {goal.targetDate}</span>}
                    </p>
                  </div>
                  {goal.targetDate && goal.remainingDays !== null && (
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${goal.remainingDays >= 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                        {goal.remainingDays >= 0 ? `D-${goal.remainingDays}` : `기한 종료`}
                    </div>
                  )}
              </div>
              
              {goal.feasibilityStatus !== 'none' && (
                <div className={`mt-3 p-3 rounded-lg flex flex-col gap-2 text-sm font-medium ${
                    goal.feasibilityStatus === 'achievable' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' : 
                    goal.feasibilityStatus === 'warning' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200' : 
                    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                }`}>
                    <div className="flex items-center gap-2">
                        {goal.feasibilityStatus === 'achievable' ? <SparklesIcon className="w-5 h-5" /> : <InformationCircleIcon className="w-5 h-5" />}
                        <span>{goal.feasibilityMsg}</span>
                    </div>
                    
                    {goal.feasibilityStatus === 'warning' && goal.paceDetails.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-orange-200 dark:border-orange-700/50 space-y-1.5">
                            <p className="text-xs opacity-80 mb-1 font-bold">목표 달성을 위한 권장 매수 속도:</p>
                            {goal.paceDetails.map(detail => (
                                <div key={detail.stockName} className="flex justify-between items-center text-xs">
                                    <span className="font-semibold">{detail.stockName}</span>
                                    <span className="text-right">
                                        매주 <b className="text-orange-600 dark:text-orange-400">{detail.requiredWeeklyRate.toFixed(2)}주</b> 매수 필요 
                                        <span className="ml-1 opacity-70">(현재 {detail.currentWeeklyRate.toFixed(2)}주/주)</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
              )}
            </div>
            
            <div className="px-4 pb-4 space-y-4 mt-4">
            {goal.goalType === 'shares' && goal.targetShares ? (
              <>
                <div className="space-y-4">
                  {Object.entries(goal.targetShares).map(([stockId, targetQty], index) => {
                    const holding = goal.holdings.find(h => h.id === stockId);
                    const currentQty = holding?.quantity || 0;
                    const stock = stockMap.get(stockId);
                    const targetQtyNum = targetQty as number;
                    const stockProgress = targetQtyNum > 0 ? (currentQty / targetQtyNum) * 100 : 0;
                    const colors = SHARE_GOAL_COLORS[index % SHARE_GOAL_COLORS.length];
                    const weeklyData = goal.weeklyDataPerStock[stockId];
                    if (!stock) return null;
                    return (
                      <div key={stockId} className={`p-4 ${colors.bg} ${colors.darkBg} rounded-xl space-y-3 shadow-inner`}>
                        <div className="flex justify-between items-center">
                            <p className="font-bold text-lg text-light-text dark:text-dark-text">{stock.name}</p>
                            <TrophyIcon className={`w-6 h-6 transition-colors ${stockProgress >= 100 ? 'text-amber-400' : 'text-gray-400 dark:text-gray-600'}`} />
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative">
                            <div className={`h-6 rounded-full text-center text-white text-xs font-bold leading-6 transition-all duration-500 ${stockProgress >= 100 ? 'bg-amber-500' : colors.progress}`} style={{ width: `${Math.min(stockProgress, 100)}%` }}>{stockProgress.toFixed(1)}%</div>
                        </div>
                        <div className="text-right font-mono text-light-secondary dark:text-dark-secondary">{currentQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} / {targetQtyNum.toLocaleString()} 주</div>
                        
                        {weeklyData && weeklyData.length > 0 && (
                          <div className="pt-4 mt-4 border-t border-gray-300/50 dark:border-slate-600/50">
                              <h4 className="font-semibold text-center mb-2 flex items-center justify-center gap-2 text-sm">
                                  <ChartBarSquareIcon className="w-5 h-5" />주차별 매수 현황
                              </h4>
                              <ResponsiveContainer width="100%" height={150}>
                                  <BarChart data={weeklyData} margin={{ top: 20, right: 0, left: -20, bottom: 5 }}>
                                      <CartesianGrid strokeDasharray="3 3" opacity={0.5} />
                                      <XAxis dataKey="name" fontSize={10} />
                                      <YAxis fontSize={10} />
                                      <Tooltip formatter={(value) => [`${Number(value).toLocaleString()}주`, '매수량']} />
                                      <Bar dataKey="매수량" fill={COLORS[index % COLORS.length]} />
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>
                        )}
                        <div className="flex justify-end pt-2">
                           <Button onClick={() => openTradeModal(goal.id, stockId)} variant="secondary" className="text-sm px-3 py-1.5">간편 기록</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1"><span className="font-medium">달성률</span><span className="font-semibold">{goal.progress.toFixed(1)}%</span></div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4"><div className="bg-lime-500 h-4 rounded-full" style={{ width: `${Math.min(Number(goal.progress), 100)}%` }}></div></div>
                  <div className="flex justify-between text-xs mt-1 text-light-secondary dark:text-dark-secondary"><span>{formatCurrency(goal.currentValue)}</span><span>{formatCurrency(goal.targetAmount || 0)}</span></div>
                </div>
                 <div className="px-4 pb-4"><div className="flex justify-end gap-2 mt-2 pt-4 border-t border-gray-200/50 dark:border-slate-700/50"><Button onClick={() => openTradeModal(goal.id, stocks[0]?.id)} variant="secondary" className="text-sm px-3 py-2">간편 기록</Button></div></div>
              </>
            )}
            </div>
            
            <div className="px-4 py-2 bg-gray-50 dark:bg-dark-bg/30 text-center text-sm font-semibold cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-bg/50" onClick={() => toggleGoalExpansion(goal.id)}>
              <div className="flex items-center justify-center gap-2"><span>상세 현황 보기</span>{expandedGoals.has(goal.id) ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}</div>
            </div>
            {expandedGoals.has(goal.id) && (
              <div className="p-4 border-t border-gray-200/50 dark:border-slate-700/50 space-y-4">
                  <div className="p-3 bg-light-bg dark:bg-dark-bg/50 rounded-lg space-y-1 text-sm">
                      <div className="flex justify-between"><span>현재 평가액:</span> <span className="font-semibold text-light-primary dark:text-dark-primary">{formatCurrency(goal.currentValue)}</span></div>
                      <div className="flex justify-between"><span>투입 원금:</span> <span>{formatCurrency(goal.investedPrincipal)}</span></div>
                      <div className="flex justify-between"><span>수익:</span> <span className={`font-semibold ${goal.currentValue - goal.investedPrincipal >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(goal.currentValue - goal.investedPrincipal)}</span></div>
                  </div>
                <h4 className="font-semibold text-center pt-2">보유 종목 현황</h4>
                {goal.holdings.length === 0 ? <p className="text-center text-sm text-light-secondary dark:text-dark-secondary">보유 종목이 없습니다.</p> :
                  goal.holdings.map(h => (
                    <div key={h.id} className="p-3 bg-light-bg dark:bg-dark-bg/50 rounded-lg">
                      <div className="flex justify-between items-start"><p className="font-bold">{h.name}</p><div className="text-right"><p className={`font-semibold ${h.profitLoss >= 0 ? 'text-profit' : 'text-loss'}`}>{h.pnlRate.toFixed(2)}%</p><p className={`text-xs ${h.profitLoss >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(h.profitLoss)}</p></div></div>
                      <div className="text-sm text-light-secondary dark:text-dark-secondary mt-2 space-y-1">
                        <div className="flex justify-between"><span>평가액:</span> <span className="font-medium text-light-text dark:text-dark-text">{formatCurrency(h.currentValue)}</span></div>
                        <div className="flex justify-between"><span>보유 수량:</span> <span>{h.quantity.toLocaleString(undefined, {maximumFractionDigits: 4})} 주</span></div>
                        <div className="flex justify-between"><span>평단가:</span> <span>{formatCurrency(h.avgPrice)}</span></div>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
          </Card>
        ))
      )}

      <Modal isOpen={isTradeModalOpen} onClose={() => setIsTradeModalOpen(false)} title="목표 매매기록 추가">
        <form onSubmit={handleTradeSubmit} className="space-y-4">
          <Input label="일자" name="date" type="date" value={tradeFormState.date} onChange={e => setTradeFormState(p => ({...p, date: e.target.value}))} required />
          <Select label="계좌" name="accountId" value={tradeFormState.accountId} onChange={e => setTradeFormState(p => ({...p, accountId: e.target.value}))} required>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
          <Select label="종목" name="stockId" value={tradeFormState.stockId} onChange={e => setTradeFormState(p => ({...p, stockId: e.target.value}))} required>{stocks.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <Input label="수량" name="quantity" type="text" inputMode="numeric" value={formatNumber(tradeFormState.quantity)} onChange={e => setTradeFormState(p => ({...p, quantity: parseFloat(e.target.value.replace(/,/g, '')) || 0}))} required />
          <Input label="단가" name="price" type="text" inputMode="numeric" value={formatNumber(tradeFormState.price)} onChange={e => setTradeFormState(p => ({...p, price: parseFloat(e.target.value.replace(/,/g, '')) || 0}))} required />
          <Select label="매매구분" name="tradeType" value={tradeFormState.tradeType} onChange={e => setTradeFormState(p => ({...p, tradeType: e.target.value as TradeType}))} required><option value={TradeType.Buy}>매수</option><option value={TradeType.Sell}>매도</option></Select>
          <Select label="매매방법" name="tradeMethod" value={tradeFormState.tradeMethod} onChange={e => setTradeFormState(p => ({...p, tradeMethod: e.target.value}))} required><option value="직접매매">직접매매</option><option value="자동매매">자동매매</option></Select>
          <div className="flex justify-end pt-4"><Button type="submit">기록</Button></div>
        </form>
      </Modal>

    </div>
  );
};

export default GoalInvestingScreen;