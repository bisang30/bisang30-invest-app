import { Screen, PortfolioCategory } from './types';

export const DATA_VERSION = 2;

export const NAV_ITEMS = [
  { screen: Screen.StockStatus, label: '종목 현황' },
  { screen: Screen.AccountStatus, label: '계좌 현황' },
  { screen: Screen.Home, label: '투자 현황' },
  { screen: Screen.TradeHistory, label: '매매기록' },
  { screen: Screen.AccountTransactions, label: '계좌입출금' },
  { screen: Screen.ProfitManagement, label: '수익 관리' },
  { screen: Screen.MonthlyHistory, label: '월말 결산' },
  { screen: Screen.GoalInvesting, label: '목표 달성' },
  { screen: Screen.Index, label: '설정' },
  { screen: Screen.Menu, label: '메뉴' },
  { screen: Screen.HoldingsStatus, label: '포트폴리오 가꾸기' },
];

export const PORTFOLIO_CATEGORIES = Object.values(PortfolioCategory);