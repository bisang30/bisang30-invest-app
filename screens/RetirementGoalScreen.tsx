import React, { useState, useMemo } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { RetirementGoal, MonthlyAccountValue } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrophyIcon, ChartBarSquareIcon, InformationCircleIcon, SparklesIcon, TrashIcon, PlusIcon, ArrowPathIcon } from '../components/Icons';
import { motion, AnimatePresence } from 'motion/react';

interface RetirementGoalScreenProps {
  retirementGoal: RetirementGoal | null;
  setRetirementGoal: React.Dispatch<React.SetStateAction<RetirementGoal | null>>;
  currentTotalAssets: number;
  currentMwrr: number;
  monthlyValues: MonthlyAccountValue[];
}

const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(Math.round(value));

const RetirementGoalScreen: React.FC<RetirementGoalScreenProps> = ({ retirementGoal, setRetirementGoal, currentTotalAssets, currentMwrr, monthlyValues }) => {
  const [isEditing, setIsEditing] = useState(!retirementGoal);
  const [formState, setFormState] = useState<RetirementGoal>(
    retirementGoal || {
      targetAmount: 1030000000,
      targetYear: 2032,
      currentYear: 2025,
      intermediateExpenses: [
        { amount: 30000000, year: 2026, name: '여유자금', isRecurring: true },
      ]
    }
  );

  const handleSave = () => {
    setRetirementGoal(formState);
    setIsEditing(false);
  };

  const handleAddExpense = () => {
    setFormState(prev => ({
      ...prev,
      intermediateExpenses: [...prev.intermediateExpenses, { amount: 0, year: prev.currentYear + 1, name: '', isRecurring: false }]
    }));
  };

  const handleExpenseChange = (index: number, field: keyof RetirementGoal['intermediateExpenses'][0], value: any) => {
    const newExpenses = [...formState.intermediateExpenses];
    newExpenses[index] = { ...newExpenses[index], [field]: value };
    setFormState(prev => ({ ...prev, intermediateExpenses: newExpenses }));
  };

  const handleRemoveExpense = (index: number) => {
    const newExpenses = [...formState.intermediateExpenses];
    newExpenses.splice(index, 1);
    setFormState(prev => ({ ...prev, intermediateExpenses: newExpenses }));
  };

  const analysis = useMemo(() => {
    if (!retirementGoal) return null;
    
    const startYear = 2026;
    const targetYear = retirementGoal.targetYear;
    const targetAmount = retirementGoal.targetAmount;
    
    const currentAssets = Number(currentTotalAssets) || 0;
    const yearsToTarget = targetYear - startYear;

    if (yearsToTarget <= 0) return null;

    // Calculate required CAGR to reach targetAmount from currentAssets
    // Formula: V_next = V_prev * (1+r) - Expense_next
    // We find 'r' such that V_targetYear = targetAmount
    let low = -0.99;
    let high = 5.0; // Allow up to 500% for extreme cases
    let r = 0;
    
    for (let i = 0; i < 100; i++) {
      r = (low + high) / 2;
      let tempAsset = currentAssets;
      
      for (let y = startYear + 1; y <= targetYear; y++) {
        let expenseForYear = 0;
        retirementGoal.intermediateExpenses.forEach(exp => {
          if (exp.isRecurring) {
            if (y >= exp.year) expenseForYear += exp.amount;
          } else if (exp.year === y) {
            expenseForYear += exp.amount;
          }
        });
        tempAsset = tempAsset * (1 + r) - expenseForYear;
      }
      
      if (tempAsset > targetAmount) high = r;
      else low = r;
    }
    
    const requiredCagr = r * 100;

    // Generate chart data
    const chartData = [];
    
    // Historical data for "현재 자산"
    const historicalMap = new Map();
    (monthlyValues || []).forEach(mv => {
      const date = new Date(mv.date);
      const year = date.getFullYear();
      if (year >= 2024) {
        // Use the latest value for each year
        const existing = historicalMap.get(year);
        if (!existing || date > existing.date) {
          historicalMap.set(year, { value: mv.totalValue, date });
        }
      }
    });
    // Ensure current year shows current assets
    historicalMap.set(new Date().getFullYear(), { value: currentAssets, date: new Date() });

    let projectedAsset = currentAssets;
    
    // Start chart from 2026
    for (let year = 2026; year <= targetYear; year++) {
      const hist = historicalMap.get(year);
      
      chartData.push({
        year: year.toString(),
        '목표 궤적': Math.max(0, Math.round(projectedAsset)),
        '현재 자산': year <= new Date().getFullYear() ? (hist?.value ?? null) : null,
      });

      // Calculate next year's projection
      if (year < targetYear) {
        const nextYear = year + 1;
        let expenseForNextYear = 0;
        retirementGoal.intermediateExpenses.forEach(exp => {
          if (exp.isRecurring) {
            if (nextYear >= exp.year) expenseForNextYear += exp.amount;
          } else if (exp.year === nextYear) {
            expenseForNextYear += exp.amount;
          }
        });
        projectedAsset = projectedAsset * (1 + r) - expenseForNextYear;
      }
    }

    // Status logic
    let statusColor = 'bg-emerald-500';
    let statusText = '순항 중';
    let statusMessage = '현재 계획대로 잘 진행되고 있습니다. 안정적인 운용을 유지하세요.';
    
    if (requiredCagr > 15 || requiredCagr < -50) {
      statusColor = 'bg-rose-500';
      statusText = '전략 수정 필요';
      statusMessage = '목표 달성을 위해 매우 높은 수익률이 필요합니다. 투자 원금을 늘리거나 목표를 조정해 보세요.';
    } else if (requiredCagr > 10) {
      statusColor = 'bg-amber-500';
      statusText = '주의 요망';
      statusMessage = '목표 달성을 위해 다소 높은 수익률이 필요합니다. 포트폴리오 점검이 필요할 수 있습니다.';
    }

    return { requiredCagr, chartData, statusColor, statusText, statusMessage };
  }, [retirementGoal, currentTotalAssets, monthlyValues]);

  if (isEditing) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 pb-20"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
            <TrophyIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">은퇴 목표 설정</h2>
        </div>

        <Card className="overflow-hidden border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Input
                  label="은퇴 목표 연도"
                  type="number"
                  placeholder="예: 2045"
                  value={formState.targetYear}
                  onChange={(e) => setFormState({ ...formState, targetYear: parseInt(e.target.value) || 2032 })}
                  className="bg-gray-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Input
                  label="목표 금융자산 (원)"
                  type="number"
                  placeholder="예: 1000000000"
                  value={formState.targetAmount}
                  onChange={(e) => setFormState({ ...formState, targetAmount: parseInt(e.target.value) || 0 })}
                  className="bg-gray-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="pt-6 border-t border-gray-100 dark:border-slate-800">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-purple-500" />
                  <h3 className="font-bold text-light-text dark:text-dark-text">중간 필요 자금 (이벤트)</h3>
                </div>
                <Button 
                  variant="secondary" 
                  onClick={handleAddExpense} 
                  className="text-xs py-1.5 px-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-none hover:bg-blue-100"
                >
                  <PlusIcon className="w-3.5 h-3.5 mr-1" /> 추가
                </Button>
              </div>

              <div className="space-y-3">
                <AnimatePresence>
                  {formState.intermediateExpenses.map((exp, index) => (
                    <motion.div 
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-slate-800"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                        <div className="sm:col-span-4">
                          <Input
                            label="항목명"
                            placeholder="예: 자녀 결혼, 세계여행"
                            value={exp.name}
                            onChange={(e) => handleExpenseChange(index, 'name', e.target.value)}
                            className="bg-white dark:bg-slate-900 border-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Input
                            label="시작 연도"
                            type="number"
                            value={exp.year}
                            onChange={(e) => handleExpenseChange(index, 'year', parseInt(e.target.value) || 2025)}
                            className="bg-white dark:bg-slate-900 border-none"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <Input
                            label="금액 (원)"
                            type="number"
                            value={exp.amount}
                            onChange={(e) => handleExpenseChange(index, 'amount', parseInt(e.target.value) || 0)}
                            className="bg-white dark:bg-slate-900 border-none"
                          />
                        </div>
                        <div className="sm:col-span-2 flex items-center justify-center pb-2">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative flex items-center">
                              <input
                                type="checkbox"
                                checked={exp.isRecurring}
                                onChange={(e) => handleExpenseChange(index, 'isRecurring', e.target.checked)}
                                className="w-5 h-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </div>
                            <span className="text-xs font-medium text-light-secondary dark:text-dark-secondary group-hover:text-blue-500 transition-colors">매년 반복</span>
                          </label>
                        </div>
                        <div className="sm:col-span-1 flex justify-end pb-1">
                          <button 
                            onClick={() => handleRemoveExpense(index)}
                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              {retirementGoal && (
                <Button 
                  variant="secondary" 
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-2.5 rounded-xl border-gray-200 dark:border-slate-700"
                >
                  취소
                </Button>
              )}
              <Button 
                onClick={handleSave}
                className="px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
              >
                설정 저장하기
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-24"
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
            <TrophyIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">은퇴 목표 관리</h2>
        </div>
        <Button 
          variant="secondary" 
          onClick={() => setIsEditing(true)} 
          className="text-sm py-1.5 px-4 rounded-xl bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-sm"
        >
          목표 수정
        </Button>
      </div>

      {analysis && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <ArrowPathIcon className="w-24 h-24" />
              </div>
              <div className="relative z-10">
                <p className="text-blue-100 text-sm font-medium mb-1">목표 달성을 위한</p>
                <h3 className="text-xs text-blue-200/80 mb-3 uppercase tracking-wider">필요 연평균 수익률 (CAGR)</h3>
                <div className="text-4xl font-black flex items-baseline gap-1">
                  {analysis.requiredCagr.toFixed(2)}
                  <span className="text-xl font-bold opacity-80">%</span>
                </div>
              </div>
            </Card>

            <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <ChartBarSquareIcon className="w-24 h-24" />
              </div>
              <div className="relative z-10">
                <p className="text-emerald-100 text-sm font-medium mb-1">현재 나의</p>
                <h3 className="text-xs text-emerald-200/80 mb-3 uppercase tracking-wider">실제 연평균 수익률 (CAGR)</h3>
                <div className="text-4xl font-black flex items-baseline gap-1">
                  {currentMwrr.toFixed(2)}
                  <span className="text-xl font-bold opacity-80">%</span>
                </div>
                <p className="text-[10px] text-emerald-100/60 mt-2">* 2026년 1월부터 계산됨</p>
              </div>
            </Card>

            <Card className="sm:col-span-2 border-none shadow-md bg-white dark:bg-slate-900 p-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl ${analysis.statusColor} flex items-center justify-center shadow-lg shadow-current/20`}>
                  <SparklesIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-light-text dark:text-dark-text">{analysis.statusText}</h3>
                  <p className="text-sm text-light-secondary dark:text-dark-secondary">{analysis.statusMessage}</p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 pt-6 border-t border-gray-50 dark:border-slate-800">
                <div className="space-y-1">
                  <span className="text-xs text-light-secondary dark:text-dark-secondary">현재 자산</span>
                  <p className="text-lg font-bold text-light-text dark:text-dark-text">{formatCurrency(currentTotalAssets)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-light-secondary dark:text-dark-secondary">목표 자산 ({retirementGoal!.targetYear}년)</span>
                  <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(retirementGoal!.targetAmount)}</p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="border-none shadow-xl bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                <ChartBarSquareIcon className="w-5 h-5 text-indigo-500" />
                목표 궤적 시뮬레이션 (2026-{retirementGoal!.targetYear})
              </h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 border-t-2 border-dashed border-indigo-500"></div>
                  <span className="text-[10px] text-light-secondary dark:text-dark-secondary">목표 궤적</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-emerald-500"></div>
                  <span className="text-[10px] text-light-secondary dark:text-dark-secondary">실제 자산</span>
                </div>
              </div>
            </div>
            
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysis.chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
                  <XAxis 
                    dataKey="year" 
                    axisLine={false}
                    tickLine={false}
                    stroke="#94a3b8" 
                    fontSize={11} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickFormatter={(value) => `${(value / 100000000).toFixed(0)}억`}
                    width={40}
                  />
                  <Tooltip 
                    cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '5 5' }}
                    formatter={(value: number) => [formatCurrency(value), '']}
                    labelFormatter={(label) => `${label}년`}
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                      border: 'none', 
                      borderRadius: '12px', 
                      color: '#fff',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="목표 궤적" 
                    stroke="#6366f1" 
                    strokeWidth={2} 
                    strokeDasharray="6 4" 
                    dot={false} 
                    activeDot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="현재 자산" 
                    stroke="#10b981" 
                    strokeWidth={4} 
                    dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} 
                    activeDot={{ r: 6, strokeWidth: 0 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-8 flex justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-slate-800/50 rounded-full border border-gray-100 dark:border-slate-800">
                <InformationCircleIcon className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[10px] text-light-secondary dark:text-dark-secondary">
                  매달 자산 변동시 필요수익률 재계산됨
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </motion.div>
  );
};

export default RetirementGoalScreen;

