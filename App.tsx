import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Screen, Theme, TradeType, Account, Broker, Stock, Trade, AccountTransaction, BankAccount, InitialPortfolio, MonthlyAccountValue, PortfolioCategory, HistoricalGain, AlertThresholds, TransactionType, InvestmentGoal } from './types';
import HomeScreen from './screens/HomeScreen';
import StockStatusScreen from './screens/StockStatusScreen';
import AccountStatusScreen from './screens/AccountStatusScreen';
import TradeHistoryScreen from './screens/TradeHistoryScreen';
import AccountTransactionsScreen from './screens/AccountTransactionsScreen';
import ProfitManagementScreen from './screens/ProfitManagementScreen';
import MonthlyHistoryScreen from './screens/MonthlyHistoryScreen';
import IndexScreen from './screens/IndexScreen';
import RebalancingScreen from './screens/RebalancingScreen';
import MenuScreen from './screens/MenuScreen';
import HoldingsStatusScreen from './screens/HoldingsStatusScreen';
import GoalInvestingScreen from './screens/GoalInvestingScreen';
import PasswordScreen from './screens/PasswordScreen';
import BottomNav from './components/BottomNav';
import Header from './components/Header';
import Modal from './components/ui/Modal';
import Button from './components/ui/Button';
import { useLocalStorage } from './hooks/useLocalStorage';
import { fetchStockPrices } from './services/stockPriceService';
import { exportAllData } from './services/exportService';
import { PORTFOLIO_CATEGORIES } from './constants';

// Default Data for initial setup
const defaultBrokerId = 'broker-mirae';
const DEFAULT_BROKERS: Broker[] = [
  { id: defaultBrokerId, name: '미래에셋증권' },
];

const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc-mirae-1', name: '일반종합', brokerId: defaultBrokerId },
  { id: 'acc-mirae-2', name: 'CMA', brokerId: defaultBrokerId },
  { id: 'acc-mirae-3', name: 'ISA(중개형)', brokerId: defaultBrokerId },
  { id: 'acc-mirae-4', name: '연금저축1', brokerId: defaultBrokerId },
  { id: 'acc-mirae-5', name: '연금저축(이전)', brokerId: defaultBrokerId },
  { id: 'acc-mirae-6', name: '개인IRP', brokerId: defaultBrokerId },
  { id: 'acc-mirae-7', name: '퇴직DC', brokerId: defaultBrokerId },
];

const DEFAULT_STOCKS: Stock[] = [
  { id: 'stock-0043B0', ticker: '0043B0', name: 'Tiger 머니마켓액티브', category: PortfolioCategory.Cash, isPortfolio: true },
  { id: 'stock-497880', ticker: '497880', name: 'SOL CD금리&머니마켓액티브', category: PortfolioCategory.Cash, isPortfolio: true },
  { id: 'stock-411060', ticker: '411060', name: 'ACE KRX금현물', category: PortfolioCategory.Alternatives, isPortfolio: true },
  { id: 'stock-0064K0', ticker: '0064K0', name: 'Kodex 금액티브', category: PortfolioCategory.Alternatives, isPortfolio: true },
  { id: 'stock-365780', ticker: '365780', name: 'ACE 국고채10년', category: PortfolioCategory.Bonds, isPortfolio: true },
  { id: 'stock-305080', ticker: '305080', name: 'Tiger 미국채10년 선물', category: PortfolioCategory.Bonds, isPortfolio: true },
  { id: 'stock-0085P0', ticker: '0085P0', name: 'ACE 미국10년국채액티브', category: PortfolioCategory.Bonds, isPortfolio: true },
  { id: 'stock-161510', ticker: '161510', name: 'Plus 고배당주', category: PortfolioCategory.Dividend, isPortfolio: true },
  { id: 'stock-0098N0', ticker: '0098N0', name: 'Plus 자사주매입고배당주', category: PortfolioCategory.Dividend, isPortfolio: true },
  { id: 'stock-294400', ticker: '294400', name: 'Kiwoom 200TR', category: PortfolioCategory.Stock, isPortfolio: true },
  { id: 'stock-360750', ticker: '360750', name: 'Tiger 미국S&P500', category: PortfolioCategory.Stock, isPortfolio: true },
  { id: 'stock-379810', ticker: '379810', name: 'Kodex 미국나스닥100', category: PortfolioCategory.Stock, isPortfolio: true },
  { id: 'stock-283580', ticker: '283580', name: 'Kodex 차이나CSI300', category: PortfolioCategory.Stock, isPortfolio: true },
];

const DEFAULT_INITIAL_PORTFOLIO: InitialPortfolio = {
  'stock-0043B0': 6.24,
  'stock-497880': 3.76,
  'stock-411060': 11.96,
  'stock-0064K0': 4,
  'stock-365780': 10.48,
  'stock-305080': 7.14,
  'stock-0085P0': 2.73,
  'stock-161510': 10.85,
  'stock-0098N0': 4.15,
  'stock-294400': 7.49,
  'stock-360750': 18.27,
  'stock-379810': 3.57,
  'stock-283580': 9.38,
};

const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  global: { caution: 20, warning: 30 },
  categories: {},
  stocks: {}
};

interface AppProps {
  onForceRemount: () => void;
}

const calculateXIRR = (cashflows: { amount: number; date: Date }[]): number => {
    if (cashflows.length < 2) return 0;
    
    const hasPositive = cashflows.some(cf => cf.amount > 0);
    const hasNegative = cashflows.some(cf => cf.amount < 0);
    if (!hasPositive || !hasNegative) return 0;

    cashflows.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    const calculateNPV = (rate: number): number => {
        let npv = 0;
        const firstDate = cashflows[0].date;
        for (const cf of cashflows) {
            const daysDiff = (cf.date.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
            const yearsDiff = daysDiff / 365.25;
            npv += cf.amount / Math.pow(1 + rate, yearsDiff);
        }
        return npv;
    };

    const MAX_ITERATIONS = 100;
    const PRECISION = 1e-7;
    let low = -0.99; // -99%
    let high = 10.0; // 1000%
    let mid = 0;

    const npvLow = calculateNPV(low);
    const npvHigh = calculateNPV(high);

    if (npvLow * npvHigh > 0) {
        return 0;
    }

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        mid = (low + high) / 2;
        const npvMid = calculateNPV(mid);
        
        if (Math.abs(npvMid) < PRECISION) {
            return mid * 100; // Return as percentage
        }

        if (npvLow * npvMid < 0) {
            high = mid;
        } else {
            low = mid;
        }
    }

    return mid * 100;
};

const calculateTWRR = (monthlyValues: MonthlyAccountValue[], transactions: AccountTransaction[], securityAccountIds: Set<string>): number => {
    if (!monthlyValues || monthlyValues.length < 2) {
        return 0;
    }
    const sortedValues = [...monthlyValues].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const firstValuationDate = new Date(sortedValues[0].date);
    const firstPeriodNetCashFlow = (transactions || [])
        .filter(t => {
            if (new Date(t.date) > firstValuationDate) return false;
            if (t.transactionType === TransactionType.Dividend) return false;
            if (t.counterpartyAccountId && securityAccountIds.has(t.counterpartyAccountId)) return false;
            return true;
        })
        .reduce((acc, t) => {
            const amount = Number(t.amount) || 0;
            return t.transactionType === TransactionType.Deposit ? acc + amount : acc - amount;
        }, 0);
    
    let subPeriodReturns: number[] = [];
    if (firstPeriodNetCashFlow > 0) {
        const endValue = sortedValues[0].totalValue;
        const hpr = (endValue - firstPeriodNetCashFlow) / firstPeriodNetCashFlow;
        subPeriodReturns.push(1 + hpr);
    }

    for (let i = 1; i < sortedValues.length; i++) {
        const prevValuation = sortedValues[i - 1];
        const currentValuation = sortedValues[i];
        const prevDate = new Date(prevValuation.date);
        const currentDate = new Date(currentValuation.date);
        const periodNetCashFlow = (transactions || [])
            .filter(t => {
                const txDate = new Date(t.date);
                if (txDate <= prevDate || txDate > currentDate) return false;
                if (t.transactionType === TransactionType.Dividend) return false;
                if (t.counterpartyAccountId && securityAccountIds.has(t.counterpartyAccountId)) return false;
                return true;
            })
            .reduce((acc, t) => {
                const amount = Number(t.amount) || 0;
                return t.transactionType === TransactionType.Deposit ? acc + amount : acc - amount;
            }, 0);
        const startValue = prevValuation.totalValue;
        const endValue = currentValuation.totalValue;
        if (startValue > 0) {
            const hpr = (endValue - startValue - periodNetCashFlow) / startValue;
            subPeriodReturns.push(1 + hpr);
        }
    }

    if (subPeriodReturns.length === 0) return 0;
    const compoundedReturn = subPeriodReturns.reduce((acc, r) => acc * r, 1);
    const allRelevantDates = (transactions || []).length > 0
      ? transactions.map(t => new Date(t.date))
      : [new Date()];
    const startDate = new Date(Math.min(...allRelevantDates.map(d => d.getTime())));
    const lastDate = new Date(sortedValues[sortedValues.length - 1].date);
    const totalDays = (lastDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (totalDays <= 0) return 0;
    const periodInYears = totalDays / 365.25;
    if (compoundedReturn < 0) return -100.0;
    const annualizedTwrr = Math.pow(compoundedReturn, 1 / periodInYears) - 1;
    return annualizedTwrr * 100;
};


const App: React.FC<AppProps> = ({ onForceRemount }) => {
  const [theme, setTheme] = useLocalStorage<Theme>('theme', Theme.Light);
  const [password, setPassword] = useLocalStorage<string | null>('app-password', '9635');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!password);
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.Home);
  const [isDataOperationInProgress, setIsDataOperationInProgress] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [rebalancingStockId, setRebalancingStockId] = useState<string | null>(null);

  const [brokers, setBrokers] = useLocalStorage<Broker[]>('brokers', DEFAULT_BROKERS);
  const [accounts, setAccounts] = useLocalStorage<Account[]>('accounts', DEFAULT_ACCOUNTS);
  const [stocks, setStocks] = useLocalStorage<Stock[]>('stocks', DEFAULT_STOCKS);
  const [trades, setTrades] = useLocalStorage<Trade[]>('trades', []);
  const [transactions, setTransactions] = useLocalStorage<AccountTransaction[]>('transactions', []);
  const [bankAccounts, setBankAccounts] = useLocalStorage<BankAccount[]>('bankAccounts', []);
  const [initialPortfolio, setInitialPortfolio] = useLocalStorage<InitialPortfolio>('initialPortfolio', DEFAULT_INITIAL_PORTFOLIO);
  const [monthlyValues, setMonthlyValues] = useLocalStorage<MonthlyAccountValue[]>('monthlyValues', []);
  const [stockPrices, setStockPrices] = useLocalStorage<{ [key: string]: number }>('stockPrices', {});
  const [backgroundFetchInterval, setBackgroundFetchInterval] = useLocalStorage<number>('backgroundFetchInterval', 30);
  const [showSummary, setShowSummary] = useLocalStorage<boolean>('showSummary', true);
  const [historicalGains, setHistoricalGains] = useLocalStorage<HistoricalGain[]>('historicalGains', []);
  const [alertThresholds, setAlertThresholds] = useLocalStorage<AlertThresholds>('alertThresholds', DEFAULT_ALERT_THRESHOLDS);
  const [homeScreenPreference, setHomeScreenPreference] = useLocalStorage<'HOME' | 'HOLDINGS_STATUS'>('homeScreenPreference', Screen.HoldingsStatus);
  const [investmentGoals, setInvestmentGoals] = useLocalStorage<InvestmentGoal[]>('investmentGoals', []);


  const [animationClass, setAnimationClass] = useState('');

  const swipeNavOrder = useMemo(() => {
    if (homeScreenPreference === Screen.Home) {
      return [
        Screen.Menu,
        Screen.StockStatus,
        Screen.Home,
        Screen.HoldingsStatus,
        Screen.AccountStatus,
      ];
    } else { // HOLDINGS_STATUS is home
      return [
        Screen.Menu,
        Screen.StockStatus,
        Screen.HoldingsStatus,
        Screen.Home,
        Screen.AccountStatus,
      ];
    }
  }, [homeScreenPreference]);

  const screenIndexRef = useRef(swipeNavOrder.findIndex(s => s === currentScreen));
  const notifiedWarningsRef = useRef(new Set<string>());
  
  useEffect(() => {
    fetch('/metadata.json')
        .then(response => response.json())
        .then(data => {
            if (data?.name) {
                const versionMatch = data.name.match(/V\d+\.\d+\.\d+/);
                if (versionMatch) {
                    setAppVersion(versionMatch[0]);
                }
            }
        })
        .catch(error => console.error("Failed to load app version:", error));
  }, []);
  
  useEffect(() => {
    if (homeScreenPreference) {
      setCurrentScreen(homeScreenPreference);
    }
  }, [homeScreenPreference]);

  const navigateToScreen = useCallback((newScreen: Screen) => {
      if (rebalancingStockId) {
        setRebalancingStockId(null);
      }
      const newIndex = swipeNavOrder.findIndex(s => s === newScreen);
      const oldIndex = screenIndexRef.current;
      
      if (newIndex === oldIndex) return;

      if (newIndex > oldIndex) {
          setAnimationClass('slide-in-from-right');
      } else if (newIndex < oldIndex) {
          setAnimationClass('slide-in-from-left');
      } else {
          setAnimationClass('');
      }
      
      screenIndexRef.current = newIndex;
      setCurrentScreen(newScreen);
  }, [swipeNavOrder, rebalancingStockId]);

  const navigateToRebalancing = useCallback((stockId: string) => {
    setRebalancingStockId(stockId);
    setAnimationClass('slide-in-from-right');
    screenIndexRef.current = -1;
    setCurrentScreen(Screen.Rebalancing);
  }, []);

  const SWIPE_THRESHOLD = 80;
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
      if (currentScreen === Screen.Rebalancing) return;
      touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      if (currentScreen === Screen.Rebalancing || !touchStartX.current) return;
      
      const touchEndX = e.changedTouches[0].clientX;
      const distance = touchStartX.current - touchEndX;
      const isLeftSwipe = distance > SWIPE_THRESHOLD;
      const isRightSwipe = distance < -SWIPE_THRESHOLD;

      if (isLeftSwipe || isRightSwipe) {
          const currentIndex = swipeNavOrder.findIndex(s => s === currentScreen);
          if (currentIndex === -1) return;

          let nextIndex;
          if (isLeftSwipe) {
              nextIndex = currentIndex + 1;
          } else {
              nextIndex = currentIndex - 1;
          }

          if (nextIndex >= 0 && nextIndex < swipeNavOrder.length) {
              navigateToScreen(swipeNavOrder[nextIndex]);
          }
      }
      touchStartX.current = null;
  };

  useEffect(() => {
    const hasLaunchedBefore = localStorage.getItem('has_launched_before');
    if (!hasLaunchedBefore) {
        console.log("First launch detected. Clearing default data.");
        setBrokers([]);
        setAccounts([]);
        setStocks([]);
        setInitialPortfolio({});
        setBankAccounts([]);
        setTrades([]);
        setTransactions([]);
        setMonthlyValues([]);
        setHistoricalGains([]);
        setInvestmentGoals([]);
        localStorage.setItem('has_launched_before', 'true');
    }
  }, [setBrokers, setAccounts, setStocks, setInitialPortfolio, setBankAccounts, setTrades, setTransactions, setMonthlyValues, setHistoricalGains, setInvestmentGoals]);

  const stockMap = useMemo(() => new Map((stocks || []).map(s => [s.id, s])), [stocks]);
  const securityAccountIds = useMemo(() => new Set((accounts || []).map(a => a.id)), [accounts]);

  const tickersToFetch = useMemo(() => {
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

    const stockIdsInHoldings = Object.entries(holdingsMap)
      .filter(([, data]) => data.quantity > 0.00001)
      .map(([stockId]) => stockId);
    
    const tickers = stockIdsInHoldings
      .map(stockId => stockMap.get(stockId)?.ticker)
      .filter((ticker): ticker is string => !!ticker);
      
    return [...new Set(tickers)];
  }, [trades, stockMap]);

  const fetchAndSetPrices = useCallback(async (): Promise<boolean> => {
    if (tickersToFetch.length === 0) {
      console.log('No stocks to fetch prices for.');
      return true;
    }
  
    try {
      console.log(`Fetching prices for ${tickersToFetch.length} tickers...`);
      const { prices: newPrices, errors } = await fetchStockPrices(tickersToFetch);
      
      if (Object.keys(newPrices).length > 0) {
        setStockPrices(prevPrices => ({
          ...prevPrices,
          ...newPrices,
        }));
      }
      
      const hasErrors = Object.keys(errors).length > 0;
      if (hasErrors) {
        console.warn('Some tickers failed to fetch (will be retried):', errors);
      }
      
      const isSuccess = Object.keys(newPrices).length > 0 || !hasErrors;
      return isSuccess;
    } catch (error) {
      console.error('An unexpected error occurred during price fetch (will be retried):', error);
      return false;
    }
  }, [tickersToFetch, setStockPrices]);

  const timeoutIdRef = useRef<number | null>(null);

  useEffect(() => {
    const FOREGROUND_INTERVAL = 5 * 60 * 1000;
    const BACKGROUND_INTERVAL = backgroundFetchInterval * 60 * 1000;
    const FAILURE_RETRY_INTERVAL = 5 * 60 * 1000;

    const clearExistingTimeout = () => {
        if (timeoutIdRef.current) {
            clearTimeout(timeoutIdRef.current);
            timeoutIdRef.current = null;
        }
    };

    const poll = async () => {
        const wasSuccessful = await fetchAndSetPrices();
        
        let interval;
        if (wasSuccessful) {
            interval = document.visibilityState === 'visible'
                ? FOREGROUND_INTERVAL
                : BACKGROUND_INTERVAL;
            console.log(`Fetch successful. Next poll scheduled in ${interval / 60000} minutes.`);
        } else {
            interval = FAILURE_RETRY_INTERVAL;
            console.log(`Fetch failed. Retrying in ${interval / 60000} minutes.`);
        }
        
        clearExistingTimeout();
        timeoutIdRef.current = window.setTimeout(poll, interval);
    };
    
    const scheduleNextPoll = () => {
        clearExistingTimeout();
        const interval = document.visibilityState === 'visible'
            ? FOREGROUND_INTERVAL
            : BACKGROUND_INTERVAL;
        
        console.log(`Next price fetch scheduled in ${interval / 60000} minutes.`);
        timeoutIdRef.current = window.setTimeout(poll, interval);
    };

    const handleVisibilityChange = () => {
        clearExistingTimeout();
        if (document.visibilityState === 'visible') {
            console.log("App is active. Resetting poll interval to foreground settings.");
            scheduleNextPoll();
        } else {
            console.log(`App is inactive. Scheduling next fetch in ${backgroundFetchInterval} minutes.`);
            scheduleNextPoll();
        }
    };

    poll();

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        clearExistingTimeout();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchAndSetPrices, backgroundFetchInterval]);


  useEffect(() => {
    if (theme === Theme.Dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => prevTheme === Theme.Light ? Theme.Dark : Theme.Light);
  }, [setTheme]);

  const handleLogin = (pw: string) => {
    if (password && pw === password) {
      setIsAuthenticated(true);
    } else {
        alert("비밀번호가 틀렸습니다.");
    }
  };

  const handleAppExit = (shouldExport: boolean) => {
    setIsExitModalOpen(false);
    if (shouldExport) {
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
    }
    setTimeout(() => {
        document.body.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100vh; font-size:20px; color: #333; background-color: #f0f0f0; text-align: center; padding: 20px;">앱이 종료되었습니다.<br/>이 탭을 닫으셔도 좋습니다.</div>';
    }, 500);
  };
  
  const mainPortfolioTrades = useMemo(() => (trades || []).filter(t => !t.goalId), [trades]);
  const mainPortfolioTransactions = useMemo(() => (transactions || []).filter(t => !t.goalId), [transactions]);

  const totalCashBalance = useMemo(() => {
    let totalCash = 0;
    (accounts || []).forEach(account => {
        const accountTrades = mainPortfolioTrades.filter(t => t.accountId === account.id);
        const totalBuyCost = accountTrades.filter(t => t.tradeType === TradeType.Buy).reduce((sum, t) => sum + (Number(t.price) || 0) * (Number(t.quantity) || 0), 0);
        const totalSellProceeds = accountTrades.filter(t => t.tradeType === TradeType.Sell).reduce((sum, t) => sum + (Number(t.price) || 0) * (Number(t.quantity) || 0), 0);
        let netCashFromTransactions = 0;
        mainPortfolioTransactions.forEach(t => {
            const amount = Number(t.amount) || 0;
            if (t.accountId === account.id && (t.transactionType === TransactionType.Deposit || t.transactionType === TransactionType.Dividend)) {
                netCashFromTransactions += amount;
            }
            if (t.counterpartyAccountId === account.id && t.transactionType === TransactionType.Withdrawal) {
                netCashFromTransactions += amount;
            }
            if (t.accountId === account.id && t.transactionType === TransactionType.Withdrawal) {
                netCashFromTransactions -= amount;
            }
            if (t.counterpartyAccountId === account.id && t.transactionType === TransactionType.Deposit) {
                netCashFromTransactions -= amount;
            }
        });
        const historicalPnlForAccount = (historicalGains || [])
            .filter(g => g.accountId === account.id)
            .reduce((sum, g) => sum + (Number(g.realizedPnl) || 0), 0);
        const cashBalance = netCashFromTransactions + totalSellProceeds - totalBuyCost + historicalPnlForAccount;
        totalCash += cashBalance;
    });
    return totalCash;
  }, [accounts, mainPortfolioTrades, mainPortfolioTransactions, historicalGains]);


  const netExternalDeposits = useMemo(() => {
    return mainPortfolioTransactions.reduce((acc, t) => {
        if (t.transactionType === TransactionType.Dividend) {
            return acc;
        }
        if (t.counterpartyAccountId && securityAccountIds.has(t.counterpartyAccountId)) {
            return acc;
        }
        const amount = Number(t.amount) || 0;
        if (t.transactionType === TransactionType.Deposit) {
            return acc + amount;
        }
        if (t.transactionType === TransactionType.Withdrawal) {
            return acc - amount;
        }
        return acc;
    }, 0);
  }, [mainPortfolioTransactions, securityAccountIds]);
  
  const financialSummary = useMemo(() => {
    const holdings: { [stockId: string]: { quantity: number } } = {};
    for (const trade of mainPortfolioTrades) {
      if (!trade || !trade.stockId) continue;
      const quantity = Number(trade.quantity) || 0;
      if (!holdings[trade.stockId]) holdings[trade.stockId] = { quantity: 0 };
      if (trade.tradeType === TradeType.Buy) {
        holdings[trade.stockId].quantity += quantity;
      } else {
        holdings[trade.stockId].quantity -= quantity;
      }
    }

    let currentStockValue = 0;
    const valueByStock: { [stockId: string]: number } = {};
    for (const stockId in holdings) {
        if (holdings[stockId].quantity > 0) {
            const stock = stockMap.get(stockId);
            const ticker = stock?.ticker;
            const currentPrice = ticker ? stockPrices[ticker] ?? 0 : 0;
            const value = holdings[stockId].quantity * currentPrice;
            currentStockValue += value;
            valueByStock[stockId] = value;
        }
    }
    
    const totalAssets = currentStockValue + totalCashBalance;
    const profitLoss = totalAssets - netExternalDeposits;
    const ccr = netExternalDeposits > 0 ? (profitLoss / netExternalDeposits) * 100 : 0;
    
    const cashFlows: { amount: number; date: Date }[] = [];
    mainPortfolioTransactions.forEach(t => {
        if (t.transactionType === TransactionType.Dividend) return;
        if (t.counterpartyAccountId && securityAccountIds.has(t.counterpartyAccountId)) return;
        const amount = Number(t.amount) || 0;
        const date = new Date(t.date);
        if (t.transactionType === TransactionType.Deposit) {
            cashFlows.push({ amount: -amount, date });
        } else if (t.transactionType === TransactionType.Withdrawal) {
            cashFlows.push({ amount: amount, date });
        }
    });

    if (totalAssets > 0 || cashFlows.length > 0) {
        cashFlows.push({ amount: totalAssets, date: new Date() });
    }
    const mwrr = calculateXIRR(cashFlows);

    const currentYear = new Date().getFullYear();
    const startOfCurrentYear = new Date(currentYear, 0, 1);
    const lastYearValues = (monthlyValues || [])
        .filter(mv => new Date(mv.date).getTime() < startOfCurrentYear.getTime())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    let startOfYearAssets;
    if (lastYearValues.length > 0) {
        startOfYearAssets = Number(lastYearValues[0].totalValue) || 0;
    } else {
        startOfYearAssets = mainPortfolioTransactions
            .filter(t => {
                if (new Date(t.date) >= startOfCurrentYear) return false;
                if (t.transactionType === TransactionType.Dividend) return false;
                if (t.counterpartyAccountId && securityAccountIds.has(t.counterpartyAccountId)) return false;
                return true;
            })
            .reduce((acc, t) => {
                const amount = Number(t.amount) || 0;
                if (t.transactionType === TransactionType.Deposit) return acc + amount;
                if (t.transactionType === TransactionType.Withdrawal) return acc - amount;
                return acc;
            }, 0);
    }
    
    const netInflowThisYear = mainPortfolioTransactions
        .filter(t => {
            if (new Date(t.date).getFullYear() !== currentYear) return false;
            if (t.transactionType === TransactionType.Dividend) return false;
            if (t.counterpartyAccountId && securityAccountIds.has(t.counterpartyAccountId)) return false;
            return true;
        })
        .reduce((acc, t) => {
          const amount = (Number(t.amount) || 0);
          if (t.transactionType === TransactionType.Deposit) return acc + amount;
          if (t.transactionType === TransactionType.Withdrawal) return acc - amount;
          return acc;
        }, 0);

    const ytdProfit = totalAssets - startOfYearAssets - netInflowThisYear;
    const ytdBase = startOfYearAssets + netInflowThisYear;
    const ytd = ytdBase > 0 ? (ytdProfit / ytdBase) * 100 : 0;
    const twrr = calculateTWRR(monthlyValues, mainPortfolioTransactions, securityAccountIds);
    const portfolioStockIds = new Set((stocks || []).filter(s => s.isPortfolio).map(s => s.id));
    
    let totalPortfolioStockValue = 0;
    for (const stockId in valueByStock) {
        if (portfolioStockIds.has(stockId)) {
            totalPortfolioStockValue += valueByStock[stockId];
        }
    }

    const targetPercentagesByCategory: { [key in PortfolioCategory]?: number } = {};
    const individualStocksWithDetails = (stocks || [])
      .filter(stock => stock.isPortfolio)
      .map(stock => {
        const currentValue = valueByStock[stock.id] || 0;
        const currentWeight = totalPortfolioStockValue > 0 ? (currentValue / totalPortfolioStockValue) * 100 : 0;
        const targetWeight = (initialPortfolio || {})[stock.id] || 0;
        const requiredPurchase = (totalPortfolioStockValue * (targetWeight / 100)) - currentValue;
        const disparityRatio = targetWeight > 0 ? ((currentWeight - targetWeight) / targetWeight) * 100 : (currentWeight > 0 ? Infinity : 0);
        
        if (targetWeight > 0) {
            targetPercentagesByCategory[stock.category] = (targetPercentagesByCategory[stock.category] || 0) + targetWeight;
        }
        
        return {
            ...stock,
            currentValue,
            currentWeight,
            targetWeight,
            deviation: currentWeight - targetWeight,
            requiredPurchase,
            disparityRatio,
        };
      }).filter(s => s.currentValue > 0 || s.targetWeight > 0);


    const portfolioChartData = PORTFOLIO_CATEGORIES.map(category => {
      const stocksInCategory = individualStocksWithDetails.filter(s => s.category === category);
      const currentValue = stocksInCategory.reduce((sum, s) => sum + s.currentValue, 0);
      const currentPercentage = totalPortfolioStockValue > 0 ? (currentValue / totalPortfolioStockValue) * 100 : 0;
      const targetPercentage = targetPercentagesByCategory[category] || 0;
      
      return {
        name: category,
        value: currentValue,
        percentage: currentPercentage,
        targetPercentage: targetPercentage,
        difference: currentPercentage - targetPercentage,
        stocks: stocksInCategory.sort((a,b) => b.currentValue - a.currentValue),
      };
    }).filter(d => d.value > 0 || d.targetPercentage > 0);

    return {
      totalAssets,
      netExternalDeposits,
      profitLoss,
      ccr,
      mwrr,
      ytd,
      twrr,
      chartData: portfolioChartData,
      allStocks: individualStocksWithDetails,
      totalPortfolioValue: totalPortfolioStockValue,
    };
  }, [mainPortfolioTrades, mainPortfolioTransactions, stocks, stockPrices, stockMap, initialPortfolio, totalCashBalance, netExternalDeposits, monthlyValues, securityAccountIds, accounts, historicalGains]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted' && financialSummary) {
      const { allStocks } = financialSummary;
      const { global: globalThresholds, stocks: stockThresholds } = alertThresholds;

      const newWarnings: { name: string; disparityRatio: number }[] = [];

      allStocks.forEach((stock: any) => {
        if (stock.targetWeight > 0) {
          const stockThresh = stockThresholds[stock.id] || {};
          const warningThreshold = stockThresh.warning ?? globalThresholds.warning;
          const disparityDeviation = Math.abs(stock.disparityRatio);

          if (disparityDeviation > warningThreshold && !notifiedWarningsRef.current.has(stock.id)) {
            newWarnings.push({ name: stock.name, disparityRatio: stock.disparityRatio });
            notifiedWarningsRef.current.add(stock.id);
          } else if (disparityDeviation <= warningThreshold && notifiedWarningsRef.current.has(stock.id)) {
            // Clear notification status if it's back in range
            notifiedWarningsRef.current.delete(stock.id);
          }
        }
      });

      if (newWarnings.length > 0) {
        const notificationBody = newWarnings
          .map(w => `${w.name} (이격률 ${w.disparityRatio > 0 ? '+' : ''}${w.disparityRatio.toFixed(0)}%)`)
          .join(', ');
        
        if ('serviceWorker' in navigator && Notification.permission === 'granted') {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification('리밸런싱 경고', {
              body: `목표 비중과 차이가 큰 종목이 있습니다: ${notificationBody}`,
              icon: '/icon.svg',
              tag: 'rebalancing-warning' // 동일한 경고가 중복되지 않도록 태그를 사용합니다.
            });
          });
        }
      }
    }
  }, [financialSummary, alertThresholds]);

  const renderScreen = () => {
    switch (currentScreen) {
      case Screen.Home:
        return <HomeScreen 
          navigateToRebalancing={navigateToRebalancing}
          financialSummary={financialSummary}
          alertThresholds={alertThresholds}
          showSummary={showSummary}
          monthlyValues={monthlyValues}
          transactions={mainPortfolioTransactions}
          accounts={accounts}
        />;
      case Screen.StockStatus:
        return <StockStatusScreen 
          trades={mainPortfolioTrades} 
          stocks={stocks} 
          stockPrices={stockPrices} 
          initialPortfolio={initialPortfolio} 
        />;
      case Screen.AccountStatus:
        return <AccountStatusScreen 
          accounts={accounts} 
          brokers={brokers} 
          trades={mainPortfolioTrades} 
          transactions={mainPortfolioTransactions} 
          setTransactions={setTransactions}
          setCurrentScreen={navigateToScreen}
          bankAccounts={bankAccounts}
          stocks={stocks}
          stockPrices={stockPrices}
          historicalGains={historicalGains}
        />;
      case Screen.HoldingsStatus:
        return <HoldingsStatusScreen
          trades={mainPortfolioTrades} 
          stocks={stocks} 
          stockPrices={stockPrices} 
          initialPortfolio={initialPortfolio} 
          alertThresholds={alertThresholds}
        />;
      case Screen.TradeHistory:
        return <TradeHistoryScreen trades={trades} setTrades={setTrades} accounts={accounts} stocks={stocks} investmentGoals={investmentGoals} />;
      case Screen.AccountTransactions:
        return <AccountTransactionsScreen 
          transactions={transactions} 
          setTransactions={setTransactions} 
          accounts={accounts}
          bankAccounts={bankAccounts}
          investmentGoals={investmentGoals}
        />;
      case Screen.ProfitManagement:
        return <ProfitManagementScreen
          trades={mainPortfolioTrades}
          stocks={stocks}
          accounts={accounts}
          transactions={mainPortfolioTransactions}
          setTransactions={setTransactions}
          setCurrentScreen={navigateToScreen}
          historicalGains={historicalGains}
          setHistoricalGains={setHistoricalGains}
        />;
      case Screen.MonthlyHistory:
        return <MonthlyHistoryScreen
          monthlyValues={monthlyValues}
          setMonthlyValues={setMonthlyValues}
          transactions={mainPortfolioTransactions}
        />;
      case Screen.GoalInvesting:
        return <GoalInvestingScreen
          investmentGoals={investmentGoals}
          trades={trades}
          setTrades={setTrades}
          transactions={transactions}
          stocks={stocks}
          stockPrices={stockPrices}
          accounts={accounts}
        />;
      case Screen.Index:
        return <IndexScreen 
            appVersion={appVersion}
            brokers={brokers} setBrokers={setBrokers}
            accounts={accounts} setAccounts={setAccounts}
            bankAccounts={bankAccounts} setBankAccounts={setBankAccounts}
            stocks={stocks} setStocks={setStocks}
            initialPortfolio={initialPortfolio} setInitialPortfolio={setInitialPortfolio}
            password={password} setPassword={setPassword}
            trades={trades}
            transactions={transactions}
            monthlyValues={monthlyValues} setMonthlyValues={setMonthlyValues}
            historicalGains={historicalGains}
            investmentGoals={investmentGoals} setInvestmentGoals={setInvestmentGoals}
            setIsDataOperationInProgress={setIsDataOperationInProgress}
            onForceRemount={onForceRemount}
            backgroundFetchInterval={backgroundFetchInterval}
            setBackgroundFetchInterval={setBackgroundFetchInterval}
            showSummary={showSummary}
            setShowSummary={setShowSummary}
            alertThresholds={alertThresholds}
            setAlertThresholds={setAlertThresholds}
            homeScreenPreference={homeScreenPreference}
            setHomeScreenPreference={setHomeScreenPreference}
          />;
      case Screen.Menu:
        return <MenuScreen setCurrentScreen={navigateToScreen} />;
      case Screen.Rebalancing:
        return <RebalancingScreen
          stockId={rebalancingStockId!}
          setCurrentScreen={navigateToScreen}
          financialSummary={financialSummary}
          alertThresholds={alertThresholds}
        />;
      default:
        return <HomeScreen 
          navigateToRebalancing={navigateToRebalancing}
          financialSummary={financialSummary}
          alertThresholds={alertThresholds}
          showSummary={showSummary}
          monthlyValues={monthlyValues}
          transactions={transactions}
          accounts={accounts}
        />;
    }
  };

  if (!isAuthenticated) {
    return <PasswordScreen onLogin={handleLogin} />;
  }

  return (
    <div 
      className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text font-sans"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="container mx-auto max-w-4xl px-2 sm:px-4 pt-4 pb-24">
        <Header 
          theme={theme} 
          toggleTheme={toggleTheme} 
          currentScreen={currentScreen} 
          onOpenExitModal={() => setIsExitModalOpen(true)}
        />
        <main key={currentScreen} className={animationClass}>
          {renderScreen()}
        </main>
      </div>
      <BottomNav 
        currentScreen={currentScreen} 
        setCurrentScreen={navigateToScreen} 
        appVersion={appVersion}
        homeScreenPreference={homeScreenPreference}
      />

      <Modal isOpen={isExitModalOpen} onClose={() => setIsExitModalOpen(false)} title="앱 종료 확인">
        <p>앱을 종료하기 전에 현재 데이터를 엑셀 파일로 백업하시겠습니까?</p>
        <div className="flex justify-end mt-6 space-x-2">
            <Button onClick={() => setIsExitModalOpen(false)} variant="secondary">취소</Button>
            <Button onClick={() => handleAppExit(false)} variant="secondary">그냥 종료</Button>
            <Button onClick={() => handleAppExit(true)} className="bg-loss text-white hover:bg-red-700 focus:ring-red-500">내보내고 종료</Button>
        </div>
      </Modal>
    </div>
  );
};

export default App;