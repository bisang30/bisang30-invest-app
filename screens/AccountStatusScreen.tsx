
import React, { useMemo, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { Account, Broker, Trade, AccountTransaction, TransactionType, Screen, BankAccount, Stock, TradeType, HistoricalGain } from '../types';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, WalletIcon, IdentificationIcon, ChevronDownIcon, ChevronUpIcon } from '../components/Icons';


interface AccountStatusScreenProps {
  accounts: Account[];
  brokers: Broker[];
  trades: Trade[];
  transactions: AccountTransaction[];
  setTransactions: React.Dispatch<React.SetStateAction<AccountTransaction[]>>;
  setCurrentScreen: (screen: Screen) => void;
  bankAccounts: BankAccount[];
  stocks: Stock[];
  stockPrices: { [key: string]: number };
  historicalGains: HistoricalGain[];
}

const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);

const formatNumber = (value: number | string): string => {
  if (value === '' || value === null || value === undefined || Number(value) === 0) return '';
  const num = Number(String(value).replace(/,/g, ''));
  if (isNaN(num)) return '';
  return num.toLocaleString('ko-KR');
};

const AccountStatusScreen: React.FC<AccountStatusScreenProps> = ({ 
  accounts, brokers, trades, transactions, setTransactions, setCurrentScreen, bankAccounts, stocks, stockPrices, historicalGains
}) => {
  const brokerMap = useMemo(() => new Map((brokers || []).map(b => [b.id, b.name])), [brokers]);
  const stockMap = useMemo(() => new Map((stocks || []).map(s => [s.id, s])), [stocks]);
  const securityAccountIds = useMemo(() => new Set((accounts || []).map(a => a.id)), [accounts]);
  
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState<Omit<AccountTransaction, 'id'>>({
    date: new Date().toISOString().split('T')[0],
    accountId: (accounts || [])[0]?.id || '',
    amount: 0,
    transactionType: TransactionType.Deposit,
    counterpartyAccountId: undefined,
  });
  
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);

  const handleToggleExpand = (accountId: string) => {
    setExpandedAccountId(prevId => (prevId === accountId ? null : accountId));
  };


  const accountDetails = useMemo(() => {
    return (accounts || []).map(account => {
      const accountTrades = (trades || [])
        .filter(t => t.accountId === account.id)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
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

      const totalBuyCost = accountTrades.filter(t => t.tradeType === 'BUY').reduce((sum, t) => sum + (Number(t.price) || 0) * (Number(t.quantity) || 0), 0);
      const totalSellProceeds = accountTrades.filter(t => t.tradeType === 'SELL').reduce((sum, t) => sum + (Number(t.price) || 0) * (Number(t.quantity) || 0), 0);

      let netDeposits = 0;
      let netCashFromTransactions = 0;
      (transactions || []).forEach(t => {
        const amount = Number(t.amount) || 0;
        if ((t.accountId === account.id && (t.transactionType === TransactionType.Deposit || t.transactionType === TransactionType.Dividend)) || (t.counterpartyAccountId === account.id && t.transactionType === TransactionType.Withdrawal)) {
          netCashFromTransactions += amount;
          if (t.transactionType !== TransactionType.Dividend) netDeposits += amount;
        } else if ((t.accountId === account.id && t.transactionType === TransactionType.Withdrawal) || (t.counterpartyAccountId === account.id && t.transactionType === TransactionType.Deposit)) {
          netCashFromTransactions -= amount;
          netDeposits -= amount;
        }
      });
      
      const historicalPnlForAccount = (historicalGains || []).filter(g => g.accountId === account.id).reduce((sum, g) => sum + (Number(g.realizedPnl) || 0), 0);
      const cashBalance = netCashFromTransactions + totalSellProceeds - totalBuyCost + historicalPnlForAccount;
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
  }, [accounts, brokers, trades, transactions, stocks, stockPrices, brokerMap, stockMap, historicalGains, securityAccountIds]);
  
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
    setTransactions(prev => [{ ...newTransaction, amount, id: Date.now().toString() }, ...(prev || [])]);
    setIsTxModalOpen(false);
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row gap-4 justify-end">
          <Button onClick={() => setIsTxModalOpen(true)}>입출금 기록</Button>
          <Button onClick={() => setCurrentScreen(Screen.AccountTransactions)} variant="secondary">
            입출금 히스토리
          </Button>
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
            {accountDetails.map(account => (
                <Card key={account.id} className="p-0 overflow-hidden flex flex-col justify-between shadow-lg">
                    <div 
                      className="p-4 sm:p-5 bg-gradient-to-br from-blue-50 to-white dark:from-slate-800/70 dark:to-dark-card cursor-pointer"
                      onClick={() => handleToggleExpand(account.id)}
                    >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-light-card dark:bg-dark-card rounded-lg shadow">
                                <IdentificationIcon className="w-6 h-6 text-blue-500" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-light-text dark:text-dark-text">{account.name}</h3>
                              <p className="text-sm text-light-secondary dark:text-dark-secondary">{account.brokerName}</p>
                            </div>
                          </div>
                          {expandedAccountId === account.id ? <ChevronUpIcon className="w-6 h-6"/> : <ChevronDownIcon className="w-6 h-6"/>}
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
                          <div className="flex justify-between">
                              <span className="text-light-secondary dark:text-dark-secondary">예수금</span>
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
          <div className="flex justify-end pt-4">
            <Button type="submit">완료</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AccountStatusScreen;
