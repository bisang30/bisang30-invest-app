import React from 'react';
import { Theme, Screen } from '../types';
import { SunIcon, MoonIcon, PowerIcon, UserIcon, ArrowPathIcon } from './Icons';
import { User } from 'firebase/auth';

interface HeaderProps {
  theme: Theme;
  toggleTheme: () => void;
  currentScreen: Screen;
  onOpenExitModal: () => void;
  user: User | null;
  onLogin: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
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
  [Screen.GoalInvesting]: '목표 달성',
};

const Header: React.FC<HeaderProps> = ({ theme, toggleTheme, currentScreen, onOpenExitModal, user, onLogin, onRefresh, isRefreshing }) => {
  return (
    <header className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{screenTitles[currentScreen]}</h1>
      <div className="flex items-center gap-4">
        <button
          onClick={onRefresh}
          className={`p-2 rounded-full bg-light-card dark:bg-dark-card shadow-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
          aria-label="Refresh data"
          disabled={isRefreshing}
        >
          <ArrowPathIcon className="w-6 h-6 text-light-primary dark:text-dark-primary" />
        </button>
        {!user ? (
          <button
            onClick={onLogin}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-light-primary dark:bg-dark-primary text-white text-sm font-semibold shadow-md hover:opacity-90 transition-opacity"
          >
            <UserIcon className="w-4 h-4" />
            로그인
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {user.photoURL ? (
              <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border-2 border-light-primary" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-gray-500" />
              </div>
            )}
          </div>
        )}
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