import React, { useState, useMemo, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { Trade, Stock, Account, AccountTransaction, TradeType, TransactionType, Screen, HistoricalGain } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CurrencyWonIcon, BanknotesIcon, Cog8ToothIcon, ChartBarIcon, CircleStackIcon, CalendarDaysIcon, ChevronDownIcon, ChevronUpIcon } from '../components/Icons';

const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);
const formatNumber = (value: number | string): string => {
  if (value === '' || value === null || value === undefined || Number(value) === 0) return '';
  const num = Number(String(value).replace(/,/g, ''));
  if (isNaN(num)) return '';
  return num.toLocaleString('ko-KR');
};

interface HistoricalGainsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  historicalGains: HistoricalGain[];
  setHistoricalGains: React.Dispatch<React.SetStateAction<HistoricalGain[]>>;
  accounts: Account[];
}

const HistoricalGainsManager: React.FC<HistoricalGainsManagerProps> = ({ isOpen, onClose, historicalGains, setHistoricalGains, accounts }) => {
  const [editingGain, setEditingGain] = useState<HistoricalGain | null>(null);
  const [formState, setFormState] = useState<Omit<HistoricalGain, 'id'>>({
    accountId: (accounts || [])[0]?.id || '',
    date: new Date().toISOString().split('T')[0],
    stockName: '',
    realizedPnl: 0,
    note: '',
  });

  const accountMap = useMemo(() => new Map((accounts || []).map(a => [a.id, a.name])), [accounts]);

  useEffect(() => {
    if (editingGain) {
      setFormState({
        accountId: editingGain.accountId,
        date: editingGain.date,
        stockName: editingGain.stockName,
        realizedPnl: editingGain.realizedPnl,
        note: editingGain.note || '',
      });
    } else {
      setFormState({
        accountId: (accounts || [])[0]?.id || '',
        date: new Date().toISOString().split('T')[0],
        stockName: '',
        realizedPnl: 0,
        note: '',
      });
    }
  }, [editingGain, accounts]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'realizedPnl') {
      const numValue = parseFloat(value.replace(/,/g, ''));
      setFormState(prev => ({ ...prev, [name]: isNaN(numValue) ? 0 : numValue }));
    } else {
      setFormState(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.accountId || !formState.stockName.trim() || formState.realizedPnl === 0) {
      alert('계좌, 종목명, 실현손익을 올바르게 입력해주세요.');
      return;
    }

    if (editingGain) {
      setHistoricalGains(prev => (prev || []).map(g => g.id === editingGain.id ? { ...g, ...formState } : g));
    } else {
      setHistoricalGains(prev => [...(prev || []), { ...formState, id: Date.now().toString() }]);
    }
    setEditingGain(null);
  };

  const handleDelete = (gainId: string) => {
    if (window.confirm('이 기록을 삭제하시겠습니까?')) {
      setHistoricalGains(prev => (prev || []).filter(g => g.id !== gainId));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="초기 손익 기록 관리">
      <div className="space-y-6">
        <Card title={editingGain ? "기록 수정" : "새 기록 추가"}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="일자" name="date" type="date" value={formState.date} onChange={handleInputChange} required />
            <Select label="계좌" name="accountId" value={formState.accountId} onChange={handleInputChange} required>
              {(accounts || []).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
            </Select>
            <Input label="종목명" name="stockName" value={formState.stockName} onChange={handleInputChange} required placeholder="예: 삼성전자" />
            <Input label="실현손익" name="realizedPnl" type="text" inputMode="numeric" value={formatNumber(formState.realizedPnl)} onChange={handleInputChange} required placeholder="손실은 -금액으로 입력" />
            <Input label="메모 (선택)" name="note" value={formState.note || ''} onChange={handleInputChange} />
            <div className="flex justify-end gap-2">
              {editingGain && <Button type="button" variant="secondary" onClick={() => setEditingGain(null)}>취소</Button>}
              <Button type="submit">{editingGain ? "수정 완료" : "추가"}</Button>
            </div>
          </form>
        </Card>
        
        <Card title="기록된 초기 손익 목록">
          <ul className="space-y-2 max-h-60 overflow-y-auto">
            {(historicalGains || []).length === 0 ? (
              <p className="text-center text-sm text-light-secondary dark:text-dark-secondary">기록이 없습니다.</p>
            ) : (
              (historicalGains || []).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(gain => (
                <li key={gain.id} className="p-2 bg-light-bg dark:bg-dark-bg/50 rounded flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{gain.stockName} <span className={`font-bold ${gain.realizedPnl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(gain.realizedPnl)}</span></p>
                    <p className="text-sm text-light-secondary dark:text-dark-secondary">{gain.date} &middot; {accountMap.get(gain.accountId) || 'N/A'}</p>
                  </div>
                  <div className="space-x-2">
                    <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => setEditingGain(gain)}>수정</Button>
                    <Button className="px-2 py-1 text-xs bg-loss text-white" onClick={() => handleDelete(gain.id)}>삭제</Button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </Modal>
  );
};

interface RealizedGainsViewProps {
  trades: Trade[];
  stocks: Stock[];
  accounts: Account[];
  historicalGains: HistoricalGain[];
  setHistoricalGains: React.Dispatch<React.SetStateAction<HistoricalGain[]>>;
  setCurrentScreen: (screen: Screen) => void;
}

const RealizedGainsView: React.FC<RealizedGainsViewProps> = ({ trades, stocks, accounts, historicalGains, setHistoricalGains, setCurrentScreen }) => {
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const stockMap = useMemo(() => new Map((stocks || []).map(s => [s.id, s])), [stocks]);
  const accountMap = useMemo(() => new Map((accounts || []).map(a => [a.id, a.name])), [accounts]);
  
  const [filters, setFilters] = useState({
    year: 'all',
    month: 'all',
    accountId: 'all',
    stockId: 'all',
  });

  const combinedGainsData = useMemo(() => {
    const holdings: { [key: string]: { quantity: number; totalCost: number } } = {};
    const sortedTrades = [...(trades || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const sellTradesWithPL: any[] = [];

    sortedTrades.forEach(trade => {
      if (!trade.stockId || !trade.accountId) return;
      if (!holdings[trade.stockId]) {
        holdings[trade.stockId] = { quantity: 0, totalCost: 0 };
      }
      const tradeQuantity = Number(trade.quantity) || 0;
      const tradePrice = Number(trade.price) || 0;
      if (trade.tradeType === TradeType.Buy) {
        holdings[trade.stockId].quantity += tradeQuantity;
        holdings[trade.stockId].totalCost += tradeQuantity * tradePrice;
      } else { // SELL
        const currentHolding = holdings[trade.stockId];
        if (currentHolding.quantity > 0) {
          const avgBuyPrice = currentHolding.totalCost / currentHolding.quantity;
          const realizedPnl = (tradePrice - avgBuyPrice) * tradeQuantity;
          const costOfSoldShares = avgBuyPrice * Math.min(tradeQuantity, currentHolding.quantity);
          holdings[trade.stockId].totalCost -= costOfSoldShares;
          holdings[trade.stockId].quantity -= tradeQuantity;
          if (holdings[trade.stockId].quantity < 1e-9) {
            holdings[trade.stockId].quantity = 0;
            holdings[trade.stockId].totalCost = 0;
          }
          sellTradesWithPL.push({
            ...trade,
            stockName: stockMap.get(trade.stockId)?.name || 'N/A',
            sellAmount: tradeQuantity * tradePrice,
            realizedPnl,
            pnlRate: (costOfSoldShares > 0) ? (realizedPnl / costOfSoldShares) * 100 : 0,
            isHistorical: false,
          });
        }
      }
    });

    const historicalGainsFormatted = (historicalGains || []).map(hg => ({
      id: hg.id,
      date: hg.date,
      accountId: hg.accountId,
      stockName: hg.stockName,
      sellAmount: null,
      realizedPnl: hg.realizedPnl,
      pnlRate: null,
      isHistorical: true,
    }));

    return [...sellTradesWithPL, ...historicalGainsFormatted];
  }, [trades, historicalGains, stockMap]);
  
  const filterOptions = useMemo(() => {
    const years = new Set<string>();
    const accountIds = new Set<string>();
    const stockIds = new Set<string>();
    (trades || []).forEach(t => {
      years.add(new Date(t.date).getFullYear().toString());
      if (t.accountId) accountIds.add(t.accountId);
      if (t.stockId) stockIds.add(t.stockId);
    });
    (historicalGains || []).forEach(hg => {
      years.add(new Date(hg.date).getFullYear().toString());
      if (hg.accountId) accountIds.add(hg.accountId);
    });
    return {
      years: Array.from(years).sort((a, b) => b.localeCompare(a)),
      months: Array.from({ length: 12 }, (_, i) => (i + 1).toString()),
      accounts: Array.from(accountIds).map(id => ({ id, name: accountMap.get(id) || 'N/A' })),
      stocks: Array.from(stockIds).map(id => ({ id, name: stockMap.get(id)?.name || 'N/A' })),
    };
  }, [trades, historicalGains, accountMap, stockMap]);

  const filteredGains = useMemo(() => {
    return combinedGainsData.filter(t => {
      if (filters.accountId !== 'all' && t.accountId !== filters.accountId) return false;

      const date = new Date(t.date);
      if (filters.year !== 'all' && date.getFullYear().toString() !== filters.year) return false;
      if (filters.month !== 'all' && (date.getMonth() + 1).toString() !== filters.month) return false;
      
      if (t.isHistorical) {
        if (filters.stockId !== 'all') return false;
      } else {
        if (filters.stockId !== 'all' && t.stockId !== filters.stockId) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [combinedGainsData, filters]);
  
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  const isFilterActive = useMemo(() => Object.values(filters).some(v => v !== 'all'), [filters]);
  const resetFilters = () => setFilters({ year: 'all', month: 'all', accountId: 'all', stockId: 'all' });

  return (
    <Card>
      <HistoricalGainsManager isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} historicalGains={historicalGains} setHistoricalGains={setHistoricalGains} accounts={accounts} />
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2 mb-4">
        <div>
          <details className="group">
              <summary className="cursor-pointer font-semibold text-light-text dark:text-dark-text list-none group-open:mb-4">
                <div className="flex items-center">
                  <Cog8ToothIcon className="w-5 h-5 mr-2 text-gray-500" />
                  <span>
                    필터링 옵션
                    {isFilterActive && <span className="ml-2 text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">적용 중</span>}
                  </span>
                  <span className="ml-2 text-xs text-light-secondary dark:text-dark-secondary group-open:hidden">펼치기</span>
                </div>
              </summary>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                <Select label="연도" name="year" value={filters.year} onChange={handleFilterChange}><option value="all">전체</option>{filterOptions.years.map(y => <option key={y} value={y}>{y}년</option>)}</Select>
                <Select label="월" name="month" value={filters.month} onChange={handleFilterChange}><option value="all">전체</option>{filterOptions.months.map(m => <option key={m} value={m}>{m}월</option>)}</Select>
                <Select label="계좌" name="accountId" value={filters.accountId} onChange={handleFilterChange}><option value="all">전체</option>{filterOptions.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
                <Select label="종목" name="stockId" value={filters.stockId} onChange={handleFilterChange}><option value="all">전체</option>{filterOptions.stocks.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
              </div>
              {isFilterActive && <button type="button" onClick={resetFilters} className="text-xs font-medium text-light-primary dark:text-dark-primary hover:underline mt-2">초기화</button>}
          </details>
        </div>
        <div className="flex sm:flex-col items-end gap-2 flex-shrink-0">
            <Button onClick={() => setIsHistoryModalOpen(true)} variant="secondary">초기 손익 기록</Button>
            <Button onClick={() => setCurrentScreen(Screen.TradeHistory)} variant="secondary">전체 매매기록</Button>
        </div>
      </div>
      <div className="overflow-x-auto hidden md:block"><table className="w-full text-left whitespace-nowrap">
          <thead className="border-b-2 border-gray-200 dark:border-gray-700 bg-light-bg dark:bg-dark-bg"><tr>
              <th scope="col" className="p-3 text-left text-xs font-medium text-light-secondary dark:text-dark-secondary uppercase tracking-wider">일자</th>
              <th scope="col" className="p-3 text-left text-xs font-medium text-light-secondary dark:text-dark-secondary uppercase tracking-wider">종목명</th>
              <th scope="col" className="p-3 text-right text-xs font-medium text-light-secondary dark:text-dark-secondary uppercase tracking-wider">매도금액</th>
              <th scope="col" className="p-3 text-right text-xs font-medium text-light-secondary dark:text-dark-secondary uppercase tracking-wider">실현손익</th>
              <th scope="col" className="p-3 text-right text-xs font-medium text-light-secondary dark:text-dark-secondary uppercase tracking-wider">수익률</th>
              <th scope="col" className="p-3 text-left text-xs font-medium text-light-secondary dark:text-dark-secondary uppercase tracking-wider">계좌명</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{filteredGains.length === 0 ? (<tr><td colSpan={6} className="text-center p-6 text-light-secondary dark:text-dark-secondary">기록이 없습니다.</td></tr>) : (filteredGains.map(item => (<tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
              <td className="p-3">{item.date}</td>
              <td className="p-3 font-semibold">{item.stockName}</td>
              <td className="p-3 text-right">{item.sellAmount === null ? '-' : formatCurrency(item.sellAmount)}</td>
              <td className={`p-3 text-right font-bold ${item.realizedPnl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(item.realizedPnl)}</td>
              <td className={`p-3 text-right font-bold ${item.realizedPnl >= 0 ? 'text-profit' : 'text-loss'}`}>{item.pnlRate === null ? '-' : `${item.pnlRate.toFixed(2)}%`}</td>
              <td className="p-3">{accountMap.get(item.accountId) || 'N/A'}</td>
          </tr>)))}</tbody>
      </table></div>
      <div className="space-y-3 md:hidden">{filteredGains.length === 0 ? (<p className="text-center p-6 text-light-secondary dark:text-dark-secondary">기록이 없습니다.</p>) : (filteredGains.map(item => (<div key={item.id} className="bg-light-bg dark:bg-dark-bg/50 rounded-lg p-4">
          <div className="flex justify-between items-start">
              <div><p className="font-bold text-light-text dark:text-dark-text">{item.stockName}</p><p className="text-sm text-light-secondary dark:text-dark-secondary">{item.date}</p></div>
              <div className="text-right flex-shrink-0"><p className={`font-bold text-lg ${item.realizedPnl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(item.realizedPnl)}</p>{item.pnlRate !== null && <p className={`text-sm font-semibold ${item.realizedPnl >= 0 ? 'text-profit' : 'text-loss'}`}>{item.pnlRate.toFixed(2)}%</p>}</div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-slate-700/50 text-sm text-light-secondary dark:text-dark-secondary space-y-1">
              {item.sellAmount !== null && <div className="flex justify-between"><span>매도금액</span><span className="font-medium text-light-text dark:text-dark-text">{formatCurrency(item.sellAmount)}</span></div>}
              <div className="flex justify-between"><span>계좌</span><span className="font-medium text-light-text dark:text-dark-text">{accountMap.get(item.accountId) || 'N/A'}</span></div>
          </div>
      </div>)))}</div>
    </Card>
  );
};

interface DividendsViewProps {
  transactions: AccountTransaction[];
  setTransactions: React.Dispatch<React.SetStateAction<AccountTransaction[]>>;
  stocks: Stock[];
  accounts: Account[];
  trades: Trade[];
}

const DividendsView: React.FC<DividendsViewProps> = ({ transactions, setTransactions, stocks, accounts, trades }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<AccountTransaction | null>(null);
    const [txToDelete, setTxToDelete] = useState<AccountTransaction | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [formState, setFormState] = useState<Partial<AccountTransaction>>({
        date: new Date().toISOString().split('T')[0],
        accountId: (accounts || [])[0]?.id || '',
        stockId: (stocks || [])[0]?.id || '',
        amount: 0,
        transactionType: TransactionType.Dividend,
    });
    const [filters, setFilters] = useState({ year: new Date().getFullYear().toString(), month: 'all', accountId: 'all', stockId: 'all' });
    const [groupBy, setGroupBy] = useState<'stock' | 'account'>('stock');
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

    const stockMap = useMemo(() => new Map((stocks || []).map(s => [s.id, s.name])), [stocks]);
    const accountMap = useMemo(() => new Map((accounts || []).map(a => [a.id, a.name])), [accounts]);

    const stockTotalCosts = useMemo(() => {
        const holdingsMap: { [stockId: string]: { quantity: number; totalCost: number } } = {};

        [...(trades || [])]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
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

        const costs: { [stockId: string]: number } = {};
        for (const stockId in holdingsMap) {
            if (holdingsMap[stockId].totalCost > 0) {
                costs[stockId] = holdingsMap[stockId].totalCost;
            }
        }
        return costs;
    }, [trades]);

    const dividendTransactions = useMemo(() => (transactions || []).filter(t => t.transactionType === TransactionType.Dividend).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [transactions]);
    const filterOptions = useMemo(() => {
      const currentYear = new Date().getFullYear(), startYear = 2024, years = [];
      for (let y = currentYear; y >= startYear; y--) years.push(y.toString());
      const accountIds = new Set<string>(), stockIds = new Set<string>();
      dividendTransactions.forEach(t => { if (t.accountId) accountIds.add(t.accountId); if (t.stockId) stockIds.add(t.stockId); });
      return { years, months: Array.from({ length: 12 }, (_, i) => (i + 1).toString()), accounts: Array.from(accountIds).map(id => ({ id, name: accountMap.get(id) || 'N/A' })), stocks: Array.from(stockIds).map(id => ({ id, name: stockMap.get(id) || 'N/A' })) };
    }, [dividendTransactions, accountMap, stockMap]);
    const filteredDividendTransactions = useMemo(() => dividendTransactions.filter(t => { const d = new Date(t.date); if (filters.year !== 'all' && d.getFullYear().toString() !== filters.year) return false; if (filters.month !== 'all' && (d.getMonth() + 1).toString() !== filters.month) return false; if (filters.accountId !== 'all' && t.accountId !== filters.accountId) return false; if (filters.stockId !== 'all' && t.stockId !== filters.stockId) return false; return true; }), [dividendTransactions, filters]);
    const monthlyDividendData = useMemo(() => { const y = parseInt(filters.year, 10), monthlyTotals = Array(12).fill(0); let yearTotal = 0; dividendTransactions.forEach(tx => { const d = new Date(tx.date); if (d.getFullYear() === y) { const m = d.getMonth(), a = Number(tx.amount) || 0; monthlyTotals[m] += a; yearTotal += a; } }); return { chartData: monthlyTotals.map((t, i) => ({ name: `${i + 1}월`, '배당금': t })), total: yearTotal, year: y }; }, [dividendTransactions, filters.year]);
    const totalCumulativeDividends = useMemo(() => (transactions || []).filter(t => t.transactionType === TransactionType.Dividend && new Date(t.date).getFullYear() >= 2024).reduce((s, t) => s + (Number(t.amount) || 0), 0), [transactions]);
    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));
    const isFilterActive = useMemo(() => Object.values(filters).some((v, i) => i === 0 ? v !== new Date().getFullYear().toString() : v !== 'all'), [filters]);
    const resetFilters = () => setFilters({ year: new Date().getFullYear().toString(), month: 'all', accountId: 'all', stockId: 'all' });
    const handleAddClick = () => { setEditingTx(null); setFormState({ date: new Date().toISOString().split('T')[0], accountId: (accounts || [])[0]?.id || '', stockId: (stocks || [])[0]?.id || '', amount: 0, transactionType: TransactionType.Dividend }); setIsModalOpen(true); };
    const handleEditClick = (tx: AccountTransaction) => { setEditingTx(tx); setFormState(tx); setIsModalOpen(true); };
    const handleDeleteClick = (tx: AccountTransaction) => { setTxToDelete(tx); setIsConfirmModalOpen(true); };
    const confirmDelete = () => { if (txToDelete) setTransactions(p => (p || []).filter(t => t.id !== txToDelete.id)); setIsConfirmModalOpen(false); setTxToDelete(null); };
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { const { name, value } = e.target; if (name === 'amount') { const n = parseFloat(value.replace(/,/g, '')); setFormState(p => ({...p, [name]: isNaN(n) ? 0 : n})); } else { setFormState(p => ({...p, [name]: value})); } };
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!formState.accountId || !formState.stockId || !formState.amount || formState.amount <= 0) { alert('모든 필드를 올바르게 입력해주세요.'); return; } if (editingTx) { setTransactions(p => (p || []).map(t => t.id === editingTx.id ? {...t, ...formState} as AccountTransaction : t)); } else { setTransactions(p => [{...formState, id: Date.now().toString()} as AccountTransaction, ...(p || [])]); } setIsModalOpen(false); };
    
    const groupedData = useMemo(() => {
        const dataMap: { [key: string]: { name: string, total: number, transactions: AccountTransaction[] } } = {};
        filteredDividendTransactions.forEach(tx => {
            const key = groupBy === 'stock' ? tx.stockId : tx.accountId;
            if (!key) return;

            if (!dataMap[key]) {
                const name = groupBy === 'stock' 
                    ? (tx.stockId ? stockMap.get(tx.stockId) : '알 수 없음') 
                    : accountMap.get(tx.accountId);
                dataMap[key] = { name: name || '알 수 없음', total: 0, transactions: [] };
            }
            dataMap[key].total += Number(tx.amount) || 0;
            dataMap[key].transactions.push(tx);
        });
        
        return Object.entries(dataMap).map(([key, value]) => ({
            ...value,
            id: key,
        })).sort((a, b) => b.total - a.total);
    }, [filteredDividendTransactions, groupBy, stockMap, accountMap]);

    return (
        <Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-light-card dark:bg-dark-card p-4 rounded-lg shadow-md flex items-center gap-4 border border-gray-200/80 dark:border-slate-700">
                <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg">
                  <CircleStackIcon className="w-6 h-6 text-profit" />
                </div>
                <div>
                  <p className="text-sm text-light-secondary dark:text-dark-secondary">총 누적 배당금 (2024~)</p>
                  <p className="text-xl font-bold text-profit">{formatCurrency(totalCumulativeDividends)}</p>
                </div>
              </div>
              <div className="bg-light-card dark:bg-dark-card p-4 rounded-lg shadow-md flex items-center gap-4 border border-gray-200/80 dark:border-slate-700">
                <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg">
                  <CalendarDaysIcon className="w-6 h-6 text-profit" />
                </div>
                <div>
                  <p className="text-sm text-light-secondary dark:text-dark-secondary">선택 연도 누적 ({monthlyDividendData.year}년)</p>
                  <p className="text-xl font-bold text-profit">{formatCurrency(monthlyDividendData.total)}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end mb-4"><Button onClick={handleAddClick}>배당금 기록</Button></div>
            <details className="group mb-4"><summary className="cursor-pointer font-semibold text-light-text dark:text-dark-text list-none group-open:mb-4"><div className="flex justify-between items-center"><span>필터링 옵션{isFilterActive && <span className="ml-2 text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">적용 중</span>}</span><div className="flex items-center">{isFilterActive && <button type="button" onClick={(e) => { e.preventDefault(); resetFilters(); }} className="text-xs font-medium text-light-primary dark:text-dark-primary hover:underline mr-2">초기화</button>}<span className="text-xs text-light-secondary dark:text-dark-secondary group-open:hidden">펼치기</span></div></div></summary><div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Select label="연도" name="year" value={filters.year} onChange={handleFilterChange}>{filterOptions.years.map(y => <option key={y} value={y}>{y}년</option>)}</Select>
                  <Select label="월" name="month" value={filters.month} onChange={handleFilterChange}><option value="all">전체</option>{filterOptions.months.map(m => <option key={m} value={m}>{m}월</option>)}</Select>
                  <Select label="계좌" name="accountId" value={filters.accountId} onChange={handleFilterChange}><option value="all">전체</option>{filterOptions.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
                  <Select label="종목" name="stockId" value={filters.stockId} onChange={handleFilterChange}><option value="all">전체</option>{filterOptions.stocks.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            </div></details>
            <div className="mt-6 mb-8 p-4 bg-light-bg dark:bg-dark-bg/50 rounded-lg"><h3 className="text-lg font-semibold mb-4 text-center text-light-text dark:text-dark-text flex items-center justify-center gap-2"><ChartBarIcon className="w-6 h-6 text-green-500" /><span>{monthlyDividendData.year}년 월별 배당금 현황</span></h3><ResponsiveContainer width="100%" height={300}><BarChart data={monthlyDividendData.chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis tickFormatter={(v) => new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(v as number)} /><Tooltip formatter={(v: number) => formatCurrency(v)} /><Legend /><Bar dataKey="배당금" fill="#22c55e" /></BarChart></ResponsiveContainer></div>
            
            <div className="flex justify-center my-4">
                <div className="inline-flex rounded-md shadow-sm" role="group">
                    <button type="button" onClick={() => setGroupBy('stock')} className={`px-4 py-2 text-sm font-medium border rounded-l-lg transition-colors ${groupBy === 'stock' ? 'bg-light-primary text-white border-light-primary' : 'bg-white dark:bg-dark-card text-light-text dark:text-dark-text border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>종목별</button>
                    <button type="button" onClick={() => setGroupBy('account')} className={`px-4 py-2 text-sm font-medium border-t border-b border-r rounded-r-lg transition-colors ${groupBy === 'account' ? 'bg-light-primary text-white border-light-primary' : 'bg-white dark:bg-dark-card text-light-text dark:text-dark-text border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>계좌별</button>
                </div>
            </div>

            <div className="space-y-3">
                {groupedData.length === 0 ? (<p className="text-center p-6 text-light-secondary dark:text-dark-secondary">해당 조건의 배당금 기록이 없습니다.</p>) : (
                    groupedData.map(group => {
                        const isExpanded = expandedGroup === group.name;
                        let dividendYield: number | null = null;
                        if (groupBy === 'stock' && group.id && stockTotalCosts[group.id]) {
                            const totalCost = stockTotalCosts[group.id];
                            if (totalCost > 0) {
                                dividendYield = (group.total / totalCost) * 100;
                            }
                        }
                        return (
                            <div key={group.name} className="bg-light-bg dark:bg-dark-bg/50 rounded-lg shadow-sm">
                                <div className="p-4 cursor-pointer flex justify-between items-center" onClick={() => setExpandedGroup(isExpanded ? null : group.name)}>
                                    <div>
                                        <p className="font-bold text-light-text dark:text-dark-text">{group.name}</p>
                                        <p className="text-sm text-light-secondary dark:text-dark-secondary">{group.transactions.length}건</p>
                                    </div>
                                    <div className="text-right flex items-center gap-3">
                                        <div>
                                          <p className="font-bold text-lg text-profit">{formatCurrency(group.total)}</p>
                                          {dividendYield !== null && (
                                              <p className="text-xs font-semibold text-green-700 dark:text-green-300">
                                                  투자금 대비 {dividendYield.toFixed(2)}%
                                              </p>
                                          )}
                                        </div>
                                        {isExpanded ? <ChevronUpIcon className="w-5 h-5"/> : <ChevronDownIcon className="w-5 h-5"/>}
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="px-4 pb-4 border-t border-gray-200/50 dark:border-slate-700/50 space-y-2">
                                        {group.transactions.map(tx => (
                                          <div key={tx.id} className="bg-white dark:bg-dark-card/50 p-3 rounded-md flex justify-between items-center">
                                              <div>
                                                  <p className="font-semibold">{tx.date}</p>
                                                  <p className="text-sm text-light-secondary dark:text-dark-secondary">
                                                      {groupBy === 'stock'
                                                          ? `계좌: ${accountMap.get(tx.accountId) || 'N/A'}`
                                                          : `종목: ${tx.stockId ? stockMap.get(tx.stockId) : 'N/A'}`
                                                      }
                                                  </p>
                                              </div>
                                              <div className="text-right">
                                                  <p className="font-bold text-profit">{formatCurrency(tx.amount)}</p>
                                                  <div className="mt-1 space-x-2">
                                                      <Button onClick={() => handleEditClick(tx)} variant="secondary" className="px-2 py-1 text-xs">수정</Button>
                                                      <Button onClick={() => handleDeleteClick(tx)} className="px-2 py-1 text-xs bg-loss text-white">삭제</Button>
                                                  </div>
                                              </div>
                                          </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTx ? "배당금 수정" : "배당금 기록"}><form onSubmit={handleSubmit} className="space-y-4">
              <Input label="일자" id="div-date" name="date" type="date" value={formState.date} onChange={handleInputChange} required /><Select label="종목" id="div-stockId" name="stockId" value={formState.stockId} onChange={handleInputChange} required>{(stocks || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select><Input label="금액" id="div-amount" name="amount" type="text" inputMode="numeric" value={formatNumber(formState.amount || 0)} onChange={handleInputChange} required /><Select label="입금계좌" id="div-accountId" name="accountId" value={formState.accountId} onChange={handleInputChange} required>{(accounts || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select><div className="flex justify-end pt-4"><Button type="submit">저장</Button></div>
            </form></Modal>
            <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title="배당금 기록 삭제 확인"><p>정말로 이 배당금 기록을 삭제하시겠습니까?</p><div className="flex justify-end mt-6 space-x-2"><Button onClick={() => setIsConfirmModalOpen(false)} variant="secondary">취소</Button><Button onClick={confirmDelete} className="bg-loss text-white hover:bg-red-700 focus:ring-red-500">삭제</Button></div></Modal>
        </Card>
    );
};


interface ProfitManagementScreenProps {
  trades: Trade[];
  stocks: Stock[];
  accounts: Account[];
  transactions: AccountTransaction[];
  setTransactions: React.Dispatch<React.SetStateAction<AccountTransaction[]>>;
  setCurrentScreen: (screen: Screen) => void;
  historicalGains: HistoricalGain[];
  setHistoricalGains: React.Dispatch<React.SetStateAction<HistoricalGain[]>>;
}

const ProfitManagementScreen: React.FC<ProfitManagementScreenProps> = ({ trades, stocks, accounts, transactions, setTransactions, setCurrentScreen, historicalGains, setHistoricalGains }) => {
  const [activeTab, setActiveTab] = useState('realized');

  const totalRealizedGains = useMemo(() => {
    const holdings: { [key: string]: { quantity: number; totalCost: number } } = {};
    const sortedTrades = [...(trades || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let totalPnlFromTrades = 0;
    sortedTrades.forEach(trade => {
        if (!trade.stockId) return;
        if (!holdings[trade.stockId]) holdings[trade.stockId] = { quantity: 0, totalCost: 0 };
        const qty = Number(trade.quantity) || 0, price = Number(trade.price) || 0;
        if (trade.tradeType === TradeType.Buy) {
            holdings[trade.stockId].quantity += qty;
            holdings[trade.stockId].totalCost += qty * price;
        } else {
            const h = holdings[trade.stockId];
            if (h.quantity > 0) {
                const avgBuyPrice = h.totalCost / h.quantity;
                totalPnlFromTrades += (price - avgBuyPrice) * qty;
                const costOfSold = avgBuyPrice * Math.min(qty, h.quantity);
                h.totalCost -= costOfSold;
                h.quantity -= qty;
                if (h.quantity < 1e-9) { h.quantity = 0; h.totalCost = 0; }
            }
        }
    });
    const totalPnlFromHistory = (historicalGains || []).reduce((sum, hg) => sum + hg.realizedPnl, 0);
    return totalPnlFromTrades + totalPnlFromHistory;
  }, [trades, historicalGains]);

  const totalDividends = useMemo(() => {
    return (transactions || [])
        .filter(t => t.transactionType === TransactionType.Dividend)
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [transactions]);

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('realized')}
          className={`flex items-center justify-center px-4 py-3 text-sm font-medium transition-colors w-1/2 ${
            activeTab === 'realized'
              ? 'border-b-2 border-light-primary text-light-primary dark:text-dark-primary'
              : 'text-light-secondary dark:text-dark-secondary hover:text-light-text dark:hover:text-dark-text'
          }`}
        >
          <CurrencyWonIcon className="w-5 h-5 mr-2" />
          <span>실현 손익 ({formatCurrency(totalRealizedGains)})</span>
        </button>
        <button
          onClick={() => setActiveTab('dividends')}
          className={`flex items-center justify-center px-4 py-3 text-sm font-medium transition-colors w-1/2 ${
            activeTab === 'dividends'
              ? 'border-b-2 border-light-primary text-light-primary dark:text-dark-primary'
              : 'text-light-secondary dark:text-dark-secondary hover:text-light-text dark:hover:text-dark-text'
          }`}
        >
          <BanknotesIcon className="w-5 h-5 mr-2" />
          <span>배당금 ({formatCurrency(totalDividends)})</span>
        </button>
      </div>

      <div>
        {activeTab === 'realized' && <RealizedGainsView trades={trades} stocks={stocks} accounts={accounts} historicalGains={historicalGains} setHistoricalGains={setHistoricalGains} setCurrentScreen={setCurrentScreen} />}
        {activeTab === 'dividends' && <DividendsView trades={trades} transactions={transactions} setTransactions={setTransactions} stocks={stocks} accounts={accounts} />}
      </div>
    </div>
  );
};

export default ProfitManagementScreen;
