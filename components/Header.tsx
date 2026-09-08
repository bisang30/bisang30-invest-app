import React, { useState, useRef, useEffect } from 'react';
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
  onSyncFromCloud?: () => Promise<void>;
  onBackupToCloud?: () => Promise<void>;
  onLogout?: () => Promise<void>;
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
  [Screen.AssetAllocation]: '통합 비중분석',
};

const Header: React.FC<HeaderProps> = ({
  theme,
  toggleTheme,
  currentScreen,
  onOpenExitModal,
  user,
  onLogin,
  onRefresh,
  isRefreshing,
  onSyncFromCloud,
  onBackupToCloud,
  onLogout
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const handleSync = async () => {
    if (!onSyncFromCloud || isSyncing) return;
    setIsSyncing(true);
    try {
      await onSyncFromCloud();
    } finally {
      setIsSyncing(false);
      setIsUserMenuOpen(false);
    }
  };

  const handleBackup = async () => {
    if (!onBackupToCloud || isSyncing) return;
    setIsSyncing(true);
    try {
      await onBackupToCloud();
    } finally {
      setIsSyncing(false);
      setIsUserMenuOpen(false);
    }
  };

  const handleLogout = async () => {
    if (!onLogout) return;
    setIsUserMenuOpen(false);
    await onLogout();
  };

  return (
    <header className="flex justify-between items-center mb-6 relative">
      <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">{screenTitles[currentScreen]}</h1>
      <div className="flex items-center gap-4">
        <button
          onClick={onRefresh}
          className={`p-2 rounded-full bg-light-card dark:bg-dark-card shadow-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
          aria-label="Refresh data"
          disabled={isRefreshing}
          title="실시간 주가 새로고침"
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
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary rounded-full"
              aria-label="User menu"
              title={user.email || '사용자 계정'}
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="User"
                  className="w-8 h-8 rounded-full border-2 border-light-primary dark:border-dark-primary hover:opacity-90 transition-opacity"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-light-card dark:bg-dark-card border-2 border-light-primary dark:border-dark-primary flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-light-primary dark:text-dark-primary" />
                </div>
              )}
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 py-3 px-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="border-b border-gray-100 dark:border-slate-700 pb-2 mb-2">
                  <p className="text-xs text-light-secondary dark:text-dark-secondary font-medium">연결된 구글 계정</p>
                  <p className="text-sm font-semibold text-light-text dark:text-dark-text truncate mt-0.5" title={user.email || ''}>
                    {user.email}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    클라우드 자동 동기화 활성
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 py-1">
                  {onSyncFromCloud && (
                    <button
                      onClick={handleSync}
                      disabled={isSyncing}
                      className="w-full text-left px-2.5 py-2 text-xs font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-light-text dark:text-dark-text flex items-center justify-between transition-colors disabled:opacity-50"
                    >
                      <span>🔄 클라우드 데이터 다시 불러오기</span>
                      {isSyncing && <span className="animate-spin text-xs">⏳</span>}
                    </button>
                  )}
                  {onBackupToCloud && (
                    <button
                      onClick={handleBackup}
                      disabled={isSyncing}
                      className="w-full text-left px-2.5 py-2 text-xs font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-light-text dark:text-dark-text flex items-center justify-between transition-colors disabled:opacity-50"
                    >
                      <span>☁️ 현재 데이터 클라우드 즉시 백업</span>
                    </button>
                  )}
                  {onLogout && (
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-2.5 py-2 text-xs font-semibold rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-loss transition-colors mt-1 border-t border-gray-100 dark:border-slate-700 pt-2"
                    >
                      🚪 로그아웃
                    </button>
                  )}
                </div>
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