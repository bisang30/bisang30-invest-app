import React, { useMemo } from 'react';
import { Screen } from '../types';
import { HomeIcon, ChartLineIcon, WalletIcon, Squares2X2Icon, ChartPieIcon, ArrowTrendingUpIcon } from './Icons';
import { NAV_ITEMS } from '../constants';


interface BottomNavProps {
  currentScreen: Screen;
  setCurrentScreen: (screen: Screen) => void;
  appVersion: string;
  homeScreenPreference: 'HOME' | 'HOLDINGS_STATUS';
}

const iconMap: Record<Screen, React.ComponentType<{ className: string }>> = {
  [Screen.Home]: ArrowTrendingUpIcon,
  [Screen.StockStatus]: ChartLineIcon,
  [Screen.AccountStatus]: WalletIcon,
  [Screen.Menu]: Squares2X2Icon,
  [Screen.HoldingsStatus]: ChartPieIcon,
  // Other screens are not in the main nav anymore, but we need to satisfy the type
  [Screen.TradeHistory]: Squares2X2Icon,
  [Screen.AccountTransactions]: Squares2X2Icon,
  [Screen.ProfitManagement]: Squares2X2Icon,
  [Screen.MonthlyHistory]: Squares2X2Icon,
  [Screen.Index]: Squares2X2Icon,
  [Screen.Rebalancing]: Squares2X2Icon,
  // FIX: Add missing GOAL_INVESTING to iconMap
  [Screen.GoalInvesting]: Squares2X2Icon,
};

const activeColorMap: Record<Screen, string> = {
  [Screen.Home]: 'text-blue-600 dark:text-blue-400',
  [Screen.StockStatus]: 'text-green-600 dark:text-green-400',
  [Screen.AccountStatus]: 'text-amber-600 dark:text-amber-400',
  [Screen.Menu]: 'text-teal-600 dark:text-teal-400',
  [Screen.HoldingsStatus]: 'text-violet-600 dark:text-violet-400',
  // Keep others for type consistency, though they won't be active in the new nav
  [Screen.TradeHistory]: 'text-indigo-600 dark:text-indigo-400',
  [Screen.ProfitManagement]: 'text-rose-600 dark:text-rose-400',
  [Screen.MonthlyHistory]: 'text-sky-600 dark:text-sky-400',
  [Screen.Index]: 'text-slate-600 dark:text-slate-400',
  [Screen.AccountTransactions]: 'text-cyan-600 dark:text-cyan-400',
  [Screen.Rebalancing]: 'text-slate-600 dark:text-slate-400',
  // FIX: Add missing GOAL_INVESTING to activeColorMap
  [Screen.GoalInvesting]: 'text-lime-600 dark:text-lime-400',
};

const activeBgColorMap: Record<Screen, string> = {
  [Screen.Home]: 'bg-blue-100 dark:bg-blue-900/50',
  [Screen.StockStatus]: 'bg-green-100 dark:bg-green-900/50',
  [Screen.AccountStatus]: 'bg-amber-100 dark:bg-amber-900/50',
  [Screen.Menu]: 'bg-teal-100 dark:bg-teal-900/50',
  [Screen.HoldingsStatus]: 'bg-violet-100 dark:bg-violet-900/50',
  // Keep others for type consistency
  [Screen.TradeHistory]: 'bg-indigo-100 dark:bg-indigo-900/50',
  [Screen.ProfitManagement]: 'bg-rose-100 dark:bg-rose-900/50',
  [Screen.MonthlyHistory]: 'bg-sky-100 dark:bg-sky-900/50',
  [Screen.Index]: 'bg-slate-100 dark:bg-slate-700',
  [Screen.AccountTransactions]: 'bg-cyan-100 dark:bg-cyan-900/50',
  [Screen.Rebalancing]: 'bg-slate-100 dark:bg-slate-700',
  // FIX: Add missing GOAL_INVESTING to activeBgColorMap
  [Screen.GoalInvesting]: 'bg-lime-100 dark:bg-lime-900/50',
};


const labelMap: Record<string, string> = {
  '종목 현황': '종목현황',
  '계좌 현황': '계좌현황',
  '투자 현황': '투자현황',
  '메뉴': '메뉴',
  '포트폴리오 가꾸기': '가꾸기',
};

const NavItem: React.FC<{
  item: { screen: Screen; label: string };
  isActive: boolean;
  onClick: () => void;
}> = ({ item, isActive, onClick }) => {
  const Icon = iconMap[item.screen];
  const shortLabel = labelMap[item.label] || item.label;
  
  const activeColor = activeColorMap[item.screen];
  const activeBg = activeBgColorMap[item.screen];

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full h-full transition-colors duration-200 group ${
        isActive ? activeColor : 'text-light-secondary dark:text-dark-secondary hover:text-light-primary dark:hover:text-dark-primary'
      }`}
    >
      <div className={`flex flex-col items-center justify-center p-2 rounded-xl transition-colors duration-200 ${isActive ? activeBg : ''}`}>
          {Icon && <Icon className="w-6 h-6" />}
          <span className="mt-1 text-[10px] leading-tight font-semibold">{shortLabel}</span>
      </div>
    </button>
  );
};


const BottomNav: React.FC<BottomNavProps> = ({ currentScreen, setCurrentScreen, appVersion, homeScreenPreference }) => {
  const navOrder = useMemo(() => {
    // FIX: Explicitly type `baseOrder` as `Screen[]` to prevent overly narrow type inference.
    // This ensures that `Screen.Home` is considered a valid type for the array elements,
    // resolving the error when calling `setCurrentScreen(homeScreenPreference)` with the value 'HOME'.
    const baseOrder: Screen[] = [
      Screen.Menu,
      Screen.StockStatus,
      Screen.HoldingsStatus,
      Screen.AccountStatus,
    ];

    if (homeScreenPreference === Screen.HoldingsStatus) {
      const holdingsIndex = baseOrder.indexOf(Screen.HoldingsStatus);
      if (holdingsIndex !== -1) {
        baseOrder[holdingsIndex] = Screen.Home;
      }
    }
    return baseOrder;
  }, [homeScreenPreference]);

  const allNavItems = navOrder.map(screen => NAV_ITEMS.find(item => item.screen === screen)).filter((item): item is typeof NAV_ITEMS[number] => !!item);
  
  const leftItems = allNavItems.slice(0, 2);
  const rightItems = allNavItems.slice(2);

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[72px] bg-light-card dark:bg-dark-card shadow-[0_-2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_-2px_10px_rgba(0,0,0,0.2)]">
      <div className="flex justify-around items-center h-full max-w-4xl mx-auto">
        {leftItems.map((item) => (
          <NavItem
            key={item.screen}
            item={item}
            isActive={currentScreen === item.screen}
            onClick={() => setCurrentScreen(item.screen)}
          />
        ))}

        <div className="relative w-full flex justify-center">
            <button
                onClick={() => setCurrentScreen(homeScreenPreference)}
                className={`absolute bottom-[18px] w-14 h-14 flex items-center justify-center rounded-full shadow-lg transition-transform duration-200 ease-in-out ${currentScreen === homeScreenPreference ? 'bg-light-primary dark:bg-dark-primary scale-110' : 'bg-light-secondary dark:bg-dark-secondary'}`}
                aria-label="Home"
            >
                <HomeIcon className="w-7 h-7 text-white"/>
            </button>
            {appVersion && (
                <span className="absolute bottom-1 text-[9px] text-light-secondary dark:text-dark-secondary font-mono select-none pointer-events-none">{appVersion}</span>
            )}
        </div>

        {rightItems.map((item) => (
            <NavItem
                key={item.screen}
                item={item}
                isActive={currentScreen === item.screen}
                onClick={() => setCurrentScreen(item.screen)}
            />
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;