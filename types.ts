export const Theme = {
  Light: 'light',
  Dark: 'dark',
} as const;
export type Theme = typeof Theme[keyof typeof Theme];


export const Screen = {
  Home: 'HOME',
  StockStatus: 'STOCK_STATUS',
  AccountStatus: 'ACCOUNT_STATUS',
  TradeHistory: 'TRADE_HISTORY',
  AccountTransactions: 'ACCOUNT_TRANSACTIONS',
  Index: 'INDEX',
  ProfitManagement: 'PROFIT_MANAGEMENT',
  MonthlyHistory: 'MONTHLY_HISTORY',
  Rebalancing: 'REBALANCING',
  Menu: 'MENU',
  GoalInvesting: 'GOAL_INVESTING',
  HoldingsStatus: 'HOLDINGS_STATUS',
} as const;
export type Screen = typeof Screen[keyof typeof Screen];

export const TradeType = {
  Buy: 'BUY',
  Sell: 'SELL',
} as const;
export type TradeType = typeof TradeType[keyof typeof TradeType];

export const TransactionType = {
  Deposit: 'DEPOSIT',
  Withdrawal: 'WITHDRAWAL',
  Dividend: 'DIVIDEND',
} as const;
export type TransactionType = typeof TransactionType[keyof typeof TransactionType];

export const PortfolioCategory = {
  Cash: '현금성자산',
  Alternatives: '대체(금)',
  Bonds: '채권',
  Dividend: '배당',
  Stock: '주식형',
} as const;
export type PortfolioCategory = typeof PortfolioCategory[keyof typeof PortfolioCategory];


export interface Broker {
  id: string;
  name: string;
}

export interface Account {
  id: string;
  name: string;
  brokerId: string;
}

export interface BankAccount {
  id: string;
  name: string;
  bankName: string;
}

export interface Stock {
  id: string;
  ticker: string;
  name: string;
  category: PortfolioCategory;
  isPortfolio: boolean;
  isEtf?: boolean;
  expenseRatio?: number;
}

export interface Trade {
  id:string;
  accountId: string;
  date: string;
  stockId: string;
  quantity: number;
  price: number;
  tradeType: TradeType;
  tradeMethod: string; // e.g. 'Online', 'Mobile'
  goalId?: string;
}

export interface AccountTransaction {
  id: string;
  date: string;
  accountId: string;
  amount: number;
  transactionType: TransactionType;
  counterpartyAccountId?: string;
  stockId?: string;
  goalId?: string;
}

export interface InvestmentGoal {
  id: string;
  name: string;
  creationDate: string; // YYYY-MM-DD
  targetDate?: string;   // YYYY-MM-DD (달성 목표일)
  goalType: 'amount' | 'shares';
  targetAmount?: number;
  targetShares?: { [stockId: string]: number };
}

export interface InitialPortfolio {
  [stockId: string]: number; // Maps stock ID to its percentage
}

export interface MonthlyAccountValue {
  id: string;
  date: string; // YYYY-MM-DD
  totalValue: number;
}

export interface HistoricalGain {
  id: string;
  accountId: string;
  date: string;
  stockName: string;
  realizedPnl: number;
  note?: string;
}

export interface Thresholds {
  caution: number;
  warning: number;
}

export interface AlertThresholds {
  global: Thresholds;
  categories: { [key in PortfolioCategory]?: Partial<Thresholds> };
  stocks: { [stockId: string]: Partial<Thresholds> };
}