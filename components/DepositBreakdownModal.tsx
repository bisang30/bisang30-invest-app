import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Trade, AccountTransaction, Stock, HistoricalGain, Account, FeeSettings } from '../types';
import { calculateTradeFeeAndTax } from '../services/feeService';

interface DepositBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account;
  trades: Trade[];
  transactions: AccountTransaction[];
  stocks: Stock[];
  historicalGains: HistoricalGain[];
  feeSettings: FeeSettings;
}

interface LedgerItem {
  id: string;
  date: string;
  type: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out' | 'dividend' | 'interest' | 'buy' | 'sell' | 'historical_pnl';
  label: string;
  amount: number;
  cashEffect: number;
  fee?: number;
  tax?: number;
  runningBalance?: number;
  ref: any;
}

const formatCurrency = (val: number) => {
  return Math.round(val).toLocaleString('ko-KR') + '원';
};

const DepositBreakdownModal: React.FC<DepositBreakdownModalProps> = ({
  isOpen,
  onClose,
  account,
  trades,
  transactions,
  stocks,
  historicalGains,
  feeSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'duplicates' | 'negatives'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const stockMap = useMemo(() => new Map(stocks.map(s => [s.id, s])), [stocks]);

  // Filters and calculations
  const {
    ledger,
    totals,
    suspiciousTransactions,
    suspiciousTrades,
    negativeEvents,
  } = useMemo(() => {
    const accountTrades = trades.filter(t => t.accountId === account.id);
    const accountTransactions = transactions.filter(
      t => t.accountId === account.id || t.counterpartyAccountId === account.id
    );
    const accountHistoricalGains = historicalGains.filter(g => g.accountId === account.id);

    // 1. Map Transactions
    const txItems: LedgerItem[] = accountTransactions.map(t => {
      const amount = Number(t.amount) || 0;
      let type: LedgerItem['type'] = 'deposit';
      let cashEffect = 0;
      let label = '';

      if (t.transactionType === 'DEPOSIT') {
        if (t.accountId === account.id) {
          type = 'deposit';
          cashEffect = amount;
          label = '현금 입금';
        } else {
          type = 'transfer_out';
          cashEffect = -amount;
          label = '계좌 이체 (출금)';
        }
      } else if (t.transactionType === 'WITHDRAWAL') {
        if (t.accountId === account.id) {
          type = 'withdrawal';
          cashEffect = -amount;
          label = '현금 출금';
        } else {
          type = 'transfer_in';
          cashEffect = amount;
          label = '계좌 이체 (입금)';
        }
      } else if (t.transactionType === 'DIVIDEND') {
        type = 'dividend';
        cashEffect = amount;
        label = '분배금/배당금 수령';
      } else if (t.transactionType === 'INTEREST') {
        type = 'interest';
        cashEffect = amount;
        label = '이자 수령';
      }

      return {
        id: `tx_${t.id}`,
        date: t.date,
        type,
        label,
        amount,
        cashEffect,
        ref: t,
      };
    });

    // 2. Map Trades
    const tradeItems: LedgerItem[] = accountTrades.map(t => {
      const stock = stockMap.get(t.stockId);
      const stockName = stock ? stock.name : '알 수 없는 종목';
      const qty = Number(t.quantity) || 0;
      const price = Number(t.price) || 0;
      const pureAmount = qty * price;

      // Fees and taxes
      const feeCalc = calculateTradeFeeAndTax(t, stock, account, feeSettings);
      const cashEffect = t.tradeType === 'BUY' ? -feeCalc.total : feeCalc.total;

      return {
        id: `trade_${t.id}`,
        date: t.date,
        type: t.tradeType === 'BUY' ? 'buy' : 'sell',
        label: `${stockName} ${t.tradeType === 'BUY' ? '매수' : '매도'} (${qty.toLocaleString()}주 @ ${price.toLocaleString()}원)`,
        amount: pureAmount,
        cashEffect,
        fee: feeCalc.fee,
        tax: feeCalc.tax,
        ref: t,
      };
    });

    // 3. Map Historical PnL
    const histItems: LedgerItem[] = accountHistoricalGains.map(g => {
      const pnl = Number(g.realizedPnl) || 0;
      return {
        id: `hist_${g.id}`,
        date: g.date,
        type: 'historical_pnl',
        label: `과거 확정손익 반영 (${g.stockName})`,
        amount: Math.abs(pnl),
        cashEffect: pnl,
        ref: g,
      };
    });

    // Combine & Sort chronologically
    const combined = [...txItems, ...tradeItems, ...histItems];

    const getInflowPriority = (type: LedgerItem['type']) => {
      if (['deposit', 'transfer_in', 'dividend', 'interest', 'sell', 'historical_pnl'].includes(type)) return 1;
      return 2; // Process outflows second on same day
    };

    const sorted = combined.sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;

      const pA = getInflowPriority(a.type);
      const pB = getInflowPriority(b.type);
      if (pA !== pB) return pA - pB;

      return a.id.localeCompare(b.id);
    });

    // Calculate running balance and catch negatives
    let bal = 0;
    const negativeEventsList: LedgerItem[] = [];
    const withBalance = sorted.map(item => {
      bal += item.cashEffect;
      const itemWithBal = { ...item, runningBalance: bal };
      if (bal < 0) {
        negativeEventsList.push(itemWithBal);
      }
      return itemWithBal;
    });

    // Totals calculations
    let totalDepositVal = 0;
    let totalWithdrawalVal = 0;
    let totalSellVal = 0;
    let totalBuyVal = 0;
    let totalDividendVal = 0;
    let totalHistVal = 0;

    withBalance.forEach(item => {
      if (item.type === 'deposit' || item.type === 'transfer_in') {
        totalDepositVal += item.cashEffect;
      } else if (item.type === 'withdrawal' || item.type === 'transfer_out') {
        totalWithdrawalVal += Math.abs(item.cashEffect);
      } else if (item.type === 'sell') {
        totalSellVal += item.cashEffect;
      } else if (item.type === 'buy') {
        totalBuyVal += Math.abs(item.cashEffect);
      } else if (item.type === 'dividend' || item.type === 'interest') {
        totalDividendVal += item.cashEffect;
      } else if (item.type === 'historical_pnl') {
        totalHistVal += item.cashEffect;
      }
    });

    // Detect Duplicates in Transactions
    const txGroups: Record<string, AccountTransaction[]> = {};
    accountTransactions.forEach(t => {
      // Key format: Date_Amount_Type
      const key = `${t.date}_${t.amount}_${t.transactionType}`;
      if (!txGroups[key]) txGroups[key] = [];
      txGroups[key].push(t);
    });
    const dupTxs = Object.values(txGroups).filter(group => group.length > 1).flat();

    // Detect Duplicates in Trades
    const tradeGroups: Record<string, Trade[]> = {};
    accountTrades.forEach(t => {
      const key = `${t.date}_${t.stockId}_${t.tradeType}_${t.quantity}_${t.price}`;
      if (!tradeGroups[key]) tradeGroups[key] = [];
      tradeGroups[key].push(t);
    });
    const dupTrades = Object.values(tradeGroups).filter(group => group.length > 1).flat();

    return {
      ledger: withBalance,
      totals: {
        deposits: totalDepositVal,
        withdrawals: totalWithdrawalVal,
        sells: totalSellVal,
        buys: totalBuyVal,
        dividends: totalDividendVal,
        historicalPnl: totalHistVal,
        finalBalance: bal,
      },
      suspiciousTransactions: dupTxs,
      suspiciousTrades: dupTrades,
      negativeEvents: negativeEventsList,
    };
  }, [trades, transactions, historicalGains, account, stocks, feeSettings]);

  // Filter ledger based on search and active tab
  const filteredLedger = useMemo(() => {
    let result = ledger;

    if (activeTab === 'duplicates') {
      const dupTxIds = new Set(suspiciousTransactions.map(t => `tx_${t.id}`));
      const dupTradeIds = new Set(suspiciousTrades.map(t => `trade_${t.id}`));
      result = ledger.filter(item => dupTxIds.has(item.id) || dupTradeIds.has(item.id));
    } else if (activeTab === 'negatives') {
      result = ledger.filter(item => (item.runningBalance || 0) < 0);
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        item =>
          item.date.includes(q) ||
          item.label.toLowerCase().includes(q) ||
          String(item.amount).includes(q)
      );
    }

    return result;
  }, [ledger, activeTab, searchQuery, suspiciousTransactions, suspiciousTrades]);

  if (!isOpen) return null;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  const getBadgeStyle = (type: LedgerItem['type']) => {
    switch (type) {
      case 'deposit':
      case 'transfer_in':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'withdrawal':
      case 'transfer_out':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'dividend':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'interest':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300';
      case 'buy':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'sell':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getTypeText = (type: LedgerItem['type']) => {
    switch (type) {
      case 'deposit':
        return '현금입금';
      case 'transfer_in':
        return '이체입금';
      case 'withdrawal':
        return '현금출금';
      case 'transfer_out':
        return '이체출금';
      case 'dividend':
        return '배당/분배';
      case 'interest':
        return '이자수령';
      case 'buy':
        return '주식매수';
      case 'sell':
        return '주식매도';
      case 'historical_pnl':
        return '과거손익';
    }
  };

  const hasAlerts = suspiciousTransactions.length > 0 || suspiciousTrades.length > 0 || negativeEvents.length > 0;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 transition-all"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-light-card dark:bg-dark-card rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200/80 dark:border-slate-700/80"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold text-light-text dark:text-dark-text flex items-center gap-2">
              <span className="text-blue-500">📊</span>
              <span>{account.name} 예수금 상세 산출 내역</span>
            </h2>
            <p className="text-xs text-light-secondary dark:text-dark-secondary mt-1">
              계좌 거래 내역과 주식 매매 내역을 결합하여 가중 수수료/세금을 차감해 일자별로 계산한 예수금 흐름입니다.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-3xl leading-none text-light-secondary dark:text-dark-secondary hover:text-light-text dark:hover:text-dark-text transition-colors p-1"
          >
            &times;
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          
          {/* Formula Breakdown Panel */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="p-3 bg-green-50/50 dark:bg-green-950/10 border border-green-100 dark:border-green-900/30 rounded-lg text-center">
              <p className="text-xs text-light-secondary dark:text-dark-secondary font-medium">총 입금액(+)</p>
              <p className="text-sm font-bold text-green-600 dark:text-green-400 mt-1">
                {formatCurrency(totals.deposits)}
              </p>
            </div>
            
            <div className="p-3 bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 rounded-lg text-center">
              <p className="text-xs text-light-secondary dark:text-dark-secondary font-medium">총 출금액(-)</p>
              <p className="text-sm font-bold text-red-600 dark:text-red-400 mt-1">
                -{formatCurrency(totals.withdrawals)}
              </p>
            </div>

            <div className="p-3 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-lg text-center">
              <p className="text-xs text-light-secondary dark:text-dark-secondary font-medium">총 매도 대금(+)</p>
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-1">
                {formatCurrency(totals.sells)}
              </p>
            </div>

            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 rounded-lg text-center">
              <p className="text-xs text-light-secondary dark:text-dark-secondary font-medium">총 매수 대금(-)</p>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-1">
                -{formatCurrency(totals.buys)}
              </p>
            </div>

            <div className="p-3 bg-purple-50/50 dark:bg-purple-950/10 border border-purple-100 dark:border-purple-900/30 rounded-lg text-center">
              <p className="text-xs text-light-secondary dark:text-dark-secondary font-medium">배당/이자(+)</p>
              <p className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-1">
                {formatCurrency(totals.dividends)}
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700 rounded-lg text-center">
              <p className="text-xs text-light-secondary dark:text-dark-secondary font-medium">과거 손익(+)</p>
              <p className="text-sm font-bold text-light-text dark:text-dark-text mt-1">
                {totals.historicalPnl >= 0 ? '+' : ''}{formatCurrency(totals.historicalPnl)}
              </p>
            </div>

            <div className="p-3 bg-blue-500/10 dark:bg-blue-400/10 border border-blue-500/20 dark:border-blue-400/20 rounded-lg text-center col-span-2 md:col-span-1">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-bold">계산된 예수금</p>
              <p className="text-base font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
                {formatCurrency(totals.finalBalance)}
              </p>
            </div>
          </div>

          {/* Audit Alert Center */}
          {hasAlerts && (
            <div className="p-4 bg-red-500/5 dark:bg-red-400/5 border border-red-500/20 dark:border-red-400/20 rounded-xl space-y-3">
              <h3 className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>정밀 진단: 예수금 오류 유발 가능 항목 감지됨</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Duplicate transactions alert */}
                {suspiciousTransactions.length > 0 && (
                  <div className="space-y-1 bg-light-card dark:bg-dark-card p-3 rounded-lg border border-red-500/10">
                    <p className="font-semibold text-red-600 dark:text-red-400">
                      중복 등록 의심 입출금 내역 ({Math.floor(suspiciousTransactions.length / 2)}건 감지)
                    </p>
                    <p className="text-light-secondary dark:text-dark-secondary leading-relaxed">
                      동일 일자에 동일한 금액과 타입으로 기록된 내역입니다. 실수로 중복 입력했는지 확인해보세요.
                    </p>
                    <div className="pt-1 text-[11px] space-y-1">
                      {suspiciousTransactions.slice(0, 4).map((t, idx) => (
                        <div key={t.id || idx} className="flex justify-between font-mono bg-gray-50 dark:bg-slate-800/50 p-1 rounded">
                          <span>{t.date} | {t.transactionType === 'DEPOSIT' ? '입금' : '출금'}</span>
                          <span className="font-bold">{t.amount.toLocaleString()}원</span>
                        </div>
                      ))}
                      {suspiciousTransactions.length > 4 && <span className="text-light-secondary">외 {suspiciousTransactions.length - 4}개 더 있음...</span>}
                    </div>
                  </div>
                )}

                {/* Duplicate trades alert */}
                {suspiciousTrades.length > 0 && (
                  <div className="space-y-1 bg-light-card dark:bg-dark-card p-3 rounded-lg border border-red-500/10">
                    <p className="font-semibold text-red-600 dark:text-red-400">
                      중복 등록 의심 주식 매매 ({Math.floor(suspiciousTrades.length / 2)}건 감지)
                    </p>
                    <p className="text-light-secondary dark:text-dark-secondary leading-relaxed">
                      동일 날짜에 동일 종목, 매매 구분, 수량, 가격이 일치하는 거래가 여러 번 입력되었습니다.
                    </p>
                    <div className="pt-1 text-[11px] space-y-1">
                      {suspiciousTrades.slice(0, 4).map((t, idx) => {
                        const stock = stockMap.get(t.stockId);
                        return (
                          <div key={t.id || idx} className="flex justify-between font-mono bg-gray-50 dark:bg-slate-800/50 p-1 rounded">
                            <span>{t.date} | {stock ? stock.name : 'Unknown'} | {t.tradeType === 'BUY' ? '매수' : '매도'}</span>
                            <span className="font-bold">{t.quantity}주 @ {t.price.toLocaleString()}원</span>
                          </div>
                        );
                      })}
                      {suspiciousTrades.length > 4 && <span className="text-light-secondary">외 {suspiciousTrades.length - 4}개 더 있음...</span>}
                    </div>
                  </div>
                )}

                {/* Negative cash flow alert */}
                {negativeEvents.length > 0 && (
                  <div className="space-y-1 bg-light-card dark:bg-dark-card p-3 rounded-lg border border-red-500/10 col-span-1 md:col-span-2">
                    <p className="font-semibold text-red-600 dark:text-red-400">
                      예수금 잔고 고갈(마이너스) 구간 발생 ({negativeEvents.length}개 시점 감지)
                    </p>
                    <p className="text-light-secondary dark:text-dark-secondary leading-relaxed">
                      매수 거래 시점에 계좌 내 잔고가 부족해 예수금이 일시적으로 마이너스가 된 이력이 있습니다. 입금 누락이 있거나, 실제 입금 날짜보다 주식 매수일이 빠르게 기재되었는지 점검하세요.
                    </p>
                    <div className="pt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-[10px] font-mono">
                      {negativeEvents.slice(0, 8).map((evt, idx) => (
                        <div key={evt.id || idx} className="bg-red-50 dark:bg-red-950/20 p-1 rounded text-center border border-red-200/50 dark:border-red-900/30">
                          <span className="block font-bold">{evt.date}</span>
                          <span className="text-red-500">{evt.runningBalance?.toLocaleString()}원</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Table Control (Tab & Search) */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2">
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors border ${
                  activeTab === 'all'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-light-card dark:bg-dark-card text-light-text dark:text-dark-text border-gray-200 dark:border-slate-700 hover:bg-gray-50'
                }`}
              >
                전체 거래 흐름 ({ledger.length})
              </button>
              
              <button
                onClick={() => setActiveTab('duplicates')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors border flex items-center gap-1.5 ${
                  activeTab === 'duplicates'
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-light-card dark:bg-dark-card text-light-text dark:text-dark-text border-gray-200 dark:border-slate-700 hover:bg-gray-50'
                }`}
              >
                <span>중복의심 내역</span>
                {(suspiciousTransactions.length > 0 || suspiciousTrades.length > 0) && (
                  <span className="px-1.5 py-0.5 bg-red-600 text-[10px] text-white rounded-full font-bold">
                    {Math.floor((suspiciousTransactions.length + suspiciousTrades.length) / 2)}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('negatives')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors border flex items-center gap-1.5 ${
                  activeTab === 'negatives'
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-light-card dark:bg-dark-card text-light-text dark:text-dark-text border-gray-200 dark:border-slate-700 hover:bg-gray-50'
                }`}
              >
                <span>예수금 마이너스 시점</span>
                {negativeEvents.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-amber-600 text-[10px] text-white rounded-full font-bold">
                    {negativeEvents.length}
                  </span>
                )}
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="검색 (날짜, 종목명, 내용)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 pl-8 text-xs bg-light-card dark:bg-dark-card text-light-text dark:text-dark-text border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔍</span>
            </div>
          </div>

          {/* Combined Ledger Table */}
          <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden bg-light-card dark:bg-dark-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 text-light-secondary dark:text-dark-secondary font-semibold">
                    <th className="p-3 font-mono">No.</th>
                    <th className="p-3 font-mono">거래 일자</th>
                    <th className="p-3">거래 유형</th>
                    <th className="p-3">세부 내역 및 종목명</th>
                    <th className="p-3 text-right">거래 원금</th>
                    <th className="p-3 text-right">정산 수수료/세금</th>
                    <th className="p-3 text-right">예수금 변동액</th>
                    <th className="p-3 text-right font-mono bg-blue-500/5 dark:bg-blue-400/5">누적 예수금 잔고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-light-secondary dark:text-dark-secondary">
                        조회할 거래 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((item, idx) => {
                      const isDup =
                        activeTab !== 'duplicates' &&
                        ((item.type === 'buy' || item.type === 'sell'
                          ? suspiciousTrades.some(t => t.id === item.id.replace('trade_', ''))
                          : suspiciousTransactions.some(t => t.id === item.id.replace('tx_', ''))));

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors ${
                            isDup ? 'bg-red-500/5 dark:bg-red-400/5 border-l-2 border-l-red-500' : ''
                          }`}
                        >
                          <td className="p-3 font-mono text-light-secondary dark:text-dark-secondary">
                            {idx + 1}
                          </td>
                          <td className="p-3 font-mono font-medium text-light-text dark:text-dark-text">
                            {item.date}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getBadgeStyle(item.type)}`}>
                              {getTypeText(item.type)}
                            </span>
                          </td>
                          <td className="p-3 max-w-xs truncate font-medium text-light-text dark:text-dark-text" title={item.label}>
                            {item.label}
                          </td>
                          <td className="p-3 text-right font-mono text-light-secondary dark:text-dark-secondary">
                            {item.type === 'historical_pnl' ? '-' : item.amount.toLocaleString() + '원'}
                          </td>
                          <td className="p-3 text-right font-mono text-light-secondary dark:text-dark-secondary">
                            {item.fee !== undefined || item.tax !== undefined ? (
                              <span title={`수수료: ${item.fee?.toLocaleString()}원 / 거래세: ${item.tax?.toLocaleString()}원`}>
                                {(((item.fee || 0) + (item.tax || 0)) > 0)
                                  ? `${Math.round((item.fee || 0) + (item.tax || 0)).toLocaleString()}원`
                                  : '-'}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className={`p-3 text-right font-mono font-bold ${item.cashEffect >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {item.cashEffect >= 0 ? '+' : ''}
                            {item.cashEffect.toLocaleString()}원
                          </td>
                          <td
                            className={`p-3 text-right font-mono font-bold bg-blue-500/5 dark:bg-blue-400/5 ${
                              (item.runningBalance || 0) < 0 ? 'text-red-500 dark:text-red-400 bg-red-500/5' : 'text-light-text dark:text-dark-text'
                            }`}
                          >
                            {item.runningBalance?.toLocaleString()}원
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-light-text text-white dark:bg-dark-text dark:text-dark-card rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>,
    modalRoot
  );
};

export default DepositBreakdownModal;
