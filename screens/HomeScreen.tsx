import React, { useMemo, useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import { PortfolioCategory, AlertThresholds, MonthlyAccountValue, AccountTransaction, Account, TransactionType } from '../types';
import Select from '../components/ui/Select';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ComposedChart, Line, Bar, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, ChevronDownIcon, ChevronUpIcon, CircleStackIcon, BanknotesIcon } from '../components/Icons';

interface AlertedStock {
  id: string;
  name: string;
  deviation: number;
  disparityRatio: number;
  level: 'caution' | 'warning';
}

interface RebalancingAlert {
  category: PortfolioCategory;
  warnings: AlertedStock[];
  cautions: AlertedStock[];
}

interface HomeScreenProps {
  financialSummary: any;
  alertThresholds: AlertThresholds;
  showSummary: boolean;
  navigateToRebalancing: (stockId: string) => void;
  monthlyValues: MonthlyAccountValue[];
  transactions: AccountTransaction[];
  accounts: Account[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);
const formatNumberForChart = (value: number) => new Intl.NumberFormat('ko-KR').format(Math.round(value));

const MetricDisplay: React.FC<{ label: string; value: string; tooltip: string }> = ({ label, value, tooltip }) => (
  <div className="text-center" title={tooltip}>
    <p className="text-sm font-medium text-light-secondary dark:text-dark-secondary mb-1">{label}</p>
    <p className="text-xl font-bold text-light-text dark:text-dark-text">{value}</p>
  </div>
);


const HomeScreen: React.FC<HomeScreenProps> = ({ financialSummary, alertThresholds, showSummary, navigateToRebalancing, monthlyValues, transactions, accounts }) => {
  const [selectedYear, setSelectedYear] = useState<number | string>(new Date().getFullYear());
  const [selectedTrendYear, setSelectedTrendYear] = useState<number | string>('전체');
  const [isRebalancingAlertExpanded, setIsRebalancingAlertExpanded] = useState(false);
  const [expandedAlertCategory, setExpandedAlertCategory] = useState<PortfolioCategory | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<PortfolioCategory | null>(null);

  const securityAccountIds = useMemo(() => new Set((accounts || []).map(a => a.id)), [accounts]);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = 2024;
    const years = [];
    for (let year: number = currentYear; year >= startYear; year--) {
        years.push(year);
    }
    if (years.length === 0) {
        years.push(currentYear);
    }
    return years;
  }, []);

  const availableTrendYears = useMemo(() => {
    const yearsInData: Set<number> = new Set((monthlyValues || []).map(mv => new Date(mv.date).getFullYear()));
    const startYear = 2024;
    const currentYear = new Date().getFullYear();
    for (let y = startYear; y <= currentYear; y++) {
        yearsInData.add(y);
    }
    const sortedYears = Array.from(yearsInData).filter(y => y >= startYear).sort((a, b) => b - a);
    return ['전체', ...sortedYears];
  }, [monthlyValues]);

  useEffect(() => {
      if (!availableYears.includes(selectedYear)) {
          setSelectedYear(availableYears[0] || new Date().getFullYear());
      }
      if (availableTrendYears.length > 0 && !availableTrendYears.map(String).includes(String(selectedTrendYear))) {
        setSelectedTrendYear(availableTrendYears[0]);
    }
  }, [availableYears, selectedYear, availableTrendYears, selectedTrendYear]);
  
  const rebalancingAlerts = useMemo((): RebalancingAlert[] => {
    const alertsByCategory = new Map<PortfolioCategory, { warnings: AlertedStock[], cautions: AlertedStock[] }>();

    financialSummary.allStocks.forEach((stock: any) => {
      if (stock.targetWeight > 0) {
        const disparityDeviation = Math.abs(stock.disparityRatio);
        const stockThresholds = alertThresholds.stocks[stock.id] || {};
        const cautionThreshold = stockThresholds.caution ?? alertThresholds.global.caution;
        const warningThreshold = stockThresholds.warning ?? alertThresholds.global.warning;

        let level: 'warning' | 'caution' | null = null;
        if (disparityDeviation > warningThreshold) {
          level = 'warning';
        } else if (disparityDeviation > cautionThreshold) {
          level = 'caution';
        }
        
        if (level) {
          if (!alertsByCategory.has(stock.category)) {
            alertsByCategory.set(stock.category, { warnings: [], cautions: [] });
          }
          const entry = alertsByCategory.get(stock.category)!;
          const alertStock = { id: stock.id, name: stock.name, deviation: stock.deviation, disparityRatio: stock.disparityRatio, level };
          if (level === 'warning') {
            entry.warnings.push(alertStock);
          } else {
            entry.cautions.push(alertStock);
          }
        }
      }
    });

    return Array.from(alertsByCategory.entries())
      .map(([category, { warnings, cautions }]) => ({
        category,
        warnings: warnings.sort((a, b) => Math.abs(b.disparityRatio) - Math.abs(a.disparityRatio)),
        cautions: cautions.sort((a, b) => Math.abs(b.disparityRatio) - Math.abs(a.disparityRatio)),
      }))
      .sort((a, b) => {
        if (a.warnings.length > 0 && b.warnings.length === 0) return -1;
        if (a.warnings.length === 0 && b.warnings.length > 0) return 1;
        return a.category.localeCompare(b.category);
      });
  }, [financialSummary.allStocks, alertThresholds]);

  const totalWarnings = useMemo(() => rebalancingAlerts.reduce((acc, cat) => acc + cat.warnings.length, 0), [rebalancingAlerts]);
  const totalCautions = useMemo(() => rebalancingAlerts.reduce((acc, cat) => acc + cat.cautions.length, 0), [rebalancingAlerts]);
  const hasAlerts = totalWarnings > 0 || totalCautions > 0;
  
  useEffect(() => {
    if (totalWarnings > 0) {
      setIsRebalancingAlertExpanded(true);
    }
  }, [totalWarnings]);

  const monthlyPLData = useMemo(() => {
    const startYear = selectedYear === '전체' ? 0 : (selectedYear as number);
    
    const filteredData = (monthlyValues || [])
      .filter(mv => startYear === 0 || new Date(mv.date).getFullYear() >= startYear)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (filteredData.length === 0) return [];
    
    let referencePoint = null;
    if (startYear !== 0) {
        referencePoint = (monthlyValues || [])
            .filter(mv => new Date(mv.date).getFullYear() < startYear)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    }

    const dataPoints = [referencePoint, ...filteredData].filter(Boolean);
    
    const results = [];
    for (let i = 1; i < dataPoints.length; i++) {
        const prev = dataPoints[i-1] as MonthlyAccountValue;
        const current = dataPoints[i] as MonthlyAccountValue;
        const prevDate = new Date(prev.date);
        const currentDate = new Date(current.date);

        const monthlyNetDeposits = (transactions || []).filter(t => {
            const txDate = new Date(t.date);
            const isInternalTransfer = t.counterpartyAccountId ? securityAccountIds.has(t.counterpartyAccountId) : false;
            return txDate > prevDate && txDate <= currentDate && !isInternalTransfer;
        }).reduce((acc, t) => acc + (Number(t.amount) || 0) * (t.transactionType === 'DEPOSIT' || t.transactionType === 'DIVIDEND' ? 1 : -1), 0);

        const yearStr = String(currentDate.getFullYear()).slice(-2);
        const monthStr = String(currentDate.getMonth() + 1).padStart(2, '0');

        results.push({
            name: `${yearStr}.${monthStr}`,
            pl: (Number(current.totalValue) || 0) - (Number(prev.totalValue) || 0) - monthlyNetDeposits,
        });
    }

    return results;
  }, [monthlyValues, transactions, selectedYear, securityAccountIds]);

  const trendData = useMemo(() => {
    const yearDataPoints = (monthlyValues || [])
      .filter(mv => selectedTrendYear === '전체' || new Date(mv.date).getFullYear() >= (selectedTrendYear as number))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
    if (yearDataPoints.length === 0) return [];
    
    // 순수 외부 입출금 거래만 미리 필터링하여 계산 정확성 및 효율성 확보
    const netExternalTransactions = (transactions || []).filter(t => {
      if (t.transactionType === TransactionType.Dividend) return false; // 배당금 제외
      if (t.counterpartyAccountId && securityAccountIds.has(t.counterpartyAccountId)) return false; // 증권계좌 간 내부이체 제외
      return true;
    });
  
    return yearDataPoints.map(mv => {
      const pointInTime = new Date(mv.date);
      
      const cumulativeDeposits = netExternalTransactions
        .filter(t => new Date(t.date) <= pointInTime)
        .reduce((acc, t) => {
          const amount = Number(t.amount) || 0;
          if (t.transactionType === TransactionType.Deposit) {
            return acc + amount;
          }
          // 출금(Withdrawal)의 경우 금액을 차감
          return acc - amount;
        }, 0);

      const year = String(pointInTime.getFullYear()).slice(-2);
      const month = String(pointInTime.getMonth() + 1).padStart(2, '0');
      return { name: `${year}.${month}`, totalValue: Number(mv.totalValue) || 0, deposits: cumulativeDeposits };
    });
  }, [monthlyValues, transactions, selectedTrendYear, securityAccountIds]);

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-xs font-bold pointer-events-none">{`${(percent * 100).toFixed(0)}%`}</text>;
  };
  
  const toggleCategory = (category: PortfolioCategory) => setExpandedCategory(prev => prev === category ? null : category);
  const toggleAlertCategory = (category: PortfolioCategory) => setExpandedAlertCategory(prev => prev === category ? null : category);

  return (
    <div className="space-y-8">
      <Card className="p-0 overflow-hidden">
        {hasAlerts ? (
          <>
            <div className="p-4 cursor-pointer flex justify-between items-center transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/50" onClick={() => setIsRebalancingAlertExpanded(!isRebalancingAlertExpanded)} aria-expanded={isRebalancingAlertExpanded}>
              <div>
                <h2 className={`text-xl font-bold flex items-center gap-2 ${totalWarnings > 0 ? 'text-loss' : 'text-yellow-600 dark:text-yellow-400'}`}>
                  <span className={`text-2xl ${totalWarnings > 0 ? 'animate-pulse-warning' : ''}`}>🔔</span>
                  <span>리밸런싱 알림</span>
                  {hasAlerts && <span className="text-sm font-semibold"> (경고 {totalWarnings}개, 주의 {totalCautions}개)</span>}
                </h2>
                {!isRebalancingAlertExpanded && <p className="text-sm text-light-secondary dark:text-dark-secondary mt-1">총 {totalWarnings + totalCautions}개 종목의 비중 조절이 필요합니다.</p>}
              </div>
              {isRebalancingAlertExpanded ? <ChevronUpIcon className="w-6 h-6"/> : <ChevronDownIcon className="w-6 h-6"/>}
            </div>
            {isRebalancingAlertExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-200/80 dark:border-slate-700">
                {rebalancingAlerts.map(({ category, warnings, cautions }) => {
                  const allStocks = [...warnings, ...cautions].sort((a,b) => Math.abs(b.disparityRatio) - Math.abs(a.disparityRatio));
                  return (
                    <div key={category}>
                      <div className="p-3 bg-gray-100 dark:bg-slate-900/50 rounded-lg cursor-pointer hover:bg-gray-200/70 dark:hover:bg-slate-800/50" onClick={() => toggleAlertCategory(category)}>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">
                            {category} (총 {warnings.length + cautions.length}개)
                            {warnings.length > 0 && <span className="ml-2 text-xs font-bold text-loss">경고 {warnings.length}</span>}
                            {cautions.length > 0 && <span className="ml-2 text-xs font-bold text-yellow-600 dark:text-yellow-400">주의 {cautions.length}</span>}
                          </span>
                          {expandedAlertCategory === category ? <ChevronUpIcon className="w-5 h-5"/> : <ChevronDownIcon className="w-5 h-5"/>}
                        </div>
                      </div>
                      {expandedAlertCategory === category && (
                        <div className="mt-2 pl-4 space-y-2">
                          {allStocks.map(stock => (
                            <div key={stock.id} className={`p-2 rounded-md cursor-pointer ${stock.level === 'warning' ? 'bg-red-100 dark:bg-red-900/30 hover:bg-red-200/70' : 'bg-yellow-50 dark:bg-yellow-900/30 hover:bg-yellow-100/70'}`} onClick={() => navigateToRebalancing(stock.id)}>
                              <div className="flex justify-between items-center text-sm">
                                <span className="font-medium">{stock.name}</span>
                                <div className="text-right">
                                  <span className={`font-bold ${stock.level === 'warning' ? 'text-loss' : 'text-yellow-600 dark:text-yellow-400'}`}>
                                    이격률: {stock.disparityRatio >= 0 ? '+' : ''}{stock.disparityRatio.toFixed(1)}%
                                  </span>
                                  <span className={`ml-2 text-xs font-bold px-2 py-1 rounded-full ${stock.level === 'warning' ? 'bg-loss text-white' : 'bg-yellow-200 dark:bg-yellow-600/50 text-yellow-800 dark:text-yellow-200'}`}>{stock.level === 'warning' ? '경고' : '주의'}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <div className="p-4">
            <h2 className="text-xl font-bold text-light-text dark:text-dark-text flex items-center gap-2"><span className="text-profit">✅</span><span>리밸런싱 알림</span></h2>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">포트폴리오가 목표 비중에 맞게 잘 유지되고 있습니다.</p>
          </div>
        )}
      </Card>

      {showSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-light-card dark:bg-dark-card p-4 rounded-lg shadow-md flex items-start gap-4 border border-gray-200/80 dark:border-slate-700">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg"><CircleStackIcon className="w-6 h-6 text-blue-500 dark:text-blue-400" /></div>
            <div><p className="text-sm text-light-secondary dark:text-dark-secondary">총 자산</p><p className="text-2xl font-bold text-light-text dark:text-dark-text tracking-tight">{formatCurrency(financialSummary.totalAssets)}</p></div>
          </div>
          <div className="bg-light-card dark:bg-dark-card p-4 rounded-lg shadow-md flex items-start gap-4 border border-gray-200/80 dark:border-slate-700">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg"><BanknotesIcon className="w-6 h-6 text-purple-500 dark:text-purple-400" /></div>
            <div><p className="text-sm text-light-secondary dark:text-dark-secondary">입금 총 합계</p><p className="text-2xl font-bold text-light-text dark:text-dark-text tracking-tight">{formatCurrency(financialSummary.netExternalDeposits)}</p></div>
          </div>
          <div className="bg-light-card dark:bg-dark-card p-4 rounded-lg shadow-md flex items-start gap-4 border border-gray-200/80 dark:border-slate-700">
            <div className={`p-3 rounded-lg ${financialSummary.profitLoss >= 0 ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>{financialSummary.profitLoss >= 0 ? <ArrowTrendingUpIcon className="w-6 h-6 text-profit" /> : <ArrowTrendingDownIcon className="w-6 h-6 text-loss" />}</div>
            <div><p className="text-sm text-light-secondary dark:text-dark-secondary">누적 수익</p><p className={`text-2xl font-bold tracking-tight ${financialSummary.profitLoss >= 0 ? 'text-profit' : 'text-loss'}`}>{financialSummary.profitLoss >= 0 ? '+' : ''}{formatCurrency(financialSummary.profitLoss)}</p></div>
          </div>
        </div>
      )}

      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4">
          <MetricDisplay label="누적 총 수익률 (CCR)" value={`${financialSummary.ccr.toFixed(2)}%`} tooltip="전체 투자 기간 동안의 총 수익률입니다. (총 수익 / 누적 순입금액)" />
          <MetricDisplay label="금액가중 수익률 (MWRR)" value={`${financialSummary.mwrr.toFixed(2)}%`} tooltip="입출금 시점과 규모를 모두 반영한 연환산 수익률입니다. 투자자의 실제 성과를 나타냅니다." />
          <MetricDisplay label="시간가중 수익률 (TWRR)" value={`${financialSummary.twrr.toFixed(2)}%`} tooltip="입출금의 영향을 제거한 순수 포트폴리오의 연환산 수익률입니다." />
          <MetricDisplay label="올해 (YTD)" value={`${financialSummary.ytd.toFixed(2)}%`} tooltip="올해 1월 1일부터 현재까지의 수익률입니다." />
        </div>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="포트폴리오(실제)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="relative w-full h-[300px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={financialSummary.chartData.filter((d: any) => d.value > 0)} cx="50%" cy="50%" labelLine={false} label={renderCustomizedLabel} outerRadius={100} innerRadius={60} fill="#8884d8" dataKey="value" nameKey="name">{financialSummary.chartData.filter((d: any) => d.value > 0).map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value: number) => [formatCurrency(value), '평가금액']} /><Legend iconSize={10} wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} /></PieChart></ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><p className="text-xl sm:text-2xl font-bold text-light-text dark:text-dark-text">{formatNumberForChart(financialSummary.totalPortfolioValue)}</p></div></div>
            <div className="space-y-1">{financialSummary.chartData.map((item: any) => {
                const pieChartItems = financialSummary.chartData.filter((d: any) => d.value > 0);
                const pieIndex = pieChartItems.findIndex((d: any) => d.name === item.name);
                const color = pieIndex !== -1 ? COLORS[pieIndex % COLORS.length] : '#9ca3af';
                return (<div key={item.name}><div className={`p-2 rounded-lg cursor-pointer transition-colors ${expandedCategory === item.name ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`} onClick={() => toggleCategory(item.name as PortfolioCategory)} aria-expanded={expandedCategory === item.name}><div className="flex justify-between items-center text-sm"><div className="flex items-center min-w-0"><span className="w-3 h-3 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: color }}></span><span className="font-semibold text-light-text dark:text-dark-text truncate">{item.name}</span></div><div className="flex items-center"><span className="font-bold text-light-text dark:text-dark-text ml-2 flex-shrink-0">{item.percentage.toFixed(1)}%</span>{expandedCategory === item.name ? <ChevronUpIcon className="w-4 h-4 ml-1"/> : <ChevronDownIcon className="w-4 h-4 ml-1"/>}</div></div><div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 relative mt-1"><div className="bg-light-primary dark:bg-dark-primary h-2 rounded-full" style={{ width: `${item.percentage}%` }}></div>{item.targetPercentage > 0 && <div title={`목표: ${item.targetPercentage.toFixed(1)}%`} className="absolute top-[-2px] h-3 w-1 bg-red-500 rounded-sm" style={{ left: `calc(${item.targetPercentage}% - 2px)` }}></div>}</div><div className="flex justify-between items-center mt-1 text-xs text-light-secondary dark:text-dark-secondary"><span>{formatCurrency(item.value)}</span><span className={`font-medium ${item.difference >= 0 ? 'text-profit' : 'text-loss'}`}>목표 대비: {item.difference >= 0 ? '+' : ''}{item.difference.toFixed(1)}%</span></div></div>{expandedCategory === item.name && (<div className="mt-2 pl-4 pr-1 pb-1 border-l-2 border-blue-200 dark:border-blue-800 space-y-3">{item.stocks.map((stock: any) => (<div key={stock.id} className="text-xs"><p className="font-semibold truncate">{stock.name}</p><div className="flex justify-between items-center text-light-secondary dark:text-dark-secondary"><span>현재 {stock.currentWeight.toFixed(1)}% (목표 {stock.targetWeight.toFixed(1)}%)</span><span className={`font-bold ${stock.deviation >= 0 ? 'text-profit' : 'text-loss'}`}>{stock.deviation >= 0 ? '+' : ''}{stock.deviation.toFixed(1)}%</span></div><div className="flex justify-between items-center mt-1"><span className="font-medium text-light-text dark:text-dark-text">{stock.requiredPurchase > 0 ? '추가 매수 필요' : '비중 초과'}</span><span className={`font-bold text-sm ${stock.requiredPurchase > 0 ? 'text-loss' : 'text-profit'}`}>{formatCurrency(Math.abs(stock.requiredPurchase))}</span></div></div>))}</div>)}</div>);
            })}</div>
          </div>
        </Card>
        <Card title="월별 손익">
          <div className="mb-4 max-w-xs ml-auto"><Select label="시작 년도" id="year-select" value={selectedYear} onChange={(e) => { const value = e.target.value; setSelectedYear(isNaN(parseInt(value, 10)) ? value : parseInt(value, 10)); }}>{availableTrendYears.map((year) => <option key={year} value={year}>{year === '전체' ? '전체' : `${year}년`}</option>)}</Select></div>
          <ResponsiveContainer width="100%" height={300}><ComposedChart data={monthlyPLData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDataOverflow={true} domain={['auto', 'auto']} tickFormatter={(value) => new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(value as number)} /><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /><Bar dataKey="pl" name="손익">{monthlyPLData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.pl >= 0 ? '#22c55e' : '#ef4444'} />)}</Bar><Line type="monotone" dataKey="pl" name="추세" stroke="#ff7300" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} /></ComposedChart></ResponsiveContainer>
        </Card>
      </div>
      
      <Card title="총 투자 추이">
        <div className="flex justify-end mb-4 max-w-xs ml-auto"><Select label="시작 년도" id="trend-year-select" value={selectedTrendYear} onChange={(e) => { const value = e.target.value; setSelectedTrendYear(isNaN(parseInt(value, 10)) ? value : parseInt(value, 10)); }}>{availableTrendYears.map((year) => <option key={year} value={year}>{year === '전체' ? '전체' : `${year}년`}</option>)}</Select></div>
        <ResponsiveContainer width="100%" height={300}><AreaChart data={trendData}><defs><linearGradient id="colorTotalValue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient><linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6b7280" stopOpacity={0.7}/><stop offset="95%" stopColor="#6b7280" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 12, fill: 'currentColor' }} /><YAxis tickFormatter={(value) => new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(value as number)} /><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /><Area type="monotone" dataKey="totalValue" name="총 자산" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTotalValue)" /><Area type="monotone" dataKey="deposits" name="누적 순입금액" stroke="#6b7280" fillOpacity={1} fill="url(#colorDeposits)" /></AreaChart></ResponsiveContainer>
      </Card>
    </div>
  );
};

export default HomeScreen;