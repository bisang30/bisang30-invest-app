import React, { useState, useMemo, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { Trade, TradeType, Account, Stock, InvestmentGoal, FeeSettings } from '../types';
import { ArrowDownCircleIcon, ArrowUpCircleIcon, Cog8ToothIcon, CalendarDaysIcon } from '../components/Icons';
import { calculateTradeFeeAndTax } from '../services/feeService';

interface TradeHistoryScreenProps {
  trades: Trade[];
  setTrades: React.Dispatch<React.SetStateAction<Trade[]>>;
  accounts: Account[];
  stocks: Stock[];
  investmentGoals: InvestmentGoal[];
  feeSettings: FeeSettings;
}

interface TradeWithPL extends Trade {
  avgBuyPrice?: number;
  realizedPL?: number;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);

const formatNumber = (value: number | string): string => {
  if (value === '' || value === null || value === undefined || Number(value) === 0) return '';
  const num = Number(String(value).replace(/,/g, ''));
  if (isNaN(num)) return '';
  return num.toLocaleString('ko-KR');
};

const TradeHistoryScreen: React.FC<TradeHistoryScreenProps> = ({ trades, setTrades, accounts, stocks, investmentGoals, feeSettings }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [isFeeAndTaxManual, setIsFeeAndTaxManual] = useState(false);
  const [formState, setFormState] = useState<Omit<Trade, 'id'>>({
    accountId: (accounts || [])[0]?.id || '',
    date: new Date().toISOString().split('T')[0],
    stockId: (stocks || [])[0]?.id || '',
    quantity: 0,
    price: 0,
    tradeType: TradeType.Buy,
    tradeMethod: '직접매매',
    goalId: undefined,
    customFeeAndTax: undefined,
  });
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [tradeToDelete, setTradeToDelete] = useState<Trade | null>(null);

  const [filters, setFilters] = useState({
    year: 'all',
    month: 'all',
    accountId: 'all',
    stockId: 'all',
    tradeType: 'all',
  });

  const stockMap = useMemo(() => new Map<string, Stock>((stocks || []).map(s => [s.id, s])), [stocks]);
  const accountMap = useMemo(() => new Map<string, Account>((accounts || []).map(a => [a.id, a])), [accounts]);

  // 거래의 수수료/세금을 계산하는 헬퍼 함수
  const getTradeFeeAndTaxAmount = (trade: Trade) => {
    if (trade.customFeeAndTax !== undefined && trade.customFeeAndTax !== null) {
      return trade.customFeeAndTax;
    }
    const stock = stockMap.get(trade.stockId);
    const account = accountMap.get(trade.accountId);
    const calc = calculateTradeFeeAndTax(trade, stock, account, feeSettings);
    return calc.fee + calc.tax;
  };

  // 실시간 예상 제비용 자동 계산
  useEffect(() => {
    if (isFeeAndTaxManual) return;
    if (!formState.stockId || !formState.accountId) return;

    const stock = stockMap.get(formState.stockId);
    const account = accountMap.get(formState.accountId);

    const tempTrade = {
      tradeType: formState.tradeType,
      quantity: formState.quantity,
      price: formState.price,
    };
    
    const calc = calculateTradeFeeAndTax(tempTrade, stock, account, feeSettings);
    const expectedFeeAndTax = Math.round(calc.fee + calc.tax); // 원 단위 반올림

    setFormState(prev => ({
      ...prev,
      customFeeAndTax: expectedFeeAndTax,
    }));
  }, [
    formState.quantity,
    formState.price,
    formState.tradeType,
    formState.stockId,
    formState.accountId,
    isFeeAndTaxManual,
    feeSettings,
    stockMap,
    accountMap,
  ]);
  
  const tradesWithPL = useMemo((): TradeWithPL[] => {
    const holdings: { [stockId: string]: { quantity: number; totalCost: number } } = {};
    const sortedTrades = [...(trades || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return sortedTrades.map(trade => {
        if (!trade.stockId) return trade;
        if (!holdings[trade.stockId]) {
            holdings[trade.stockId] = { quantity: 0, totalCost: 0 };
        }

        const tradeQuantity = Number(trade.quantity) || 0;
        const tradePrice = Number(trade.price) || 0;

        if (trade.tradeType === TradeType.Buy) {
            holdings[trade.stockId].quantity += tradeQuantity;
            holdings[trade.stockId].totalCost += tradeQuantity * tradePrice;
            return trade;
        } else { // SELL
            const currentHolding = holdings[trade.stockId];
            if (currentHolding.quantity > 0) {
                const avgBuyPrice = currentHolding.totalCost / currentHolding.quantity;
                const realizedPL = (tradePrice - avgBuyPrice) * tradeQuantity;
                
                const costOfSoldShares = avgBuyPrice * Math.min(tradeQuantity, currentHolding.quantity);
                holdings[trade.stockId].totalCost -= costOfSoldShares;
                holdings[trade.stockId].quantity -= tradeQuantity;

                if (holdings[trade.stockId].quantity < 1e-9) {
                    holdings[trade.stockId].quantity = 0;
                    holdings[trade.stockId].totalCost = 0;
                }

                return { ...trade, avgBuyPrice, realizedPL };
            }
            return trade;
        }
    });
  }, [trades]);

  const filterOptions = useMemo(() => {
    const years = new Set<string>();
    const accountIds = new Set<string>();
    const stockIds = new Set<string>();

    (trades || []).forEach(t => {
      years.add(new Date(t.date).getFullYear().toString());
      if (t.accountId) accountIds.add(t.accountId);
      if (t.stockId) stockIds.add(t.stockId);
    });

    return {
      years: Array.from(years).sort((a, b) => b.localeCompare(a)),
      months: Array.from({ length: 12 }, (_, i) => (i + 1).toString()),
      accounts: Array.from(accountIds).map(id => ({ id, name: accountMap.get(id)?.name || '알 수 없는 계좌' })),
      stocks: Array.from(stockIds).map(id => ({ id, name: stockMap.get(id)?.name || '알 수 없는 종목' })),
    };
  }, [trades, accountMap, stockMap]);

  const groupedAndFilteredTrades = useMemo(() => {
    let filteredItems = tradesWithPL.filter(t => {
      const date = new Date(t.date);
      if (filters.year !== 'all' && date.getFullYear().toString() !== filters.year) return false;
      if (filters.month !== 'all' && (date.getMonth() + 1).toString() !== filters.month) return false;
      if (filters.accountId !== 'all' && t.accountId !== filters.accountId) return false;
      if (filters.stockId !== 'all' && t.stockId !== filters.stockId) return false;
      if (filters.tradeType !== 'all' && t.tradeType !== filters.tradeType) return false;
      return true;
    });
    
    filteredItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // FIX: Replaced `reduce` with a `forEach` loop to build the grouped object.
    // This avoids potential type inference issues with the `reduce` accumulator,
    // ensuring `tradesOnDate` has the correct `TradeWithPL[]` type.
    const grouped: Record<string, TradeWithPL[]> = {};
    filteredItems.forEach((trade) => {
      const date = trade.date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(trade);
    });
    return grouped;

  }, [tradesWithPL, filters]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  
  const isFilterActive = useMemo(() => Object.values(filters).some(v => v !== 'all'), [filters]);

  const resetFilters = () => {
    setFilters({
      year: 'all',
      month: 'all',
      accountId: 'all',
      stockId: 'all',
      tradeType: 'all',
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'quantity' || name === 'price') {
      const numValue = parseFloat(value.replace(/,/g, ''));
      setFormState(prev => ({ ...prev, [name]: isNaN(numValue) ? 0 : numValue }));
    } else if (name === 'goalId') {
      setFormState(prev => ({ ...prev, goalId: value === '' ? undefined : value }));
    }
    else {
      setFormState(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFeeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numValue = parseFloat(value.replace(/,/g, ''));
    setIsFeeAndTaxManual(true);
    setFormState(prev => ({ ...prev, customFeeAndTax: isNaN(numValue) ? 0 : numValue }));
  };
  
  const handleAddClick = () => {
    setEditingTrade(null);
    setIsFeeAndTaxManual(false);
    setFormState({
      accountId: (accounts || [])[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      stockId: (stocks || [])[0]?.id || '',
      quantity: 0,
      price: 0,
      tradeType: TradeType.Buy,
      tradeMethod: '직접매매',
      goalId: undefined,
      customFeeAndTax: undefined,
    });
    setIsModalOpen(true);
  };

  const handleEditClick = (trade: Trade) => {
    setEditingTrade(trade);
    const hasCustomFee = trade.customFeeAndTax !== undefined && trade.customFeeAndTax !== null;
    setIsFeeAndTaxManual(hasCustomFee);
    setFormState({
      accountId: trade.accountId,
      date: trade.date,
      stockId: trade.stockId,
      quantity: trade.quantity,
      price: trade.price,
      tradeType: trade.tradeType,
      tradeMethod: trade.tradeMethod,
      goalId: trade.goalId,
      customFeeAndTax: trade.customFeeAndTax,
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (trade: Trade) => {
    setTradeToDelete(trade);
    setIsConfirmModalOpen(true);
  };

  const confirmDelete = () => {
    if (tradeToDelete) {
      setTrades(prev => (prev || []).filter(t => t.id !== tradeToDelete.id));
      alert('삭제되었습니다.');
      handleCloseModal();
    }
    setIsConfirmModalOpen(false);
    setTradeToDelete(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTrade(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const quantity = Number(formState.quantity);
    const price = Number(formState.price);

    if (isNaN(quantity) || isNaN(price)) {
      alert('수량과 단가에 유효한 숫자를 입력해주세요.');
      return;
    }

    if (!formState.accountId || !formState.stockId || quantity <= 0 || price <= 0) {
      alert('모든 필드를 올바르게 입력해주세요.');
      return;
    }

    const tradeToSave: Omit<Trade, 'id'> = {
      ...formState,
      quantity,
      price,
      customFeeAndTax: isFeeAndTaxManual ? formState.customFeeAndTax : undefined,
    };

    if (editingTrade) {
      setTrades(prev => (prev || []).map(t => (t.id === editingTrade.id ? { ...editingTrade, ...tradeToSave } : t)));
    } else {
      setTrades(prev => [{ ...tradeToSave, id: Date.now().toString() }, ...(prev || [])]);
    }
    handleCloseModal();
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex justify-end gap-2">
            <Button onClick={handleAddClick}>기록하기</Button>
        </div>
      </Card>

      <Card>
        <details className="group">
            <summary className="cursor-pointer font-semibold text-light-text dark:text-dark-text list-none group-open:mb-4">
              <div className="flex justify-between items-center">
                <span className="flex items-center">
                  <Cog8ToothIcon className="w-5 h-5 mr-2 text-gray-500" />
                  필터링 옵션
                  {isFilterActive && <span className="ml-2 text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">적용 중</span>}
                </span>
                <div className="flex items-center">
                  {isFilterActive && <button type="button" onClick={(e) => { e.preventDefault(); resetFilters(); }} className="text-xs font-medium text-light-primary dark:text-dark-primary hover:underline mr-2">초기화</button>}
                  <span className="text-xs text-light-secondary dark:text-dark-secondary group-open:hidden">펼치기</span>
                </div>
              </div>
            </summary>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <Select label="연도" name="year" value={filters.year} onChange={handleFilterChange}>
                <option value="all">전체</option>
                {filterOptions.years.map(y => <option key={y} value={y}>{y}년</option>)}
              </Select>
              <Select label="월" name="month" value={filters.month} onChange={handleFilterChange}>
                <option value="all">전체</option>
                {filterOptions.months.map(m => <option key={m} value={m}>{m}월</option>)}
              </Select>
              <Select label="계좌" name="accountId" value={filters.accountId} onChange={handleFilterChange}>
                <option value="all">전체</option>
                {filterOptions.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
              <Select label="종목" name="stockId" value={filters.stockId} onChange={handleFilterChange}>
                <option value="all">전체</option>
                {filterOptions.stocks.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Select label="구분" name="tradeType" value={filters.tradeType} onChange={handleFilterChange}>
                <option value="all">전체</option>
                <option value={TradeType.Buy}>매수</option>
                <option value={TradeType.Sell}>매도</option>
              </Select>
            </div>
        </details>
      </Card>
      
      <div className="space-y-6">
        {Object.keys(groupedAndFilteredTrades).length === 0 ? (
          <Card><p className="text-center py-8 text-light-secondary dark:text-dark-secondary">해당 조건의 매매기록이 없습니다.</p></Card>
        ) : (
          Object.entries(groupedAndFilteredTrades).map(([date, tradesOnDate]) => (
            <div key={date}>
                <h2 className="font-semibold text-lg mb-2 sticky top-0 bg-light-bg dark:bg-dark-bg py-2 z-10 flex items-center gap-2">
                  <CalendarDaysIcon className="w-6 h-6 text-indigo-500" />
                  <span>{date}</span>
                </h2>
                <div className="space-y-3">
                    {(tradesOnDate as TradeWithPL[]).map(trade => {
                        const stock = stockMap.get(trade.stockId);
                        const account = accountMap.get(trade.accountId);
                        const isBuy = trade.tradeType === TradeType.Buy;
                        const totalAmount = (Number(trade.quantity) || 0) * (Number(trade.price) || 0);

                        return (
                          <div key={trade.id} className="bg-light-card dark:bg-dark-card rounded-lg shadow p-3 sm:p-4 border-l-4"
                                style={{borderColor: isBuy ? '#22c55e' : '#ef4444'}}>
                              <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                                  <div className="flex-grow">
                                      <p className="font-bold text-light-text dark:text-dark-text text-base sm:text-lg">{stock?.name}</p>
                                      <p className="text-sm text-light-secondary dark:text-dark-secondary">{account?.name}</p>
                                  </div>
                                  <div className="flex-shrink-0 sm:text-right w-full sm:w-auto">
                                      <div className={`flex items-center sm:justify-end gap-1.5 font-semibold text-base ${isBuy ? 'text-profit' : 'text-loss'}`}>
                                          {isBuy ? <ArrowUpCircleIcon className="w-5 h-5"/> : <ArrowDownCircleIcon className="w-5 h-5"/>}
                                          <span>{isBuy ? '매수' : '매도'}</span>
                                      </div>
                                      <p className="font-bold text-light-text dark:text-dark-text text-base sm:text-lg">{formatCurrency(totalAmount)}</p>
                                      {trade.tradeType === TradeType.Sell && trade.realizedPL !== undefined && (
                                          <div className="text-xs text-left sm:text-right mt-1">
                                              <span className="text-light-secondary dark:text-dark-secondary">
                                                  (평단: {formatCurrency(trade.avgBuyPrice || 0)})
                                              </span>
                                              <span className={`ml-2 font-semibold ${trade.realizedPL >= 0 ? 'text-profit' : 'text-loss'}`}>
                                                  손익: {formatCurrency(trade.realizedPL)}
                                              </span>
                                          </div>
                                      )}
                                  </div>
                              </div>
                              <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-slate-700/50 flex justify-between items-end">
                                <div className="text-sm text-light-secondary dark:text-dark-secondary flex flex-wrap gap-y-1 items-center">
                                  <span>수량: {(Number(trade.quantity) || 0).toLocaleString()}</span>
                                  <span className="mx-2">|</span>
                                  <span>단가: {formatCurrency(Number(trade.price) || 0)}</span>
                                  <span className="mx-2">|</span>
                                  <span>
                                    제비용: {formatCurrency(getTradeFeeAndTaxAmount(trade))}
                                    {trade.customFeeAndTax !== undefined && trade.customFeeAndTax !== null && (
                                      <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-1 font-semibold bg-amber-50 dark:bg-amber-950/40 px-1 py-0.5 rounded border border-amber-200/40 dark:border-amber-900/40">(수동)</span>
                                    )}
                                  </span>
                                </div>
                                <Button variant="secondary" onClick={() => handleEditClick(trade)} className="px-2 py-1 text-xs">
                                  관리
                                </Button>
                              </div>
                          </div>
                        );
                    })}
                </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingTrade ? "매매기록 수정" : "매매기록 추가"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="계좌" id="accountId" name="accountId" value={formState.accountId} onChange={handleInputChange} required>
            {(accounts || []).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
          </Select>
          <Input label="일자" id="date" name="date" type="date" value={formState.date} onChange={handleInputChange} required />
          <Select label="주식종목" id="stockId" name="stockId" value={formState.stockId} onChange={handleInputChange} required>
            {(stocks || []).map(stock => <option key={stock.id} value={stock.id}>{stock.name} ({stock.ticker})</option>)}
          </Select>
          <Input label="수량" id="quantity" name="quantity" type="text" inputMode="numeric" value={formatNumber(formState.quantity)} onChange={handleInputChange} required />
          <Input label="단가" id="price" name="price" type="text" inputMode="numeric" value={formatNumber(formState.price)} onChange={handleInputChange} required />
          <Select label="매매구분" id="tradeType" name="tradeType" value={formState.tradeType} onChange={handleInputChange} required>
            <option value={TradeType.Buy}>매수</option>
            <option value={TradeType.Sell}>매도</option>
          </Select>
          <Select label="매매방법" id="tradeMethod" name="tradeMethod" value={formState.tradeMethod} onChange={handleInputChange} required>
            <option value="직접매매">직접매매</option>
            <option value="자동매매">자동매매</option>
          </Select>
          <Select label="투자 구분" id="goalId" name="goalId" value={formState.goalId || ''} onChange={handleInputChange}>
            <option value="">자산배분 포트폴리오</option>
            {(investmentGoals || []).map(goal => <option key={goal.id} value={goal.id}>{goal.name}</option>)}
          </Select>
          <div className="space-y-1">
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="customFeeAndTax" className="text-xs font-semibold text-light-text dark:text-dark-text">매매비용 직접 입력 (수수료 및 거래세)</label>
              {isFeeAndTaxManual && (
                <button
                  type="button"
                  onClick={() => setIsFeeAndTaxManual(false)}
                  className="text-xs text-light-primary dark:text-dark-primary font-semibold hover:underline flex items-center gap-0.5"
                >
                  자동 계산값 사용
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                label=""
                id="customFeeAndTax"
                name="customFeeAndTax"
                type="text"
                inputMode="numeric"
                value={formatNumber(formState.customFeeAndTax ?? 0)}
                onChange={handleFeeInputChange}
                required
                className={isFeeAndTaxManual ? "border-amber-400 focus:ring-amber-500/50 dark:border-amber-500" : ""}
              />
              {!isFeeAndTaxManual && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 pointer-events-none">
                  자동수정 중
                </span>
              )}
              {isFeeAndTaxManual && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-200/40 dark:border-amber-800/40 pointer-events-none font-semibold">
                  수동수정 됨
                </span>
              )}
            </div>
            <p className="text-[11px] text-light-secondary dark:text-dark-secondary leading-normal">
              ※ {isFeeAndTaxManual ? "실제 처분/취득 비용과 차이가 커 직접 수정한 상태입니다." : "수량·단가 및 계좌정보에 근거하여 거래 비용이 실시간 추정 계산됩니다."}
            </p>
          </div>
          <div className="flex justify-between items-center pt-4">
            <div>
              {editingTrade && (
                <Button type="button" onClick={() => editingTrade && handleDeleteClick(editingTrade)}
                  className="bg-loss text-white hover:bg-red-700 focus:ring-red-500">
                  삭제
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={handleCloseModal}>취소</Button>
              <Button type="submit">{editingTrade ? '저장' : '추가'}</Button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title="매매기록 삭제 확인">
        <p>정말로 이 매매기록을 삭제하시겠습니까?</p>
        <p className="text-sm text-loss mt-2">이 작업은 되돌릴 수 없습니다.</p>
        <div className="flex justify-end mt-6 space-x-2">
            <Button onClick={() => setIsConfirmModalOpen(false)} variant="secondary">취소</Button>
            <Button onClick={confirmDelete} className="bg-loss text-white hover:bg-red-700 focus:ring-red-500">삭제</Button>
        </div>
    </Modal>
    </div>
  );
};

export default TradeHistoryScreen;