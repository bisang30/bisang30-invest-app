import React from 'react';
import { Screen } from '../types';
import Card from '../components/ui/Card';
import { 
  ListBulletIcon, 
  ArrowsRightLeftIcon, 
  CurrencyWonIcon, 
  CalendarDaysIcon, 
  Cog8ToothIcon, 
  ChevronDownIcon,
  ChartPieIcon,
  FlagIcon
} from '../components/Icons';

interface MenuScreenProps {
  setCurrentScreen: (screen: Screen) => void;
}

const MenuScreen: React.FC<MenuScreenProps> = ({ setCurrentScreen }) => {
  const menuItems = [
    {
      screen: Screen.TradeHistory,
      label: '매매기록',
      description: '모든 주식 매매 내역을 확인하고 관리합니다.',
      icon: ListBulletIcon,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/50'
    },
    {
      screen: Screen.AccountTransactions,
      label: '계좌입출금',
      description: '증권 계좌와 은행 계좌 간의 입출금 내역을 관리합니다.',
      icon: ArrowsRightLeftIcon,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-100 dark:bg-cyan-900/50'
    },
    {
      screen: Screen.HoldingsStatus,
      label: '포트폴리오 가꾸기',
      description: '목표 비중에 맞춰 보유 종목을 조정합니다.',
      icon: ChartPieIcon,
      color: 'text-violet-500',
      bgColor: 'bg-violet-100 dark:bg-violet-900/50'
    },
    {
      screen: Screen.GoalInvesting,
      label: '목표 달성',
      description: '설정한 투자 목표의 달성 현황을 추적합니다.',
      icon: FlagIcon,
      color: 'text-lime-500',
      bgColor: 'bg-lime-100 dark:bg-lime-900/50'
    },
    {
      screen: Screen.ProfitManagement,
      label: '수익 관리',
      description: '실현 손익과 배당금 수익을 상세히 분석합니다.',
      icon: CurrencyWonIcon,
      color: 'text-rose-500',
      bgColor: 'bg-rose-100 dark:bg-rose-900/50'
    },
    {
      screen: Screen.MonthlyHistory,
      label: '월말 결산',
      description: '매월 말 자산 현황을 기록하고 추이를 확인합니다.',
      icon: CalendarDaysIcon,
      color: 'text-sky-500',
      bgColor: 'bg-sky-100 dark:bg-sky-900/50'
    },
    {
      screen: Screen.Index,
      label: '설정',
      description: '계좌, 종목, 포트폴리오 및 앱 관련 설정을 관리합니다.',
      icon: Cog8ToothIcon,
      color: 'text-slate-500',
      bgColor: 'bg-slate-100 dark:bg-slate-700'
    }
  ];

  return (
    <div className="space-y-4">
      {menuItems.map(item => {
        const Icon = item.icon;
        return (
          <button
            key={item.screen}
            onClick={() => setCurrentScreen(item.screen)}
            className="w-full text-left p-4 bg-light-card dark:bg-dark-card rounded-lg shadow-md hover:shadow-lg hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-light-primary dark:focus:ring-dark-primary"
          >
            <div className="flex items-center">
              <div className={`p-3 rounded-lg ${item.bgColor}`}>
                <Icon className={`w-6 h-6 ${item.color}`} />
              </div>
              <div className="ml-4 flex-grow">
                <p className="font-bold text-lg text-light-text dark:text-dark-text">{item.label}</p>
                <p className="text-sm text-light-secondary dark:text-dark-secondary">{item.description}</p>
              </div>
              <ChevronDownIcon className="w-6 h-6 text-light-secondary dark:text-dark-secondary transform -rotate-90" />
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default MenuScreen;