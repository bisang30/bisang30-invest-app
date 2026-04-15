import React from 'react';
import { Theme, Screen } from '../types';
import { SunIcon, MoonIcon, PowerIcon } from './Icons';

interface HeaderProps {
  theme: Theme;
  toggleTheme: () => void;
  currentScreen: Screen;
  onOpenExitModal: () => void;
}

const screenTitles: Record<Screen, string> = {
  [Screen.Home]: '투자 현황',
  [Screen.StockStatus]: '종목 현황',
  [Screen.AccountStatus]: '계좌 현황',
  [Screen.TradeHistory]: '매매기록',
  [Screen.AccountTransactions]: '계좌 입출금',
  [Screen.ProfitManagement]: '수익 관리',
  [Screen.MonthlyHistory]: '월말 결산',
  [Screen.Index]: '설정',
  [Screen.Rebalancing]: '포트폴리오 리밸런싱',
  [Screen.Menu]: '전체 메뉴',
  [Screen.HoldingsStatus]: '포트폴리오 가꾸기',
  // FIX: Added missing GOAL_INVESTING to screenTitles
  [Screen.GoalInvesting]: '목표 달성',
};

const Header: React.FC<HeaderProps> = ({ theme, toggleTheme, currentScreen, onOpenExitModal }) => {
  return (
    <header className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{screenTitles[currentScreen]}</h1>
      <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full bg-light-card dark:bg-dark-card shadow-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === Theme.Light ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
        </button>
        {currentScreen === Screen.Home && (
          <button
            onClick={onOpenExitModal}
            className="p-2 rounded-full bg-light-card dark:bg-dark-card shadow-md hover:bg-red-100 dark:hover:bg-red-900/50 text-loss transition-colors"
            aria-label="App Exit"
          >
            <PowerIcon className="w-6 h-6" />
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;