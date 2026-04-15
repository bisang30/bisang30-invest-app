import React, { useState, useEffect, useMemo, useRef } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import { Broker, Account, Stock, InitialPortfolio, PortfolioCategory, Trade, AccountTransaction, BankAccount, Theme, TradeType, TransactionType, MonthlyAccountValue, HistoricalGain, AlertThresholds, Screen, InvestmentGoal } from '../types';
import { PORTFOLIO_CATEGORIES, DATA_VERSION } from '../constants';
import { exportAllData } from '../services/exportService';
import * as XLSX from 'xlsx';
import { 
  ChevronUpIcon, ChevronDownIcon, BuildingOffice2Icon, IdentificationIcon, BuildingLibraryIcon,
  ChartBarIcon, ChartPieIcon, CircleStackIcon, LockClosedIcon, Cog8ToothIcon, BellAlertIcon, FlagIcon
} from '../components/Icons';

const findValidXlsxLibrary = (mod: any): any | null => {
  const isValid = (lib: any) =>
    lib &&
    typeof lib.utils?.book_new === 'function' &&
    typeof lib.writeFile === 'function';

  if (isValid(mod)) return mod;
  
  const queue = [mod];
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || typeof current !== 'object' || visited.has(current)) {
      continue;
    }
    visited.add(current);
    
    if (isValid(current)) {
      return current;
    }

    for (const key in current) {
      if (Object.prototype.hasOwnProperty.call(current, key)) {
        queue.push(current[key]);
      }
    }
  }
  
  if (isValid((window as any).XLSX)) {
    return (window as any).XLSX;
  }

  return null;
};


interface StockFormState extends Omit<Stock, 'id' | 'expenseRatio'> {
  expenseRatio: string;
}

const formatNumber = (value: number | string): string => {
  if (value === '' || value === null || value === undefined || Number(value) === 0) return '';
  const num = Number(String(value).replace(/,/g, ''));
  if (isNaN(num)) return '';
  return num.toLocaleString('ko-KR');
};

interface IndexScreenProps {
  appVersion: string;
  brokers: Broker[];
  setBrokers: React.Dispatch<React.SetStateAction<Broker[]>>;
  accounts: Account[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  bankAccounts: BankAccount[];
  setBankAccounts: React.Dispatch<React.SetStateAction<BankAccount[]>>;
  stocks: Stock[];
  setStocks: React.Dispatch<React.SetStateAction<Stock[]>>;
  trades: Trade[];
  transactions: AccountTransaction[];
  initialPortfolio: InitialPortfolio;
  setInitialPortfolio: React.Dispatch<React.SetStateAction<InitialPortfolio>>;
  password: string | null;
  setPassword: React.Dispatch<React.SetStateAction<string | null>>;
  setIsDataOperationInProgress: React.Dispatch<React.SetStateAction<boolean>>;
  onForceRemount: () => void;
  backgroundFetchInterval: number;
  setBackgroundFetchInterval: React.Dispatch<React.SetStateAction<number>>;
  monthlyValues: MonthlyAccountValue[];
  setMonthlyValues: React.Dispatch<React.SetStateAction<MonthlyAccountValue[]>>;
  showSummary: boolean;
  setShowSummary: React.Dispatch<React.SetStateAction<boolean>>;
  historicalGains: HistoricalGain[];
  alertThresholds: AlertThresholds;
  setAlertThresholds: React.Dispatch<React.SetStateAction<AlertThresholds>>;
  homeScreenPreference: 'HOME' | 'HOLDINGS_STATUS';
  setHomeScreenPreference: React.Dispatch<React.SetStateAction<'HOME' | 'HOLDINGS_STATUS'>>;
  investmentGoals: InvestmentGoal[];
  setInvestmentGoals: React.Dispatch<React.SetStateAction<InvestmentGoal[]>>;
}

interface SettingsSectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ title, icon, isOpen, onToggle, children }) => {
  return (
    <div className="bg-light-card dark:bg-dark-card rounded-xl shadow-md transition-all duration-300 ease-in-out border border-gray-200/50 dark:border-slate-700/50">
      <button
        onClick={onToggle}
        className={`w-full flex justify-between items-center p-4 text-left font-semibold transition-colors duration-300 rounded-t-xl ${isOpen ? 'bg-blue-50 dark:bg-blue-900/20 rounded-b-none' : 'rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60'}`}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <span>{icon}</span>
          <h2 className="text-lg text-light-text dark:text-dark-text">{title}</h2>
        </div>
        {isOpen 
          ? <ChevronUpIcon className="w-6 h-6 text-light-secondary dark:text-dark-secondary transform transition-transform" /> 
          : <ChevronDownIcon className="w-6 h-6 text-light-secondary dark:text-dark-secondary transform transition-transform" />}
      </button>
      <div
        className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[3000px]' : 'max-h-0'}`}
      >
        <div className="p-4 border-t border-gray-200/80 dark:border-slate-700">
          {children}
        </div>
      </div>
    </div>
  );
};


const IndexScreen: React.FC<IndexScreenProps> = ({
  appVersion,
  brokers, setBrokers,
  accounts, setAccounts,
  bankAccounts, setBankAccounts,
  stocks, setStocks,
  trades,
  transactions,
  initialPortfolio, setInitialPortfolio,
  password, setPassword,
  setIsDataOperationInProgress,
  onForceRemount,
  backgroundFetchInterval, setBackgroundFetchInterval,
  monthlyValues, setMonthlyValues,
  showSummary, setShowSummary,
  historicalGains,
  alertThresholds, setAlertThresholds,
  homeScreenPreference, setHomeScreenPreference,
  investmentGoals, setInvestmentGoals,
}) => {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');

  // Broker State
  const [isBrokerModalOpen, setIsBrokerModalOpen] = useState(false);
  const [editingBroker, setEditingBroker] = useState<Broker | null>(null);
  const [brokerFormName, setBrokerFormName] = useState('');

  // Account State
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountForm, setAccountForm] = useState({ name: '', brokerId: (brokers || [])[0]?.id || '' });

  // Bank Account State
  const [isBankAccountModalOpen, setIsBankAccountModalOpen] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);
  const [bankAccountForm, setBankAccountForm] = useState({ name: '', bankName: '' });

  // Stock management modal state
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [stockForm, setStockForm] = useState<StockFormState>({ ticker: '', name: '', category: PortfolioCategory.Stock, isPortfolio: false, isEtf: false, expenseRatio: '' });

  // Goal management modal state
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<InvestmentGoal | null>(null);
  const [goalForm, setGoalForm] = useState<Omit<InvestmentGoal, 'id' | 'targetShares'>>({ name: '', goalType: 'amount', targetAmount: 0, creationDate: new Date().toISOString().split('T')[0], targetDate: '' });
  const [goalTargetShares, setGoalTargetShares] = useState<{ [key: string]: string }>({});

  // Portfolio state
  const [isPortfolioEditing, setIsPortfolioEditing] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<{ [key: string]: string }>({});
  const [openPortfolioCategories, setOpenPortfolioCategories] = useState<Set<string>>(new Set());

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    confirmVariant: 'primary' | 'danger';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '확인',
    confirmVariant: 'primary',
    onConfirm: () => {},
  });
  
  // Data Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const importFileRef = useRef<File | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  
    // App Settings State
  const [localBackgroundInterval, setLocalBackgroundInterval] = useState(String(backgroundFetchInterval));
  
  const [editingThresholds, setEditingThresholds] = useState<AlertThresholds>(alertThresholds);
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
  
  useEffect(() => {
    setEditingThresholds(alertThresholds);
  }, [alertThresholds]);

  useEffect(() => {
    setLocalBackgroundInterval(String(backgroundFetchInterval));
  }, [backgroundFetchInterval]);

  const brokerMap = useMemo(() => new Map((brokers || []).map(b => [b.id, b.name])), [brokers]);
  const portfolioStocks = useMemo(() => (stocks || []).filter(s => s.isPortfolio), [stocks]);

  const toggleSection = (sectionId: string) => {
    setOpenSection(current => (current === sectionId ? null : sectionId));
  };

  const closeConfirmationModal = () => {
    setConfirmation({
      isOpen: false,
      title: '',
      message: '',
      confirmText: '확인',
      confirmVariant: 'primary',
      onConfirm: () => {},
    });
  };

  useEffect(() => {
    const safeBrokers = brokers || [];
    const selectedBrokerExists = safeBrokers.some(b => b.id === accountForm.brokerId);
    if (safeBrokers.length > 0 && (!accountForm.brokerId || !selectedBrokerExists)) {
      setAccountForm(prev => ({ ...prev, brokerId: safeBrokers[0].id }));
    } else if (safeBrokers.length === 0 && accountForm.brokerId) {
      setAccountForm(prev => ({ ...prev, brokerId: '' }));
    }
  }, [brokers, accountForm.brokerId]);
  
  // Broker Management Functions
  const openBrokerModal = (broker: Broker | null) => {
    if (broker) {
      setEditingBroker(broker);
      setBrokerFormName(broker.name);
    } else {
      setEditingBroker(null);
      setBrokerFormName('');
    }
    setIsBrokerModalOpen(true);
  };
  
  const closeBrokerModal = () => {
    setIsBrokerModalOpen(false);
    setEditingBroker(null);
    setBrokerFormName('');
  };

  const handleSaveBroker = () => {
    if (brokerFormName.trim()) {
      if (editingBroker) {
        setBrokers(prev => (prev || []).map(b => b.id === editingBroker.id ? { ...b, name: brokerFormName.trim() } : b));
      } else {
        setBrokers(prev => [...(prev || []), { id: Date.now().toString(), name: brokerFormName.trim() }]);
      }
      closeBrokerModal();
    } else {
      alert('증권사 이름을 입력해주세요.');
    }
  };

  const handleDeleteBroker = (brokerId: string) => {
    const brokerToDelete = (brokers || []).find(b => b.id === brokerId);
    if (!brokerToDelete) return;

    const accountsUsingBroker = (accounts || []).filter(acc => acc.brokerId === brokerId);
    if (accountsUsingBroker.length > 0) {
        const accountNames = accountsUsingBroker.map(acc => acc.name).join(', ');
        alert(`다음 계좌에서 사용 중이므로 이 증권사를 삭제할 수 없습니다: ${accountNames}`);
        return;
    }

    setConfirmation({
        isOpen: true,
        title: '증권사 삭제',
        message: `'${brokerToDelete.name}' 증권사를 삭제하시겠습니까?`,
        confirmText: '삭제',
        confirmVariant: 'danger',
        onConfirm: () => {
            setBrokers(prev => (prev || []).filter(b => b.id !== brokerId));
            closeConfirmationModal();
        }
    });
  };

  // Account Management Functions
  const openAccountModal = (account: Account | null) => {
    if (account) {
      setEditingAccount(account);
      setAccountForm({ name: account.name, brokerId: account.brokerId });
    } else {
      setEditingAccount(null);
      setAccountForm({ name: '', brokerId: (brokers || [])[0]?.id || '' });
    }
    setIsAccountModalOpen(true);
  };

  const closeAccountModal = () => {
    setIsAccountModalOpen(false);
    setEditingAccount(null);
  };

  const handleAccountFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAccountForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveAccount = () => {
    if (accountForm.name.trim() && accountForm.brokerId) {
      if (editingAccount) {
        setAccounts(prev => (prev || []).map(a => a.id === editingAccount.id ? { ...a, ...accountForm } : a));
      } else {
        setAccounts(prev => [...(prev || []), { ...accountForm, id: Date.now().toString() }]);
      }
      closeAccountModal();
    } else {
      alert('계좌 이름과 증권사를 선택해주세요.');
    }
  };

  const handleDeleteAccount = (accountId: string) => {
    const accountToDelete = (accounts || []).find(a => a.id === accountId);
    if (!accountToDelete) return;

    const isUsedInTrades = (trades || []).some(trade => trade.accountId === accountId);
    if (isUsedInTrades) {
      alert('이 계좌는 매매기록에서 사용 중이므로 삭제할 수 없습니다.');
      return;
    }

    const isUsedInTransactions = (transactions || []).some(
      tx => tx.accountId === accountId || tx.counterpartyAccountId === accountId
    );
    if (isUsedInTransactions) {
      alert('이 계좌는 입출금 기록에서 사용 중이므로 삭제할 수 없습니다.');
      return;
    }
    
    setConfirmation({
        isOpen: true,
        title: '계좌 삭제',
        message: `'${accountToDelete.name}' 계좌를 삭제하시겠습니까? 관련 기록은 삭제되지 않습니다.`,
        confirmText: '삭제',
        confirmVariant: 'danger',
        onConfirm: () => {
            setAccounts(prev => (prev || []).filter(a => a.id !== accountId));
            closeConfirmationModal();
        }
    });
  };

  // Bank Account Management Functions
  const openBankAccountModal = (bankAccount: BankAccount | null) => {
    if (bankAccount) {
      setEditingBankAccount(bankAccount);
      setBankAccountForm({ name: bankAccount.name, bankName: bankAccount.bankName });
    } else {
      setEditingBankAccount(null);
      setBankAccountForm({ name: '', bankName: '' });
    }
    setIsBankAccountModalOpen(true);
  };

  const closeBankAccountModal = () => {
    setIsBankAccountModalOpen(false);
    setEditingBankAccount(null);
  };

  const handleBankAccountFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBankAccountForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveBankAccount = () => {
    if (bankAccountForm.name.trim() && bankAccountForm.bankName.trim()) {
      if (editingBankAccount) {
        setBankAccounts(prev => (prev || []).map(a => a.id === editingBankAccount.id ? { ...a, ...bankAccountForm } : a));
      } else {
        setBankAccounts(prev => [...(prev || []), { ...bankAccountForm, id: Date.now().toString() }]);
      }
      closeBankAccountModal();
    } else {
      alert('은행명과 계좌 별명을 모두 입력해주세요.');
    }
  };

  const handleDeleteBankAccount = (bankAccountId: string) => {
    const bankAccountToDelete = (bankAccounts || []).find(a => a.id === bankAccountId);
    if (!bankAccountToDelete) return;

    setConfirmation({
        isOpen: true,
        title: '은행 계좌 삭제',
        message: `'${bankAccountToDelete.name}'(${bankAccountToDelete.bankName}) 계좌를 삭제하시겠습니까?`,
        confirmText: '삭제',
        confirmVariant: 'danger',
        onConfirm: () => {
            setBankAccounts(prev => (prev || []).filter(a => a.id !== bankAccountId));
            closeConfirmationModal();
        }
    });
  };

  // Stock management functions
  const openStockModal = (stock: Stock | null) => {
    if (stock) {
        setEditingStock(stock);
        setStockForm({ name: stock.name, ticker: stock.ticker, category: stock.category, isPortfolio: stock.isPortfolio || false, isEtf: stock.isEtf || false, expenseRatio: stock.expenseRatio ? String(stock.expenseRatio) : '' });
    } else {
        setEditingStock(null);
        setStockForm({ ticker: '', name: '', category: PortfolioCategory.Stock, isPortfolio: false, isEtf: false, expenseRatio: '' });
    }
    setIsStockModalOpen(true);
  };

  const closeStockModal = () => {
      setIsStockModalOpen(false);
      setEditingStock(null);
  };

  const handleStockFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked, name: checkboxName } = e.target as HTMLInputElement;
        setStockForm(prev => ({...prev, [checkboxName]: checked}));
    } else if (name === 'expenseRatio') {
      if (value === '' || /^\d*\.?\d*$/.test(value)) {
        setStockForm(prev => ({ ...prev, expenseRatio: value }));
      }
    } else {
        setStockForm(prev => ({ ...prev, [name]: name === 'ticker' ? value.toUpperCase() : value }));
    }
  };

  const handleSaveStock = () => {
    if (stockForm.ticker.trim() && stockForm.name.trim()) {
        const finalExpenseRatio = stockForm.isEtf ? (parseFloat(stockForm.expenseRatio) || 0) : undefined;
        const stockDataToSave = { ...stockForm, expenseRatio: finalExpenseRatio };
        
        if (editingStock) {
            const updatedStock = { ...editingStock, ...stockDataToSave };
            setStocks(prev => (prev || []).map(s => s.id === editingStock.id ? updatedStock : s));
            if (editingStock.isPortfolio && !updatedStock.isPortfolio) {
              setInitialPortfolio(prev => {
                  const newPortfolio = { ...(prev || {}) };
                  delete newPortfolio[editingStock.id];
                  return newPortfolio;
              });
            }
        } else {
            setStocks(prev => [...(prev || []), { ...stockDataToSave, id: Date.now().toString() }]);
        }
        closeStockModal();
    } else {
        alert('종목 티커와 종목명을 입력해주세요.');
    }
  };

  const handleDeleteStock = (stockId: string) => {
    const stockToDelete = (stocks || []).find(s => s.id === stockId);
    if (!stockToDelete) return;

    const tradesUsingStock = (trades || []).some(trade => trade.stockId === stockId);
    if (tradesUsingStock) {
        alert('이 종목은 매매기록에서 사용 중이므로 삭제할 수 없습니다. 해당 종목의 매매기록을 먼저 삭제해주세요.');
        return;
    }

    setConfirmation({
        isOpen: true,
        title: '종목 삭제',
        message: `'${stockToDelete.name}' 종목을 삭제하시겠습니까?`,
        confirmText: '삭제',
        confirmVariant: 'danger',
        onConfirm: () => {
            setStocks(prev => (prev || []).filter(s => s.id !== stockId));
            setInitialPortfolio(prev => {
                const newPortfolio = { ...(prev || {}) };
                delete newPortfolio[stockId];
                return newPortfolio;
            });
            closeConfirmationModal();
        }
    });
  };

  // Goal Management Functions
  const openGoalModal = (goal: InvestmentGoal | null) => {
    if (goal) {
      setEditingGoal(goal);
      setGoalForm({ 
        name: goal.name, 
        goalType: goal.goalType || 'amount', 
        targetAmount: goal.targetAmount || 0, 
        creationDate: goal.creationDate || new Date().toISOString().split('T')[0],
        targetDate: goal.targetDate || ''
      });
      const stringShares: { [key: string]: string } = {};
      if (goal.targetShares) {
        Object.keys(goal.targetShares).forEach(stockId => {
          stringShares[stockId] = String(goal.targetShares![stockId] || '');
        });
      }
      setGoalTargetShares(stringShares);
    } else {
      setEditingGoal(null);
      setGoalForm({ name: '', goalType: 'amount', targetAmount: 0, creationDate: new Date().toISOString().split('T')[0], targetDate: '' });
      setGoalTargetShares({});
    }
    setIsGoalModalOpen(true);
  };
  
  const closeGoalModal = () => {
    setIsGoalModalOpen(false);
    setEditingGoal(null);
  };

  const handleGoalFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'targetAmount') {
      const numValue = parseFloat(value.replace(/,/g, ''));
      setGoalForm(prev => ({ ...prev, [name]: isNaN(numValue) ? 0 : numValue }));
    } else {
      setGoalForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleGoalSharesChange = (stockId: string, value: string) => {
    if (value === '' || /^\d+$/.test(value)) {
      setGoalTargetShares(prev => ({ ...prev, [stockId]: value }));
    }
  };

  const handleSaveGoal = () => {
    if (!goalForm.name.trim()) {
      alert('목표 이름을 입력해주세요.');
      return;
    }

    let goalData: Partial<InvestmentGoal> = { 
      name: goalForm.name, 
      goalType: goalForm.goalType, 
      creationDate: goalForm.creationDate,
      targetDate: goalForm.targetDate || undefined
    };

    if (goalForm.goalType === 'amount') {
      if (goalForm.targetAmount! <= 0) {
        alert('목표 금액을 올바르게 입력해주세요.');
        return;
      }
      goalData.targetAmount = goalForm.targetAmount;
      goalData.targetShares = undefined;
    } else { // 'shares'
      const newTargetShares: { [stockId: string]: number } = {};
      for (const stockId in goalTargetShares) {
        const shares = parseInt(goalTargetShares[stockId], 10);
        if (!isNaN(shares) && shares > 0) {
          newTargetShares[stockId] = shares;
        }
      }
      if (Object.keys(newTargetShares).length === 0) {
        alert('목표 수량을 1개 이상 종목에 설정해주세요.');
        return;
      }
      goalData.targetShares = newTargetShares;
      goalData.targetAmount = undefined;
    }

    if (editingGoal) {
      setInvestmentGoals(prev => (prev || []).map(g => g.id === editingGoal.id ? { ...g, ...goalData } as InvestmentGoal : g));
    } else {
      const newGoal: InvestmentGoal = {
        ...goalData,
        id: Date.now().toString(),
      } as InvestmentGoal;
      setInvestmentGoals(prev => [...(prev || []), newGoal]);
    }
    closeGoalModal();
  };

  const handleDeleteGoal = (goalId: string) => {
    const goalToDelete = (investmentGoals || []).find(g => g.id === goalId);
    if (!goalToDelete) return;
  
    setConfirmation({
      isOpen: true,
      title: '투자 목표 삭제',
      message: `'${goalToDelete.name}' 목표를 삭제하시겠습니까? 이 목표와 연결된 모든 매매 및 입출금 기록은 '자산배분 포트폴리오'로 이동됩니다.`,
      confirmText: '삭제',
      confirmVariant: 'danger',
      onConfirm: () => {
        const updatedTrades = (trades || []).map(t => t.goalId === goalId ? { ...t, goalId: undefined } : t);
        const updatedTransactions = (transactions || []).map(t => t.goalId === goalId ? { ...t, goalId: undefined } : t);
        localStorage.setItem('trades', JSON.stringify(updatedTrades));
        localStorage.setItem('transactions', JSON.stringify(updatedTransactions));
  
        setInvestmentGoals(prev => (prev || []).filter(g => g.id !== goalId));
        closeConfirmationModal();

        setTimeout(() => onForceRemount(), 100);
      }
    });
  };
  
  const handlePortfolioInputChange = (stockId: string, value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      const num = parseFloat(value);
      if (value === '' || (num >= 0 && num <= 100)) {
        setEditingPortfolio(prev => ({ ...prev, [stockId]: value }));
      }
    }
  };

  const togglePortfolioCategory = (category: string) => {
    setOpenPortfolioCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const handleEditPortfolio = () => {
    const stringPortfolio: { [key: string]: string } = {};
    portfolioStocks.forEach(stock => {
      const value = (initialPortfolio || {})[stock.id];
      stringPortfolio[stock.id] = (value === undefined || value === 0) ? '' : String(value);
    });
    setEditingPortfolio(stringPortfolio);
    setIsPortfolioEditing(true);
  };

  const handleSavePortfolio = () => {
    const newPortfolio: InitialPortfolio = { ...(initialPortfolio || {}) };
    let total = 0;

    for (const stockId in editingPortfolio) {
      newPortfolio[stockId] = parseFloat(editingPortfolio[stockId]) || 0;
    }

    for (const stock of portfolioStocks) {
      total += newPortfolio[stock.id] || 0;
    }

    if (Math.abs(total - 100) > 0.01) {
      alert(`포트폴리오 비율의 총 합이 100%가 되어야 합니다. 현재 총 합: ${total.toFixed(2)}%`);
      return;
    }
    setInitialPortfolio(newPortfolio);
    setIsPortfolioEditing(false);
  };

  const handleCancelPortfolioEdit = () => {
    setIsPortfolioEditing(false);
  };

  const handlePasswordSet = () => {
    if (newPassword && newPassword === confirmPassword) {
      setPassword(newPassword);
      alert('비밀번호가 설정되었습니다.');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      alert('비밀번호가 일치하지 않습니다.');
    }
  };
  
    const handleBackgroundIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      setLocalBackgroundInterval(value);
    }
  };

  const handleSaveBackgroundInterval = () => {
    const minutes = parseInt(localBackgroundInterval, 10);
    if (isNaN(minutes) || minutes < 1) {
      alert('백그라운드 조회 주기가 1분 이상이어야 합니다.');
      setLocalBackgroundInterval(String(backgroundFetchInterval));
      return;
    }
    setBackgroundFetchInterval(minutes);
    setToastMessage(`백그라운드 조회 주기가 ${minutes}분으로 설정되었습니다.`);
    setTimeout(() => setToastMessage(''), 3000);
  };
  
  const handleThresholdChange = (level: 'global' | 'categories' | 'stocks', type: 'caution' | 'warning', value: string, id?: string) => {
      const numValue = value === '' ? undefined : parseFloat(value);
      
      setEditingThresholds(prev => {
        const newThresholds = JSON.parse(JSON.stringify(prev)); // Deep copy
        
        if (level === 'global') {
          newThresholds.global[type] = numValue ?? (type === 'caution' ? 3 : 5);
        } else if (id) {
          if (!newThresholds[level]) newThresholds[level] = {};
          
          if (numValue === undefined) {
            if (newThresholds[level][id]) {
              delete newThresholds[level][id][type];
              if (Object.keys(newThresholds[level][id]).length === 0) {
                delete newThresholds[level][id];
              }
            }
          } else {
            if (!newThresholds[level][id]) newThresholds[level][id] = {};
            newThresholds[level][id][type] = numValue;
          }
        }
        return newThresholds;
      });
  };

  const handleSaveThresholds = () => {
      setAlertThresholds(editingThresholds);
      setToastMessage('알림 기준이 저장되었습니다.');
      setTimeout(() => setToastMessage(''), 3000);
  };

  const requestNotificationPermission = () => {
    if (!('Notification' in window)) {
      alert('이 브라우저는 웹 알림을 지원하지 않습니다.');
      return;
    }
    Notification.requestPermission().then(permission => {
      setNotificationPermission(permission);
      if (permission === 'granted') {
        new Notification('알림이 활성화되었습니다!', {
          body: '리밸런싱 경고를 이제 알림으로 받을 수 있습니다.',
          icon: '/icon.svg',
        });
      }
    });
  };


  // Data Backup & Restore
  const LOCAL_STORAGE_KEYS = [
    'theme', 'app-password', 'brokers', 'accounts', 'stocks', 'trades',
    'transactions', 'initialPortfolio', 'monthlyValues', 'data-version', 'bankAccounts',
    'historicalGains', 'alertThresholds', 'backgroundFetchInterval', 'showSummary', 'investmentGoals'
  ];
  
  const handleImportClick = () => {
    importFileInputRef.current?.click();
  };

  const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importFileRef.current = file;
      setConfirmation({
        isOpen: true,
        title: '엑셀 데이터 불러오기',
        message: '현재 앱의 모든 데이터가 엑셀 파일의 내용으로 교체됩니다. 이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?',
        confirmText: '불러오기',
        confirmVariant: 'danger',
        onConfirm: executeImport,
      });
    }
    if (event.target) {
      event.target.value = '';
    }
  };
  
  const executeImport = async () => {
    if (!importFileRef.current) return;
    
    closeConfirmationModal();
    setIsImporting(true);
    setIsDataOperationInProgress(true);
    setImportStatus('엑셀 파일 분석을 시작합니다...');

    try {
      const xlsxLib = findValidXlsxLibrary(XLSX);
      if (!xlsxLib) throw new Error("SheetJS (xlsx) 라이브러리를 찾을 수 없습니다.");
      
      const data = await importFileRef.current.arrayBuffer();
      const workbook = xlsxLib.read(data, { cellDates: true });

      const safeSheetToJSON = (wb: any, sheetName: string): any[] => {
          const ws = wb.Sheets[sheetName];
          if (!ws) {
              console.warn(`'${sheetName}' 시트를 찾을 수 없습니다. 건너뜜.`);
              return [];
          }
          return xlsxLib.utils.sheet_to_json(ws);
      };

      setImportStatus('데이터 변환 중 (1/13): 증권사...');
      const brokersData = safeSheetToJSON(workbook, '증권사');
      const newBrokers: Broker[] = [];
      const brokerNameToIdMap = new Map<string, string>();
      brokersData.forEach(row => {
          const name = row['증권사명']?.trim();
          if (name && !brokerNameToIdMap.has(name)) {
              const newId = `broker-${Date.now()}-${Math.random()}`;
              newBrokers.push({ id: newId, name });
              brokerNameToIdMap.set(name, newId);
          }
      });
      
      setImportStatus('데이터 변환 중 (2/13): 은행계좌...');
      const bankAccountsData = safeSheetToJSON(workbook, '은행계좌');
      const newBankAccounts: BankAccount[] = [];
      const bankAccountIdentifierToIdMap = new Map<string, string>();
      bankAccountsData.forEach(row => {
          const bankName = row['은행명']?.trim();
          const name = row['계좌별명']?.trim();
          if (bankName && name) {
              const identifier = `${bankName} ${name}`;
              if (!bankAccountIdentifierToIdMap.has(identifier)) {
                  const newId = `bacc-${Date.now()}-${Math.random()}`;
                  newBankAccounts.push({ id: newId, name, bankName });
                  bankAccountIdentifierToIdMap.set(identifier, newId);
              }
          }
      });

      setImportStatus('데이터 변환 중 (3/13): 증권계좌...');
      const accountsData = safeSheetToJSON(workbook, '증권계좌');
      const newAccounts: Account[] = [];
      const accountNameToIdMap = new Map<string, string>();
      accountsData.forEach(row => {
          const name = row['계좌명']?.trim();
          const brokerName = row['증권사']?.trim();
          const brokerId = brokerNameToIdMap.get(brokerName);
          if (name && brokerId && !accountNameToIdMap.has(name)) {
              const newId = `acc-${Date.now()}-${Math.random()}`;
              newAccounts.push({ id: newId, name, brokerId });
              accountNameToIdMap.set(name, newId);
          }
      });
      
      setImportStatus('데이터 변환 중 (4/13): 종목...');
      const stocksData = safeSheetToJSON(workbook, '종목');
      const newStocks: Stock[] = [];
      const stockTickerToIdMap = new Map<string, string>();
      stocksData.forEach(row => {
          const name = row['종목명']?.trim();
          const ticker = row['티커']?.trim().toUpperCase();
          const category = row['카테고리'] as PortfolioCategory;
          const isPortfolio = row['포트폴리오 포함'] === '예';
          const isEtf = row['ETF 여부'] === '예';
          const expenseRatio = isEtf ? parseFloat(row['실부담비용률 (%)']) : undefined;

          if (name && ticker && category && !stockTickerToIdMap.has(ticker)) {
              const newId = `stock-${Date.now()}-${Math.random()}`;
              newStocks.push({ id: newId, name, ticker, category, isPortfolio, isEtf, expenseRatio });
              stockTickerToIdMap.set(ticker, newId);
          }
      });
      
      setImportStatus('데이터 변환 중 (5/13): 투자 목표...');
      const goalsData = safeSheetToJSON(workbook, '투자 목표');
      const newGoals: InvestmentGoal[] = [];
      const goalNameToIdMap = new Map<string, string>();
      goalsData.forEach(row => {
        const name = row['목표명']?.trim();
        if (name && !goalNameToIdMap.has(name)) {
            const newId = `goal-${Date.now()}-${Math.random()}`;
            goalNameToIdMap.set(name, newId);
            const creationDate = row['생성일'] instanceof Date ? row['생성일'].toISOString().split('T')[0] : String(row['생성일'] || '');
            const targetDate = row['목표달성일'] instanceof Date ? row['목표달성일'].toISOString().split('T')[0] : String(row['목표달성일'] || '');
            const goalType = row['목표유형'] === '수량' ? 'shares' : 'amount';
            const targetAmount = goalType === 'amount' ? parseFloat(row['목표금액']) : undefined;
            newGoals.push({ 
              id: newId, 
              name, 
              creationDate: creationDate || new Date().toISOString().split('T')[0], 
              targetDate: targetDate || undefined,
              goalType, 
              targetAmount, 
              targetShares: goalType === 'shares' ? {} : undefined 
            });
        }
      });

      setImportStatus('데이터 변환 중 (6/13): 목표-종목수량...');
      const goalSharesData = safeSheetToJSON(workbook, '목표-종목수량');
      goalSharesData.forEach(row => {
        const goalName = row['목표명']?.trim();
        const ticker = row['티커']?.trim().toUpperCase();
        const targetShares = parseInt(row['목표수량'], 10);
        const goalId = goalNameToIdMap.get(goalName);
        const stockId = stockTickerToIdMap.get(ticker);
        if (goalId && stockId && !isNaN(targetShares)) {
          const goal = newGoals.find(g => g.id === goalId);
          if (goal && goal.targetShares) {
            goal.targetShares[stockId] = targetShares;
          }
        }
      });

      setImportStatus('데이터 변환 중 (7/13): 포트폴리오...');
      const portfolioData = safeSheetToJSON(workbook, '포트폴리오');
      const newInitialPortfolio: InitialPortfolio = {};
      portfolioData.forEach(row => {
          const ticker = row['티커']?.trim().toUpperCase();
          const percentage = parseFloat(row['목표 비중 (%)']);
          const stockId = stockTickerToIdMap.get(ticker);
          if (stockId && !isNaN(percentage)) {
              newInitialPortfolio[stockId] = percentage;
          }
      });
      
      setImportStatus('데이터 변환 중 (8/13): 매매기록...');
      const tradesData = safeSheetToJSON(workbook, '매매기록');
      const newTrades: Trade[] = [];
      tradesData.forEach(row => {
        const date = row['일자'] instanceof Date ? row['일자'].toISOString().split('T')[0] : String(row['일자']);
        const accountName = row['계좌']?.trim();
        const ticker = row['티커']?.trim().toUpperCase();
        const tradeTypeStr = row['구분']?.trim();
        const quantity = parseFloat(row['수량']);
        const price = parseFloat(row['단가']);
        const tradeMethod = row['매매방법']?.trim() || '직접매매';
        const goalName = row['목표']?.trim();

        const accountId = accountNameToIdMap.get(accountName);
        const stockId = stockTickerToIdMap.get(ticker);
        const tradeType = tradeTypeStr === '매수' ? TradeType.Buy : TradeType.Sell;
        const goalId = goalNameToIdMap.get(goalName);

        if (date && accountId && stockId && !isNaN(quantity) && !isNaN(price)) {
            newTrades.push({
                id: `trade-${Date.now()}-${Math.random()}`,
                date, accountId, stockId, quantity, price, tradeType, tradeMethod, goalId
            });
        }
      });
      
      setImportStatus('데이터 변환 중 (9/13): 입출금 및 배당 기록...');
      const newTransactions: AccountTransaction[] = [];
      const allAccountsMapForImport = new Map([...accountNameToIdMap.entries(), ...bankAccountIdentifierToIdMap.entries()]);
      
      const transactionsData = safeSheetToJSON(workbook, '입출금기록');
      transactionsData.forEach(row => {
          const date = row['일자'] instanceof Date ? row['일자'].toISOString().split('T')[0] : String(row['일자']);
          const accountName = row['계좌']?.trim();
          const txTypeStr = row['구분']?.trim();
          const amount = parseFloat(row['금액']);
          const counterpartyName = row['상대계좌']?.trim();
          const goalName = row['목표']?.trim();
          
          const accountId = accountNameToIdMap.get(accountName);
          const transactionType = txTypeStr === '입금' ? TransactionType.Deposit : TransactionType.Withdrawal;
          const counterpartyAccountId = counterpartyName === '외부' ? undefined : allAccountsMapForImport.get(counterpartyName);
          const goalId = goalNameToIdMap.get(goalName);

          if (date && accountId && !isNaN(amount)) {
              newTransactions.push({
                  id: `tx-${Date.now()}-${Math.random()}`,
                  date, accountId, amount, transactionType, counterpartyAccountId, goalId
              });
          }
      });
      
      const dividendsData = safeSheetToJSON(workbook, '배당금기록');
      dividendsData.forEach(row => {
          const date = row['일자'] instanceof Date ? row['일자'].toISOString().split('T')[0] : String(row['일자']);
          const accountName = row['계좌']?.trim();
          const ticker = row['티커']?.trim().toUpperCase();
          const amount = parseFloat(row['금액']);

          const accountId = accountNameToIdMap.get(accountName);
          const stockId = stockTickerToIdMap.get(ticker);

          if (date && accountId && stockId && !isNaN(amount)) {
              newTransactions.push({
                  id: `tx-div-${Date.now()}-${Math.random()}`,
                  date,
                  accountId,
                  amount,
                  transactionType: TransactionType.Dividend,
                  stockId,
              });
          }
      });

      setImportStatus('데이터 변환 중 (10/13): 월말결산...');
      const monthlyValuesData = safeSheetToJSON(workbook, '월말결산');
      const newMonthlyValues: MonthlyAccountValue[] = [];
      monthlyValuesData.forEach(row => {
          const date = row['기준일'] instanceof Date ? row['기준일'].toISOString().split('T')[0] : String(row['기준일']);
          const totalValue = parseFloat(row['계좌총액']);

          if (date && !isNaN(totalValue)) {
              newMonthlyValues.push({
                  id: `mv-${Date.now()}-${Math.random()}`,
                  date,
                  totalValue
              });
          }
      });

      setImportStatus('데이터 변환 중 (11/13): 초기손익기록...');
      const historicalGainsData = safeSheetToJSON(workbook, '초기손익기록');
      const newHistoricalGains: HistoricalGain[] = [];
      historicalGainsData.forEach(row => {
          const date = row['일자'] instanceof Date ? row['일자'].toISOString().split('T')[0] : String(row['일자']);
          const accountName = row['계좌명']?.trim();
          const stockName = row['종목명']?.trim();
          const realizedPnl = parseFloat(row['실현손익']);
          const note = row['메모']?.trim();
          
          const accountId = accountNameToIdMap.get(accountName);

          if (date && accountId && stockName && !isNaN(realizedPnl)) {
              newHistoricalGains.push({
                  id: `hg-${Date.now()}-${Math.random()}`,
                  date, accountId, stockName, realizedPnl, note
              });
          }
      });
      
      setImportStatus('데이터 변환 중 (12/13): 리밸런싱 알림...');
      const alertThresholdsData = safeSheetToJSON(workbook, '리밸런싱알림설정');
      const newAlertThresholds: AlertThresholds = {
          global: { caution: 3, warning: 5 },
          categories: {},
          stocks: {}
      };
      alertThresholdsData.forEach(row => {
          const type = row['구분'];
          const id = row['ID'] || row['ID(티커)'];
          const caution = parseFloat(row['주의 기준 (%)']);
          const warning = parseFloat(row['경고 기준 (%)']);
          if (type === '전체') {
              if (!isNaN(caution)) newAlertThresholds.global.caution = caution;
              if (!isNaN(warning)) newAlertThresholds.global.warning = warning;
          } else if (type === '개별 종목') {
              const stockId = stockTickerToIdMap.get(id);
              if (stockId) {
                  newAlertThresholds.stocks[stockId] = {};
                  if (!isNaN(caution)) newAlertThresholds.stocks[stockId].caution = caution;
                  if (!isNaN(warning)) newAlertThresholds.stocks[stockId].warning = warning;
              }
          }
      });

      setImportStatus('데이터 변환 중 (13/13): 앱 설정...');
      const appSettingsData = safeSheetToJSON(workbook, '앱설정');
      let newBackgroundFetchInterval = 30;
      let newShowSummary = true;
      appSettingsData.forEach(row => {
          const settingName = row['설정명'];
          const settingValue = row['설정값'];
          if (settingName === '백그라운드 조회 주기 (분)') {
              const interval = parseInt(settingValue, 10);
              if (!isNaN(interval) && interval > 0) newBackgroundFetchInterval = interval;
          } else if (settingName === '홈 화면 요약 정보 표시') {
              newShowSummary = settingValue === '예';
          }
      });

      const keysToClear = LOCAL_STORAGE_KEYS.filter(key => key !== 'theme' && key !== 'app-password');
      
      setImportStatus('데이터 저장 중...');
      keysToClear.forEach(key => localStorage.removeItem(key));
      
      localStorage.setItem('investmentGoals', JSON.stringify(newGoals));
      localStorage.setItem('brokers', JSON.stringify(newBrokers));
      localStorage.setItem('bankAccounts', JSON.stringify(newBankAccounts));
      localStorage.setItem('accounts', JSON.stringify(newAccounts));
      localStorage.setItem('stocks', JSON.stringify(newStocks));
      localStorage.setItem('initialPortfolio', JSON.stringify(newInitialPortfolio));
      localStorage.setItem('trades', JSON.stringify(newTrades));
      localStorage.setItem('transactions', JSON.stringify(newTransactions));
      localStorage.setItem('monthlyValues', JSON.stringify(newMonthlyValues));
      localStorage.setItem('historicalGains', JSON.stringify(newHistoricalGains));
      localStorage.setItem('alertThresholds', JSON.stringify(newAlertThresholds));
      localStorage.setItem('backgroundFetchInterval', JSON.stringify(newBackgroundFetchInterval));
      localStorage.setItem('showSummary', JSON.stringify(newShowSummary));
      localStorage.setItem('data-version', String(DATA_VERSION));

      setImportStatus('불러오기 완료! 앱을 새로고침합니다.');
      setTimeout(() => onForceRemount(), 1000);

    } catch (error) {
        console.error("엑셀 불러오기 실패:", error);
        const message = error instanceof Error ? error.message : String(error);
        alert(`데이터 불러오기 중 오류가 발생했습니다: ${message}`);
        setIsImporting(false);
        setIsDataOperationInProgress(false);
        setImportStatus('');
        if (importFileInputRef.current) importFileInputRef.current.value = '';
        importFileRef.current = null;
    }
  };

  const handleConfirmationCancel = () => {
    const wasImportConfirm = confirmation.title === '엑셀 데이터 불러오기';
    closeConfirmationModal();
    if (wasImportConfirm) {
      importFileRef.current = null;
    }
  };

  const handleExportAllData = () => {
    exportAllData(
      brokers,
      accounts,
      bankAccounts,
      stocks,
      initialPortfolio,
      trades,
      transactions,
      monthlyValues,
      historicalGains,
      alertThresholds,
      backgroundFetchInterval,
      showSummary,
      investmentGoals,
      `투자 관리 앱 전체 데이터_${new Date().toISOString().split('T')[0]}`
    );
  };

  const stocksByCategory = useMemo(() => {
    const grouped: { [key in PortfolioCategory]?: Stock[] } = {};
    (stocks || []).forEach(stock => {
        if (!grouped[stock.category]) {
            grouped[stock.category] = [];
        }
        grouped[stock.category]!.push(stock);
    });
    return PORTFOLIO_CATEGORIES.map(category => ({
        category,
        stocks: grouped[category]?.sort((a,b) => a.name.localeCompare(b.name)) || []
    })).filter(g => g.stocks.length > 0);
  }, [stocks]);

  const [openStockCategories, setOpenStockCategories] = useState<Set<string>>(new Set());

  const toggleStockCategory = (category: string) => {
    setOpenStockCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const portfolioStocksByCategory = useMemo(() => {
    const grouped: { [key: string]: Stock[] } = {};
    portfolioStocks.forEach(stock => {
      if (!grouped[stock.category]) {
        grouped[stock.category] = [];
      }
      grouped[stock.category].push(stock);
    });
    return Object.entries(grouped).map(([category, stocks]) => ({
      category,
      stocks: stocks.sort((a, b) => a.name.localeCompare(b.name))
    }));
  }, [portfolioStocks]);
  
  const basicInfoSections = [
    { id: 'brokers', title: '증권사 관리', icon: <BuildingOffice2Icon className="w-6 h-6 text-blue-500" /> },
    { id: 'accounts', title: '증권계좌 관리', icon: <IdentificationIcon className="w-6 h-6 text-green-500" /> },
    { id: 'bankAccounts', title: '은행 계좌 관리', icon: <BuildingLibraryIcon className="w-6 h-6 text-amber-500" /> },
    { id: 'stocks', title: '주식 종목 관리', icon: <ChartBarIcon className="w-6 h-6 text-purple-500" /> },
  ];

  const portfolioSections = [
    { id: 'goals', title: '투자 목표 관리', icon: <FlagIcon className="w-6 h-6 text-lime-500" /> },
    { id: 'portfolio', title: '포트폴리오 비중 설정 (%)', icon: <ChartPieIcon className="w-6 h-6 text-cyan-500" /> },
    { id: 'alertSettings', title: '리밸런싱 알림 설정', icon: <BellAlertIcon className="w-6 h-6 text-orange-500" /> },
  ];

  const appConfigSections = [
      { id: 'appSettings', title: '앱 설정', icon: <Cog8ToothIcon className="w-6 h-6 text-slate-500" /> },
      { id: 'data', title: '데이터 관리', icon: <CircleStackIcon className="w-6 h-6 text-rose-500" /> },
      { id: 'password', title: '비밀번호 설정', icon: <LockClosedIcon className="w-6 h-6 text-red-500" /> },
  ];
  
  return (
    <div className="space-y-8">
        <div>
            <h2 className="text-xl font-bold mb-4 px-2 text-light-text dark:text-dark-text">기본 정보 관리</h2>
            <div className="space-y-4">
                {basicInfoSections.map(section => (
                    <SettingsSection
                        key={section.id}
                        title={section.title}
                        icon={section.icon}
                        isOpen={openSection === section.id}
                        onToggle={() => toggleSection(section.id)}
                    >
                        {section.id === 'brokers' && (
                            <>
                              <div className="flex justify-end mb-4">
                                <Button onClick={() => openBrokerModal(null)}>증권사 추가</Button>
                              </div>
                              <ul className="mt-4 space-y-2">
                                {(brokers || []).length === 0 ? <p className="text-center text-sm text-light-secondary dark:text-dark-secondary">등록된 증권사가 없습니다.</p> :
                                  (brokers || []).map(b => (
                                    <li key={b.id} className="flex justify-between items-center p-2 bg-gray-100 dark:bg-slate-900/50 rounded">
                                      <span>{b.name}</span>
                                      <div className="flex gap-2">
                                        <Button onClick={() => openBrokerModal(b)} variant="secondary" className="px-2 py-1 text-xs">수정</Button>
                                        <Button onClick={() => handleDeleteBroker(b.id)} className="px-2 py-1 text-xs bg-loss text-white hover:bg-red-700 focus:ring-red-500">삭제</Button>
                                      </div>
                                    </li>
                                  ))
                                }
                              </ul>
                            </>
                        )}
                        {section.id === 'accounts' && (
                           <>
                              <div className="flex justify-end mb-4">
                                <Button onClick={() => openAccountModal(null)}>계좌 추가</Button>
                              </div>
                              <ul className="mt-4 space-y-2">
                                {(accounts || []).length === 0 ? <p className="text-center text-sm text-light-secondary dark:text-dark-secondary">등록된 계좌가 없습니다.</p> :
                                  (accounts || []).map(a => (
                                    <li key={a.id} className="flex justify-between items-center p-2 bg-gray-100 dark:bg-slate-900/50 rounded">
                                      <span>{a.name} <span className="text-sm text-light-secondary dark:text-dark-secondary">({brokerMap.get(a.brokerId) || '알 수 없는 증권사'})</span></span>
                                      <div className="flex gap-2">
                                        <Button onClick={() => openAccountModal(a)} variant="secondary" className="px-2 py-1 text-xs">수정</Button>
                                        <Button onClick={() => handleDeleteAccount(a.id)} className="px-2 py-1 text-xs bg-loss text-white hover:bg-red-700 focus:ring-red-500">삭제</Button>
                                      </div>
                                    </li>
                                  ))
                                }
                              </ul>
                            </>
                        )}
                        {section.id === 'bankAccounts' && (
                            <>
                              <div className="flex justify-end mb-4">
                                  <Button onClick={() => openBankAccountModal(null)}>은행 계좌 추가</Button>
                              </div>
                              <ul className="mt-4 space-y-2">
                              {(bankAccounts || []).length === 0 ? <p className="text-center text-sm text-light-secondary dark:text-dark-secondary">등록된 은행 계좌가 없습니다.</p> :
                                (bankAccounts || []).map(a => (
                                  <li key={a.id} className="flex justify-between items-center p-2 bg-gray-100 dark:bg-slate-900/50 rounded">
                                    <span>{a.name} <span className="text-sm text-light-secondary dark:text-dark-secondary">({a.bankName})</span></span>
                                    <div className="flex gap-2">
                                      <Button onClick={() => openBankAccountModal(a)} variant="secondary" className="px-2 py-1 text-xs">수정</Button>
                                      <Button onClick={() => handleDeleteBankAccount(a.id)} className="px-2 py-1 text-xs bg-loss text-white hover:bg-red-700 focus:ring-red-500">삭제</Button>
                                    </div>
                                  </li>
                                ))
                              }
                              </ul>
                            </>
                        )}
                        {section.id === 'stocks' && (
                             <>
                              <div className="flex justify-end mb-4">
                                <Button onClick={() => openStockModal(null)}>종목 추가</Button>
                              </div>
                              {(stocks || []).length === 0 ? <p className="text-center text-sm text-light-secondary dark:text-dark-secondary">등록된 종목이 없습니다.</p> :
                                stocksByCategory.map(({ category, stocks: categoryStocks }) => (
                                  <div key={category} className="mb-2">
                                    <div
                                      className="flex justify-between items-center p-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800/50"
                                      onClick={() => toggleStockCategory(category)}
                                    >
                                      <h3 className="font-semibold">{category} <span className="text-sm font-normal text-light-secondary dark:text-dark-secondary">({categoryStocks.length})</span></h3>
                                      {openStockCategories.has(category) ? <ChevronUpIcon className="w-5 h-5"/> : <ChevronDownIcon className="w-5 h-5"/>}
                                    </div>
                                    {openStockCategories.has(category) && (
                                      <ul className="mt-2 space-y-2 pl-4 border-l-2 border-gray-200 dark:border-slate-700">
                                        {categoryStocks.map(s => (
                                          <li key={s.id} className="flex justify-between items-center p-2 bg-gray-100 dark:bg-slate-900/50 rounded">
                                            <div>
                                              <p>{s.name} ({s.ticker})</p>
                                              <div className="flex items-center gap-2 mt-1">
                                                {s.isPortfolio && <span className="text-xs font-semibold text-white bg-light-primary dark:bg-dark-primary px-2 py-0.5 rounded-full">포트폴리오</span>}
                                                {s.isEtf && <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-300 dark:bg-gray-600 px-2 py-0.5 rounded-full">ETF</span>}
                                              </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button onClick={() => openStockModal(s)} variant="secondary" className="px-2 py-1 text-xs">수정</Button>
                                                <Button onClick={() => handleDeleteStock(s.id)} className="px-2 py-1 text-xs bg-loss text-white hover:bg-red-700 focus:ring-red-500">삭제</Button>
                                            </div>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                ))
                              }
                            </>
                        )}
                    </SettingsSection>
                ))}
            </div>
        </div>

        <div>
            <h2 className="text-xl font-bold mb-4 px-2 text-light-text dark:text-dark-text">포트폴리오 설정</h2>
            <div className="space-y-4">
                 {portfolioSections.map(section => (
                    <SettingsSection
                        key={section.id}
                        title={section.title}
                        icon={section.icon}
                        isOpen={openSection === section.id}
                        onToggle={() => toggleSection(section.id)}
                    >
                        {section.id === 'goals' && (
                            <>
                                <div className="flex justify-end mb-4">
                                <Button onClick={() => openGoalModal(null)}>새 목표 추가</Button>
                                </div>
                                <ul className="mt-4 space-y-2">
                                {(investmentGoals || []).length === 0 ? (
                                    <p className="text-center text-sm text-light-secondary dark:text-dark-secondary">등록된 투자 목표가 없습니다.</p>
                                ) : (
                                    (investmentGoals || []).map(g => (
                                    <li key={g.id} className="flex justify-between items-center p-2 bg-gray-100 dark:bg-slate-900/50 rounded">
                                        <div>
                                            <span className="font-semibold">{g.name}</span>
                                            {g.goalType === 'amount' && g.targetAmount && <span className="text-sm text-light-secondary dark:text-dark-secondary ml-2">({formatNumber(g.targetAmount)}원)</span>}
                                            {g.goalType === 'shares' && <span className="text-sm text-light-secondary dark:text-dark-secondary ml-2">(수량 목표)</span>}
                                        </div>
                                        <div className="flex gap-2">
                                        <Button onClick={() => openGoalModal(g)} variant="secondary" className="px-2 py-1 text-xs">수정</Button>
                                        <Button onClick={() => handleDeleteGoal(g.id)} className="px-2 py-1 text-xs bg-loss text-white hover:bg-red-700 focus:ring-red-500">삭제</Button>
                                        </div>
                                    </li>
                                    ))
                                )}
                                </ul>
                            </>
                        )}
                        {section.id === 'portfolio' && (
                           <>
                              {PORTFOLIO_CATEGORIES.map((category: string) => {
                                const categoryStocks = portfolioStocks.filter(s => s.category === category);
                                if (categoryStocks.length === 0) return null;
                                
                                const categoryTotal = categoryStocks.reduce((sum, stock) => {
                                  const valueStr = isPortfolioEditing ? editingPortfolio[stock.id] : String((initialPortfolio || {})[stock.id] || '');
                                  return sum + (parseFloat(valueStr) || 0);
                                }, 0);
                                
                                const isCategoryOpen = openPortfolioCategories.has(category);

                                return (
                                  <div key={category} className="mb-4 last:mb-0">
                                    <div 
                                      onClick={() => togglePortfolioCategory(category)}
                                      className="cursor-pointer flex justify-between items-center p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-colors"
                                      aria-expanded={isCategoryOpen}
                                      aria-controls={`portfolio-category-${category}`}
                                    >
                                      <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">
                                        {category}
                                      </h3>
                                      <div className="flex items-center gap-4">
                                        <span className={`text-base font-bold ${isPortfolioEditing ? 'text-light-primary dark:text-dark-primary' : 'text-light-text dark:text-dark-text'}`}>{categoryTotal.toFixed(2)}%</span>
                                        {isCategoryOpen 
                                          ? <ChevronUpIcon className="w-5 h-5 text-light-secondary dark:text-dark-secondary" /> 
                                          : <ChevronDownIcon className="w-5 h-5 text-light-secondary dark:text-dark-secondary" />}
                                      </div>
                                    </div>
                                    {isCategoryOpen && (
                                      <div id={`portfolio-category-${category}`} className="mt-3 space-y-4 pl-4 pr-2 pb-2 border-l-2 border-gray-200 dark:border-slate-700">
                                        {categoryStocks.map(stock => (
                                          <Input 
                                            key={stock.id}
                                            label={`${stock.name} (${stock.ticker})`}
                                            id={`portfolio-${stock.id}`}
                                            type="text"
                                            inputMode="decimal"
                                            value={
                                              isPortfolioEditing
                                                ? editingPortfolio[stock.id] ?? ''
                                                : ((initialPortfolio || {})[stock.id] ? String((initialPortfolio || {})[stock.id]) : '')
                                            }
                                            onChange={(e) => handlePortfolioInputChange(stock.id, e.target.value)}
                                            disabled={!isPortfolioEditing}
                                            placeholder="비중(%)"
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                              
                              {portfolioStocks.length === 0 ? (
                                <p className="text-center text-sm text-light-secondary dark:text-dark-secondary py-4">포트폴리오에 포함된 종목이 없습니다. '주식 종목 관리'에서 종목을 추가하고 '포트폴리오 포함'을 체크해주세요.</p>
                              ) : (
                                <>
                                  <p className="text-sm mt-4 text-light-secondary dark:text-dark-secondary">총 합이 100%가 되도록 설정해주세요.</p>
                                  {isPortfolioEditing && (() => {
                                      let total = 0;
                                      portfolioStocks.forEach(stock => {
                                        total += parseFloat(editingPortfolio[stock.id] || '0') || 0;
                                      });
                                      return (
                                        <p className="text-md mt-2 font-semibold text-right">
                                          현재 총 합: {total.toFixed(2)}%
                                        </p>
                                      );
                                  })()}
                                </>
                              )}
                              
                              <div className="flex justify-end mt-4 gap-2">
                                {isPortfolioEditing ? (
                                  <>
                                    <Button onClick={handleSavePortfolio}>저장</Button>
                                    <Button onClick={handleCancelPortfolioEdit} variant="secondary">취소</Button>
                                  </>
                                ) : (
                                  <Button onClick={handleEditPortfolio} disabled={portfolioStocks.length === 0}>변경</Button>
                                )}
                              </div>
                            </>
                        )}
                        {section.id === 'alertSettings' && (
                             <div className="space-y-6">
                              <div>
                                <h3 className="text-md font-semibold mb-2">전체 기준 (이격률 편차 %)</h3>
                                <p className="text-sm text-light-secondary dark:text-dark-secondary mb-2">
                                    목표 비중 대비 현재 비중의 편차 비율(이격률)의 절대값이 설정된 값을 초과하면 알림이 발생합니다.<br/>
                                    예: '경고' 기준이 20%라면, 이격률이 +20%를 초과하거나 -20% 미만일 때 경고 상태가 됩니다.
                                </p>
                                <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                                  <Input label="주의 (Caution)" type="number" step="0.1"
                                         value={editingThresholds.global.caution}
                                         onChange={(e) => handleThresholdChange('global', 'caution', e.target.value)} />
                                  <Input label="경고 (Warning)" type="number" step="0.1"
                                         value={editingThresholds.global.warning}
                                         onChange={(e) => handleThresholdChange('global', 'warning', e.target.value)} />
                                </div>
                              </div>
                              <div>
                                <h3 className="text-md font-semibold mb-2">개별 종목 기준 (이격률 편차 %, 선택 사항)</h3>
                                <p className="text-sm text-light-secondary dark:text-dark-secondary mb-2">
                                    포트폴리오에 포함된 종목별로 알림 기준을 다르게 설정할 수 있습니다. 비워두면 전체 기준을 따릅니다.
                                </p>
                                <div className="space-y-3">
                                  {portfolioStocksByCategory.length === 0 ? <p className="text-center text-sm text-light-secondary dark:text-dark-secondary p-4">포트폴리오에 포함된 종목이 없습니다.</p> :
                                    portfolioStocksByCategory.map(({ category, stocks: categoryStocks }) => (
                                      <details key={category} className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg" open>
                                          <summary className="font-medium cursor-pointer">{category}</summary>
                                          <div className="mt-4 space-y-4 pl-2 border-l-2 border-gray-200 dark:border-slate-700">
                                              {categoryStocks.map(stock => (
                                                  <div key={stock.id} className="ml-2">
                                                      <h4 className="font-semibold text-sm mb-2">{stock.name}</h4>
                                                      <div className="grid grid-cols-2 gap-4">
                                                          <Input label="주의 (%)" type="number" step="0.1"
                                                              placeholder={`전체: ${editingThresholds.global.caution}%`}
                                                              value={editingThresholds.stocks[stock.id]?.caution ?? ''}
                                                              onChange={(e) => handleThresholdChange('stocks', 'caution', e.target.value, stock.id)} />
                                                          <Input label="경고 (%)" type="number" step="0.1"
                                                              placeholder={`전체: ${editingThresholds.global.warning}%`}
                                                              value={editingThresholds.stocks[stock.id]?.warning ?? ''}
                                                              onChange={(e) => handleThresholdChange('stocks', 'warning', e.target.value, stock.id)} />
                                                      </div>
                                                  </div>
                                              ))}
                                          </div>
                                      </details>
                                  ))}
                                </div>
                              </div>
                              <div className="flex justify-end mt-4">
                                <Button onClick={handleSaveThresholds}>알림 기준 저장</Button>
                              </div>
                            </div>
                        )}
                    </SettingsSection>
                ))}
            </div>
        </div>
        
        <div>
            <h2 className="text-xl font-bold mb-4 px-2 text-light-text dark:text-dark-text">
                앱 환경설정 <span className="text-sm font-normal text-light-secondary dark:text-dark-secondary">{appVersion}</span>
            </h2>
            <div className="space-y-4">
                {appConfigSections.map(section => (
                    <SettingsSection
                        key={section.id}
                        title={section.title}
                        icon={section.icon}
                        isOpen={openSection === section.id}
                        onToggle={() => toggleSection(section.id)}
                    >
                        {section.id === 'appSettings' && (
                             <div className="space-y-4">
                              <div>
                                <h4 className="font-semibold text-light-text dark:text-dark-text">홈 화면 설정</h4>
                                <p className="text-sm text-light-secondary dark:text-dark-secondary">
                                  네비게이션 바 중앙의 홈 버튼을 눌렀을 때 표시될 화면을 선택합니다.
                                </p>
                                <div className="mt-2">
                                  <Select
                                    label="기본 홈 화면"
                                    id="home-screen-preference"
                                    value={homeScreenPreference}
                                    onChange={(e) => setHomeScreenPreference(e.target.value as 'HOME' | 'HOLDINGS_STATUS')}
                                  >
                                    <option value={Screen.Home}>투자 현황</option>
                                    <option value={Screen.HoldingsStatus}>보유 현황</option>
                                  </Select>
                                </div>
                              </div>
                              <div className="pt-4 mt-4 border-t border-gray-200/50 dark:border-slate-700/50">
                                <p className="text-sm text-light-secondary dark:text-dark-secondary">
                                  앱이 백그라운드(비활성) 상태일 때 시세를 가져오는 주기를 설정합니다. 
                                  주기가 짧을수록 배터리 소모가 늘어날 수 있습니다. (앱 활성 시에는 5분으로 고정)
                                </p>
                                <div className="flex items-end gap-4 mt-2">
                                  <div className="flex-grow">
                                    <Input
                                      label="백그라운드 조회 주기 (분)"
                                      id="backgroundInterval"
                                      type="text"
                                      inputMode="numeric"
                                      value={localBackgroundInterval}
                                      onChange={handleBackgroundIntervalChange}
                                    />
                                  </div>
                                  <Button onClick={handleSaveBackgroundInterval}>
                                    저장
                                  </Button>
                                </div>
                              </div>
                              <div className="pt-4 mt-4 border-t border-gray-200/50 dark:border-slate-700/50">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <h4 className="font-semibold text-light-text dark:text-dark-text">홈 화면 요약 정보 표시</h4>
                                    <p className="text-sm text-light-secondary dark:text-dark-secondary">
                                      총 자산, 누적 순입금액, 누적 수익을 홈 화면에 표시합니다.
                                    </p>
                                  </div>
                                  <label htmlFor="show-summary-toggle" className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="show-summary-toggle" className="sr-only peer" checked={showSummary} onChange={() => setShowSummary(p => !p)} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                  </label>
                                </div>
                              </div>
                               <div className="pt-4 mt-4 border-t border-gray-200/50 dark:border-slate-700/50">
                                <div>
                                  <h4 className="font-semibold text-light-text dark:text-dark-text">웹 알림 설정</h4>
                                  <p className="text-sm text-light-secondary dark:text-dark-secondary mt-1">
                                    앱이 백그라운드에 있을 때 리밸런싱 '경고' 알림을 받으려면 브라우저 알림 권한을 허용해주세요.
                                  </p>
                                  <div className="mt-3">
                                    {notificationPermission === 'granted' ? (
                                      <p className="text-sm font-semibold text-profit">✅ 알림이 활성화되었습니다.</p>
                                    ) : notificationPermission === 'denied' ? (
                                      <p className="text-sm font-semibold text-loss">❌ 알림이 차단되었습니다. 브라우저 설정에서 변경해야 합니다.</p>
                                    ) : (
                                      <Button onClick={requestNotificationPermission}>알림 활성화</Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                        )}
                        {section.id === 'data' && (
                             <>
                              <div className="flex flex-wrap gap-4">
                                <Button onClick={handleImportClick} variant="secondary">엑셀에서 불러오기</Button>
                                <Button onClick={handleExportAllData} variant="secondary">전체 데이터 엑셀로 내보내기</Button>
                                 <input
                                    type="file"
                                    ref={importFileInputRef}
                                    onChange={handleImportFileChange}
                                    accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                    className="hidden"
                                />
                              </div>
                              <p className="text-sm mt-4 text-light-secondary dark:text-dark-secondary">
                                  모든 데이터를 하나의 엑셀 파일로 내보내거나, 템플릿에 맞는 엑셀 파일의 데이터를 앱으로 가져올 수 있습니다.
                              </p>
                            </>
                        )}
                        {section.id === 'password' && (
                             <div className="space-y-4">
                              <Input label="새 비밀번호" id="newPassword" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                              <Input label="비밀번호 확인" id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                              <Button onClick={handlePasswordSet}>{password ? '비밀번호 변경' : '비밀번호 설정'}</Button>
                            </div>
                        )}
                    </SettingsSection>
                ))}
            </div>
        </div>
      

      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-200 text-white dark:text-black px-4 py-2 rounded-full shadow-lg text-sm" role="status">
          {toastMessage}
        </div>
      )}

      {/* Modals */}
      <Modal isOpen={isBrokerModalOpen} onClose={closeBrokerModal} title={editingBroker ? "증권사 수정" : "증권사 추가"}>
        <div className="space-y-4">
          <Input label="증권사 이름" id="brokerNameModal" name="name" value={brokerFormName} onChange={e => setBrokerFormName(e.target.value)} />
          <div className="flex justify-end pt-4">
            <Button onClick={handleSaveBroker}>저장</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isAccountModalOpen} onClose={closeAccountModal} title={editingAccount ? "계좌 수정" : "계좌 추가"}>
        <div className="space-y-4">
          <Input label="계좌 이름" id="accountNameModal" name="name" value={accountForm.name} onChange={handleAccountFormChange} />
          <Select label="증권사" id="brokerIdModal" name="brokerId" value={accountForm.brokerId} onChange={handleAccountFormChange}>
            {(brokers || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <div className="flex justify-end pt-4">
            <Button onClick={handleSaveAccount}>저장</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isBankAccountModalOpen} onClose={closeBankAccountModal} title={editingBankAccount ? "은행 계좌 수정" : "은행 계좌 추가"}>
        <div className="space-y-4">
          <Input label="은행명" id="bankNameModal" name="bankName" value={bankAccountForm.bankName} onChange={handleBankAccountFormChange} />
          <Input label="계좌 별명" id="bankAccountNameModal" name="name" value={bankAccountForm.name} onChange={handleBankAccountFormChange} />
          <div className="flex justify-end pt-4">
            <Button onClick={handleSaveBankAccount}>저장</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isStockModalOpen} onClose={closeStockModal} title={editingStock ? "주식 종목 수정" : "주식 종목 추가"}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSaveStock(); }}>
          <Input label="종목 티커" id="stockTickerModal" name="ticker" value={stockForm.ticker} onChange={handleStockFormChange} required />
          <Input label="종목명" id="stockNameModal" name="name" value={stockForm.name} onChange={handleStockFormChange} required />
          <Select label="카테고리" id="stockCategoryModal" name="category" value={stockForm.category} onChange={handleStockFormChange} required>
            {PORTFOLIO_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <div className="flex items-center pt-2 gap-6">
            <div className="flex items-center">
              <input
                  id="isPortfolioModal"
                  name="isPortfolio"
                  type="checkbox"
                  checked={stockForm.isPortfolio}
                  onChange={handleStockFormChange}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-light-primary focus:ring-light-primary bg-gray-100 dark:bg-gray-700"
              />
              <label htmlFor="isPortfolioModal" className="ml-3 block text-sm font-medium">
                  포트폴리오 포함
              </label>
            </div>
            <div className="flex items-center">
              <input
                  id="isEtfModal"
                  name="isEtf"
                  type="checkbox"
                  checked={stockForm.isEtf}
                  onChange={handleStockFormChange}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-light-primary focus:ring-light-primary bg-gray-100 dark:bg-gray-700"
              />
              <label htmlFor="isEtfModal" className="ml-3 block text-sm font-medium">
                  ETF
              </label>
            </div>
          </div>
          {stockForm.isEtf && (
            <Input label="실부담비용률 (%)" id="expenseRatioModal" name="expenseRatio" type="text" inputMode="decimal" value={stockForm.expenseRatio} onChange={handleStockFormChange} placeholder="예: 0.05" />
          )}
          <div className="flex justify-end pt-4">
              <Button type="submit">저장</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isGoalModalOpen} onClose={closeGoalModal} title={editingGoal ? "투자 목표 수정" : "새 투자 목표 추가"}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <Input label="목표 이름" name="name" value={goalForm.name} onChange={e => setGoalForm(p => ({...p, name: e.target.value}))} required />
            <div className="grid grid-cols-2 gap-4">
              <Input label="시작일" name="creationDate" type="date" value={goalForm.creationDate} onChange={handleGoalFormChange} required />
              <Input label="목표달성일 (선택)" name="targetDate" type="date" value={goalForm.targetDate} onChange={handleGoalFormChange} />
            </div>
            <Select label="목표 유형" name="goalType" value={goalForm.goalType} onChange={handleGoalFormChange}>
              <option value="amount">금액 목표</option>
              <option value="shares">종목 수량 목표</option>
            </Select>

            {goalForm.goalType === 'amount' ? (
              <Input label="목표 금액" name="targetAmount" type="text" inputMode="numeric" value={formatNumber(goalForm.targetAmount || 0)} onChange={handleGoalFormChange} required />
            ) : (
              <div className="pt-4 mt-4 border-t border-gray-200/50 dark:border-slate-700/50">
                <h3 className="text-md font-semibold">목표 수량 설정</h3>
                <p className="text-xs text-light-secondary dark:text-dark-secondary mb-3">
                  이 목표를 위해 모을 종목별 주식 수를 입력하세요.
                </p>
                <div className="space-y-3 max-h-60 overflow-y-auto p-2 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                  {(stocks || []).map(stock => (
                    <div key={stock.id} className="grid grid-cols-3 gap-2 items-center">
                      <label htmlFor={`goal-shares-${stock.id}`} className="text-sm col-span-2 truncate">{stock.name}</label>
                      <Input 
                        id={`goal-shares-${stock.id}`}
                        type="text"
                        inputMode="numeric"
                        value={goalTargetShares[stock.id] || ''}
                        onChange={(e) => handleGoalSharesChange(stock.id, e.target.value)}
                        placeholder="주"
                        label=""
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
        <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-gray-700 mt-4">
            <Button onClick={handleSaveGoal}>저장</Button>
        </div>
      </Modal>

      <Modal isOpen={confirmation.isOpen} onClose={handleConfirmationCancel} title={confirmation.title}>
        <p className="text-light-text dark:text-dark-text">{confirmation.message}</p>
        <div className="flex justify-end mt-6 space-x-2">
          <Button onClick={handleConfirmationCancel} variant="secondary">
            취소
          </Button>
          <Button onClick={confirmation.onConfirm} className={confirmation.confirmVariant === 'danger' ? 'bg-loss text-white hover:bg-red-700 focus:ring-red-500' : ''}>
            {confirmation.confirmText}
          </Button>
        </div>
      </Modal>

      {isImporting && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-[100] flex flex-col justify-center items-center p-4 text-center" role="status" aria-live="assertive">
          <svg aria-hidden="true" className="w-12 h-12 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
              <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0492C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill"/>
          </svg>
          <div className="text-white text-xl font-semibold mt-4">
              {importStatus || '데이터를 처리하는 중입니다...'}
          </div>
          <p className="text-white mt-2">
            앱을 새로고침할 때까지 잠시만 기다려주세요.
          </p>
        </div>
      )}
    </div>
  );
};

export default IndexScreen;