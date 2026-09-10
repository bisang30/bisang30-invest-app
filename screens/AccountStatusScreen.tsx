
import React, { useMemo, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { Account, Broker, Trade, AccountTransaction, TransactionType, Screen, BankAccount, Stock, TradeType, HistoricalGain, FeeSettings } from '../types';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, WalletIcon, IdentificationIcon, ChevronDownIcon, ChevronUpIcon, ArrowsUpDownIcon } from '../components/Icons';
import { calculateTradeFeeAndTax, calculateAccountCashBalance, sortTradesForProcessing } from '../services/feeService';
import DepositBreakdownModal from '../components/DepositBreakdownModal';
import AccountOrderModal from '../components/AccountOrderModal';


interface AccountStatusScreenProps {
  accounts: Account[];
  setAccounts?: React.Dispatch<React.SetStateAction<Account[]>>;
  brokers: Broker[];
  trades: Trade[];
  transactions: AccountTransaction[];
  setTransactions: React.Dispatch<React.SetStateAction<AccountTransaction[]>>;
  setCurrentScreen: (screen: Screen) => void;
  bankAccounts: BankAccount[];
  stocks: Stock[];
  stockPrices: { [key: string]: number };
  historicalGains: HistoricalGain[];
  feeSettings?: FeeSettings;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);

const formatNumber = (value: number | string): string => {
  if (value === '' || value === null || value === undefined || Number(value) === 0) return '';
  const num = Number(String(value).replace(/,/g, ''));
  if (isNaN(num)) return '';
  return num.toLocaleString('ko-KR');
};

const AccountStatusScreen: React.FC<AccountStatusScreenProps> = ({ 
  accounts, setAccounts, brokers, trades, transactions, setTransactions, setCurrentScreen, bankAccounts, stocks, stockPrices, historicalGains, feeSettings
}) => {
  const brokerMap = useMemo(() => new Map((brokers || []).map(b => [b.id, b.name])), [brokers]);
  const stockMap = useMemo(() => new Map((stocks || []).map(s => [s.id, s])), [stocks]);
  const securityAccountIds = useMemo(() => new Set((accounts || []).map(a => a.id)), [accounts]);

  // Sorted accounts based on account.order if specified, otherwise preserving current array sequence
  const sortedAccounts = useMemo(() => {
    return [...(accounts || [])].sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : 999999;
      const orderB = typeof b.order === 'number' ? b.order : 999999;
      if (orderA !== orderB) return orderA - orderB;
      return 0;
    });
  }, [accounts]);

  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState<Omit<AccountTransaction, 'id'>>({
    date: new Date().toISOString().split('T')[0],
    accountId: (sortedAccounts || [])[0]?.id || '',
    amount: 0,
    transactionType: TransactionType.Deposit,
    counterpartyAccountId: undefined,
    memo: '',
  });
  
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);
  const [selectedAccountForBreakdown, setSelectedAccountForBreakdown] = useState<Account | null>(null);

  const handleToggleExpand = (accountId: string) => {
    setExpandedAccountId(prevId => (prevId === accountId ? null : accountId));
  };

  const handleSaveOrder = (newAccounts: Account[]) => {
    if (setAccounts) {
      setAccounts(newAccounts);
    }
  };

  const handleQuickMove = (index: number, direction: -1 | 1) => {
    if (!setAccounts) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sortedAccounts.length) return;

    const newAccounts = [...sortedAccounts];
    const temp = newAccounts[index];
    newAccounts[index] = newAccounts[targetIndex];
    newAccounts[targetIndex] = temp;

    const withOrder = newAccounts.map((acc, idx) => ({
      ...acc,
      order: idx + 1,
    }));
    setAccounts(withOrder);
  };

  const accountDetails = useMemo(() => {
    const order = feeSettings?.sameDayTradeOrder || 'buyFirst';
    return sortedAccounts.map(account => {
      const accountTrades = sortTradesForProcessing(
        (trades || []).filter(t => t.accountId === account.id),
        order
      );
      
      const accountHoldingsMap: { [stockId: string]: { quantity: number; totalCost: number } } = {};
      accountTrades.forEach(trade => {
          if (!trade.stockId) return;
          if (!accountHoldingsMap[trade.stockId]) {
            accountHoldingsMap[trade.stockId] = { quantity: 0, totalCost: 0 };
          }
          const quantity = Number(trade.quantity) || 0;
          const price = Number(trade.price) || 0;

          if (trade.tradeType === TradeType.Buy) {
            accountHoldingsMap[trade.stockId].quantity += quantity;
            accountHoldingsMap[trade.stockId].totalCost += quantity * price;
          } else {
            const avgCost = accountHoldingsMap[trade.stockId].quantity > 0 ? accountHoldingsMap[trade.stockId].totalCost / accountHoldingsMap[trade.stockId].quantity : 0;
            accountHoldingsMap[trade.stockId].quantity -= quantity;
            accountHoldingsMap[trade.stockId].totalCost -= quantity * avgCost;
            if (accountHoldingsMap[trade.stockId].quantity < 1e-9) {
                accountHoldingsMap[trade.stockId].quantity = 0;
                accountHoldingsMap[trade.stockId].totalCost = 0;
            }
          }
      });
      
      let stockValue = 0;
      const detailedHoldings = Object.entries(accountHoldingsMap)
        .filter(([, data]) => data.quantity > 1e-9)
        .map(([stockId, data]) => {
          const stock = stockMap.get(stockId);
          if (!stock) return null;
          const currentPrice = stockPrices[stock.ticker] || 0;
          const currentValue = data.quantity * currentPrice;
          stockValue += currentValue;

          const avgPrice = data.quantity > 0 ? data.totalCost / data.quantity : 0;
          const profitLoss = currentValue - data.totalCost;
          const profitLossRate = data.totalCost > 0 ? (profitLoss / data.totalCost) * 100 : 0;
          
          return {
            stockId,
            stockName: stock.name,
            quantity: data.quantity,
            avgPrice,
            currentPrice,
            currentValue,
            profitLoss,
            profitLossRate,
          };
        }).filter((item): item is NonNullable<typeof item> => item !== null)
          .sort((a, b) => b.currentValue - a.currentValue);

      let netDeposits = 0;
      (transactions || []).forEach(t => {
        const amount = Number(t.amount) || 0;
        if (
          (t.accountId === account.id && t.transactionType === TransactionType.Deposit) ||
          (t.counterpartyAccountId === account.id && t.transactionType === TransactionType.Withdrawal)
        ) {
          netDeposits += amount;
        } else if (
          (t.accountId === account.id && t.transactionType === TransactionType.Withdrawal) ||
          (t.counterpartyAccountId === account.id && t.transactionType === TransactionType.Deposit)
        ) {
          netDeposits -= amount;
        }
      });
      
      const cashBalance = calculateAccountCashBalance(
        account,
        trades,
        transactions,
        historicalGains,
        feeSettings,
        stockMap
      );
      const totalValue = cashBalance + stockValue;
      const profitLoss = totalValue - netDeposits;
      const returnRate = netDeposits !== 0 ? (profitLoss / netDeposits) * 100 : 0;
      
      return {
        ...account,
        brokerName: brokerMap.get(account.brokerId) || '알 수 없음',
        netDeposits,
        cashBalance,
        stockValue,
        totalValue,
        profitLoss,
        returnRate,
        holdings: detailedHoldings,
      };
    });
  }, [sortedAccounts, brokers, trades, transactions, stocks, stockPrices, brokerMap, stockMap, historicalGains, securityAccountIds, feeSettings]);

  const accountValuesMap = useMemo(() => {
    const map: { [id: string]: number } = {};
    (accountDetails || []).forEach(acc => {
      map[acc.id] = acc.totalValue;
    });
    return map;
  }, [accountDetails]);
  
  const totalSummary = useMemo(() => {
    const summary = {
        totalStockValue: 0,
        totalCashBalance: 0,
        totalNetDeposits: 0,
        totalAssets: 0,
        ytdNetDeposits: 0,
    };

    if (!accountDetails || accountDetails.length === 0) {
        return summary;
    }

    accountDetails.forEach(account => {
        summary.totalStockValue += account.stockValue;
        summary.totalCashBalance += account.cashBalance;
        summary.totalAssets += account.totalValue;
    });

    summary.totalNetDeposits = (transactions || []).reduce((acc, t) => {
        if (t.transactionType === TransactionType.Dividend) return acc;
        if (t.counterpartyAccountId && securityAccountIds.has(t.counterpartyAccountId)) return acc;
        const amount = Number(t.amount) || 0;
        if (t.transactionType === TransactionType.Deposit) return acc + amount;
        if (t.transactionType === TransactionType.Withdrawal) return acc - amount;
        return acc;
    }, 0);

    const currentYear = new Date().getFullYear();
    summary.ytdNetDeposits = (transactions || []).reduce((acc, t) => {
        const transactionYear = new Date(t.date).getFullYear();
        if (transactionYear !== currentYear) return acc;
        if (t.transactionType === TransactionType.Dividend) return acc;
        if (t.counterpartyAccountId && securityAccountIds.has(t.counterpartyAccountId)) return acc;
        const amount = Number(t.amount) || 0;
        if (t.transactionType === TransactionType.Deposit) return acc + amount;
        if (t.transactionType === TransactionType.Withdrawal) return acc - amount;
        return acc;
    }, 0);

    return summary;
  }, [accountDetails, transactions, securityAccountIds]);

  
  const handleTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = Number(newTransaction.amount);
    if (isNaN(amount)) {
      alert('금액에 유효한 숫자를 입력해주세요.');
      return;
    }

    if (!newTransaction.accountId || amount <= 0) {
      alert('계좌와 금액을 올바르게 입력해주세요.');
      return;
    }
    setTransactions(prev => [{
      ...newTransaction,
      amount,
      memo: newTransaction.memo?.trim() || undefined,
      id: Date.now().toString()
    }, ...(prev || [])]);
    setNewTransaction({
      date: new Date().toISOString().split('T')[0],
      accountId: (sortedAccounts || [])[0]?.id || '',
      amount: 0,
      transactionType: TransactionType.Deposit,
      counterpartyAccountId: undefined,
      memo: '',
    });
    setIsTxModalOpen(false);
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-light-text dark:text-dark-text">
              등록 계좌 ({accountDetails.length}개)
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5 items-center justify-end">
            {setAccounts && (
              <Button 
                onClick={() => setIsReorderModalOpen(true)} 
                variant="secondary"
                className="flex items-center gap-1.5 text-xs sm:text-sm"
              >
                <ArrowsUpDownIcon className="w-4 h-4 text-blue-500" />
                <span>계좌 순서 변경</span>
              </Button>
            )}
            <Button onClick={() => setIsTxModalOpen(true)}>입출금 기록</Button>
            <Button onClick={() => setCurrentScreen(Screen.AccountTransactions)} variant="secondary">
              입출금 히스토리
            </Button>
          </div>
        </div>
      </Card>
      
      <Card>
        <h2 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text flex items-center gap-3">
          <WalletIcon className="w-7 h-7 text-blue-500" />
          <span>전체 계좌 요약</span>
        </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                  <p className="text-sm text-light-secondary dark:text-dark-secondary">총 자산</p>
                  <p className="text-xl font-bold text-light-primary dark:text-dark-primary">{formatCurrency(totalSummary.totalAssets)}</p>
              </div>
              <div>
                  <p className="text-sm text-light-secondary dark:text-dark-secondary">주식 평가액</p>
                  <p className="text-xl font-bold text-light-text dark:text-dark-text">{formatCurrency(totalSummary.totalStockValue)}</p>
              </div>
              <div>
                  <p className="text-sm text-light-secondary dark:text-dark-secondary">예수금(CMA포함)</p>
                  <p className="text-xl font-bold text-light-text dark:text-dark-text">{formatCurrency(totalSummary.totalCashBalance)}</p>
              </div>
              <div>
                  <p className="text-sm text-light-secondary dark:text-dark-secondary">순입금액 (원금)</p>
                  <p className="text-xl font-bold text-light-text dark:text-dark-text">{formatCurrency(totalSummary.totalNetDeposits)}</p>
                  <p className="text-xs text-light-secondary dark:text-dark-secondary mt-1">올해: {formatCurrency(totalSummary.ytdNetDeposits)}</p>
              </div>
          </div>
      </Card>

      {accountDetails.length === 0 ? (
        <Card>
            <p className="text-center text-light-secondary dark:text-dark-secondary">표시할 계좌가 없습니다.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {accountDetails.map((account, index) => (
                <Card key={account.id} className="p-0 overflow-hidden flex flex-col justify-between shadow-lg">
                    <div 
                      className="p-4 sm:p-5 bg-gradient-to-br from-blue-50 to-white dark:from-slate-800/70 dark:to-dark-card cursor-pointer"
                      onClick={() => handleToggleExpand(account.id)}
                    >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="relative shrink-0">
                              <div className="p-2 bg-light-card dark:bg-dark-card rounded-lg shadow">
                                  <IdentificationIcon className="w-6 h-6 text-blue-500" />
                              </div>
                              <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                                {index + 1}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="text-lg font-bold text-light-text dark:text-dark-text">{account.name}</h3>
                                {account.accountType && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                    {account.accountType}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-light-secondary dark:text-dark-secondary">{account.brokerName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {setAccounts && (
                              <div className="flex items-center bg-white/90 dark:bg-slate-800/90 rounded-lg p-0.5 border border-gray-200/80 dark:border-slate-700/80 shadow-2xs" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickMove(index, -1);
                                  }}
                                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-25 disabled:hover:bg-transparent text-light-text dark:text-dark-text cursor-pointer disabled:cursor-not-allowed"
                                  title="계좌 한 칸 위로"
                                >
                                  <ChevronUpIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={index === accountDetails.length - 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickMove(index, 1);
                                  }}
                                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-25 disabled:hover:bg-transparent text-light-text dark:text-dark-text cursor-pointer disabled:cursor-not-allowed"
                                  title="계좌 한 칸 아래로"
                                >
                                  <ChevronDownIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => handleToggleExpand(account.id)}
                              className="p-1 rounded-lg text-light-secondary dark:text-dark-secondary hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
                              title="상세 펼치기/접기"
                            >
                              {expandedAccountId === account.id ? <ChevronUpIcon className="w-5 h-5"/> : <ChevronDownIcon className="w-5 h-5"/>}
                            </button>
                          </div>
                        </div>
                        
                        <p className="text-xs font-medium text-light-secondary dark:text-dark-secondary">총 평가금액</p>
                        <p className="text-3xl font-extrabold text-light-primary dark:text-dark-primary tracking-tight">{formatCurrency(account.totalValue)}</p>

                        <div className={`flex items-center mt-2 text-lg font-semibold ${account.profitLoss >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {account.profitLoss >= 0 ? <ArrowTrendingUpIcon className="w-5 h-5 mr-1"/> : <ArrowTrendingDownIcon className="w-5 h-5 mr-1"/>}
                            <span>{account.profitLoss >= 0 ? '+' : ''}{formatCurrency(account.profitLoss)}</span>
                            <span className="text-base ml-2 opacity-90">({account.returnRate.toFixed(2)}%)</span>
                        </div>
                    </div>
                    <div className="p-4 sm:p-5 bg-light-card dark:bg-dark-card border-t border-gray-200/50 dark:border-slate-700/50">
                      <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                              <span className="text-light-secondary dark:text-dark-secondary">주식 평가액</span>
                              <span className="font-medium text-light-text dark:text-dark-text">{formatCurrency(account.stockValue)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1.5">
                                <span className="text-light-secondary dark:text-dark-secondary">예수금</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAccountForBreakdown(account as any);
                                    setIsBreakdownModalOpen(true);
                                  }}
                                  className="text-[11px] text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline cursor-pointer bg-transparent border-none p-0 inline-flex items-center"
                                  title="예수금 산출 및 오류 진단 내역 조회"
                                >
                                  (상세 내역)
                                </button>
                              </div>
                              <span className="font-medium text-light-text dark:text-dark-text">{formatCurrency(account.cashBalance)}</span>
                          </div>
                           <div className="flex justify-between mt-3 pt-3 border-t border-dashed border-gray-200/80 dark:border-slate-700/50">
                              <span className="text-light-secondary dark:text-dark-secondary font-semibold">순입금액 (원금)</span>
                              <span className="font-semibold text-light-text dark:text-dark-text">{formatCurrency(account.netDeposits)}</span>
                          </div>
                      </div>
                    </div>
                    {expandedAccountId === account.id && (
                      <div className="p-4 bg-gray-50 dark:bg-dark-bg/50 border-t border-gray-200/80 dark:border-slate-700">
                        <h4 className="font-semibold mb-3 text-light-text dark:text-dark-text">보유 종목 상세</h4>
                        {account.holdings.length > 0 ? (
                          <div className="space-y-3">
                            {account.holdings.map(holding => (
                              <div key={holding.stockId} className="text-xs p-3 bg-light-card dark:bg-dark-card rounded-md shadow-sm">
                                <div className="flex justify-between items-center font-bold">
                                  <span>{holding.stockName}</span>
                                  <span className={holding.profitLoss >= 0 ? 'text-profit' : 'text-loss'}>
                                    {holding.profitLossRate.toFixed(2)}%
                                  </span>
                                </div>
                                <div className="flex justify-between items-center mt-1 text-light-secondary dark:text-dark-secondary">
                                  <span>수량: {holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                  <span className={holding.profitLoss >= 0 ? 'text-profit' : 'text-loss'}>
                                    {formatCurrency(holding.profitLoss)}
                                  </span>
                                </div>
                                <div className="mt-2 pt-2 border-t border-dashed border-gray-200/50 dark:border-slate-700/50 space-y-1">
                                  <div className="flex justify-between"><span>평가금액:</span> <span className="font-medium text-light-text dark:text-dark-text">{formatCurrency(holding.currentValue)}</span></div>
                                  <div className="flex justify-between"><span>평단가:</span> <span>{formatCurrency(holding.avgPrice)}</span></div>
                                  <div className="flex justify-between"><span>현재가:</span> <span>{formatCurrency(holding.currentPrice)}</span></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-sm text-light-secondary dark:text-dark-secondary py-4">보유 주식이 없습니다.</p>
                        )}
                      </div>
                    )}
                </Card>
            ))}
        </div>
      )}
        
      <Modal isOpen={isTxModalOpen} onClose={() => setIsTxModalOpen(false)} title="입출금 기록 추가">
        <form onSubmit={handleTxSubmit} className="space-y-4">
          <Input label="일자" id="date" name="date" type="date" value={newTransaction.date} onChange={(e) => setNewTransaction(p => ({...p, date: e.target.value}))} required />
          <Select label="계좌" id="accountId" name="accountId" value={newTransaction.accountId} onChange={(e) => setNewTransaction(p => ({...p, accountId: e.target.value}))} required>
            {(accounts || []).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
          </Select>
           <Select label="입금/출금" id="transactionType" name="transactionType" value={newTransaction.transactionType} onChange={(e) => setNewTransaction(p => ({...p, transactionType: e.target.value as TransactionType}))} required>
            <option value={TransactionType.Deposit}>입금</option>
            <option value={TransactionType.Withdrawal}>출금</option>
          </Select>
          <Input label="금액" id="amount" name="amount" type="text" inputMode="numeric" value={formatNumber(newTransaction.amount)} onChange={(e) => {
              const numValue = parseFloat(e.target.value.replace(/,/g, ''));
              setNewTransaction(p => ({...p, amount: isNaN(numValue) ? 0 : numValue}));
            }} required />
          <Select label="상대계좌 (선택)" id="counterpartyAccountId" name="counterpartyAccountId" value={newTransaction.counterpartyAccountId || ''} onChange={(e) => setNewTransaction(p => ({...p, counterpartyAccountId: e.target.value || undefined}))}>
            <option value="">없음 (외부 입출금)</option>
            <optgroup label="증권계좌">
              {(accounts || []).filter(acc => acc.id !== newTransaction.accountId).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
            </optgroup>
            <optgroup label="은행계좌">
              {(bankAccounts || []).map(bacc => <option key={bacc.id} value={bacc.id}>{bacc.bankName} {bacc.name}</option>)}
            </optgroup>
          </Select>
          <Input
            label="메모 (선택)"
            id="newTxMemo"
            name="memo"
            type="text"
            placeholder="간단한 메모를 입력하세요 (예: 월급 입금, 적금 만기 등)"
            value={newTransaction.memo || ''}
            onChange={(e) => setNewTransaction(p => ({...p, memo: e.target.value}))}
          />
          <div className="flex justify-end pt-4">
            <Button type="submit">완료</Button>
          </div>
        </form>
      </Modal>

      {selectedAccountForBreakdown && (
        <DepositBreakdownModal
          isOpen={isBreakdownModalOpen}
          onClose={() => {
            setIsBreakdownModalOpen(false);
            setSelectedAccountForBreakdown(null);
          }}
          account={selectedAccountForBreakdown}
          trades={trades}
          transactions={transactions}
          stocks={stocks}
          historicalGains={historicalGains}
          feeSettings={feeSettings || {
            buyFeeRate: 0.0036,
            sellFeeRate: 0.0036,
            stockTaxRate: 0.2,
            etfTaxRate: 0,
            stockDividendTaxRate: 0,
            etfDividendTaxRate: 15.4,
          }}
        />
      )}

      <AccountOrderModal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        accounts={sortedAccounts}
        brokers={brokers}
        accountValues={accountValuesMap}
        onSaveOrder={handleSaveOrder}
      />
    </div>
  );
};

export default AccountStatusScreen;
