import React, { useMemo, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { AccountTransaction, MonthlyAccountValue } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CalendarDaysIcon, ChartBarSquareIcon } from '../components/Icons';

interface MonthlyHistoryScreenProps {
  monthlyValues: MonthlyAccountValue[];
  setMonthlyValues: React.Dispatch<React.SetStateAction<MonthlyAccountValue[]>>;
  transactions: AccountTransaction[];
}

const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);

const formatNumber = (value: number | string): string => {
  if (value === '' || value === null || value === undefined || Number(value) === 0) return '';
  const num = Number(String(value).replace(/,/g, ''));
  if (isNaN(num)) return '';
  return num.toLocaleString('ko-KR');
};

const getDefaultMonth = () => {
    const now = new Date();
    // If it's early in the month, default to the previous month.
    if (now.getDate() < 15 && now.getMonth() > 0) {
        now.setMonth(now.getMonth() - 1);
    }
    return now.toISOString().slice(0, 7); // YYYY-MM
};

const MonthlyHistoryScreen: React.FC<MonthlyHistoryScreenProps> = ({ 
  monthlyValues, setMonthlyValues, transactions 
}) => {
  const [isMvModalOpen, setIsMvModalOpen] = useState(false);
  const [editingMonthlyValue, setEditingMonthlyValue] = useState<MonthlyAccountValue | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth());
  const [newTotalValue, setNewTotalValue] = useState(0);

  const trendData = useMemo(() => {
    const sortedValues = [...(monthlyValues || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return sortedValues.map(mv => {
      const date = new Date(mv.date);
      return {
        date: date.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short' }),
        totalValue: Number(mv.totalValue) || 0,
      };
    });
  }, [monthlyValues]);

  const openAddModal = () => {
    setEditingMonthlyValue(null);
    setSelectedMonth(getDefaultMonth());
    setNewTotalValue(0);
    setIsMvModalOpen(true);
  };

  const openEditModal = (mv: MonthlyAccountValue) => {
    setEditingMonthlyValue(mv);
    setSelectedMonth(mv.date.slice(0, 7)); // YYYY-MM from YYYY-MM-DD
    setNewTotalValue(mv.totalValue);
    setIsMvModalOpen(true);
  };
  
  const handleMvSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isNaN(newTotalValue) || newTotalValue <= 0) {
        alert('계좌 총액을 올바르게 입력해주세요.');
        return;
    }
    
    // Convert YYYY-MM to the last day of the month in YYYY-MM-DD format
    const [year, month] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const fullDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    if (editingMonthlyValue) {
      const updatedRecord: MonthlyAccountValue = {
        ...editingMonthlyValue,
        date: fullDate,
        totalValue: newTotalValue,
      };
      setMonthlyValues(prev => 
        (prev || [])
          .map(mv => mv.id === editingMonthlyValue.id ? updatedRecord : mv)
          .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );
    } else {
      const newRecord: MonthlyAccountValue = {
          id: Date.now().toString(),
          date: fullDate,
          totalValue: newTotalValue,
      };

      setMonthlyValues(prev => [...(prev || []).filter(mv => mv.date.slice(0, 7) !== selectedMonth), newRecord]
          .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }

    closeModal();
  };

  const deleteMonthlyValue = (id: string) => {
    if (window.confirm('이 기록을 삭제하시겠습니까?')) {
        setMonthlyValues(prev => (prev || []).filter(mv => mv.id !== id));
    }
  };
  
  const closeModal = () => {
    setIsMvModalOpen(false);
    setEditingMonthlyValue(null);
  };

  return (
    <div className="space-y-6">
      {trendData.length > 0 && (
        <Card>
            <h2 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text flex items-center gap-3">
              <ChartBarSquareIcon className="w-7 h-7 text-green-500" />
              <span>자산 추이</span>
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData}>
                  <defs>
                      <linearGradient id="colorTotalValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis dataKey="date" />
                  <YAxis orientation="left" stroke="#3b82f6" tickFormatter={(value) => new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(value as number)} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Area type="monotone" dataKey="totalValue" name="계좌 총액" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTotalValue)" />
              </AreaChart>
            </ResponsiveContainer>
        </Card>
      )}

      <Card>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-light-text dark:text-dark-text flex items-center gap-3">
              <CalendarDaysIcon className="w-7 h-7 text-purple-500" />
              <span>월말 자산 기록</span>
            </h2>
            <Button onClick={openAddModal}>새 기록 추가</Button>
        </div>
        {/* Desktop Table View */}
        <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                        <th scope="col" className="p-3 text-left text-xs font-medium text-light-secondary dark:text-dark-secondary uppercase tracking-wider">기준일</th>
                        <th scope="col" className="p-3 text-right text-xs font-medium text-light-secondary dark:text-dark-secondary uppercase tracking-wider">계좌 총액</th>
                        <th scope="col" className="p-3 text-center text-xs font-medium text-light-secondary dark:text-dark-secondary uppercase tracking-wider">관리</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {(monthlyValues || []).length === 0 ? (
                        <tr>
                            <td colSpan={3} className="p-6 text-center text-light-secondary dark:text-dark-secondary">
                                기록된 월말 자산이 없습니다. '새 기록 추가' 버튼을 눌러 시작하세요.
                            </td>
                        </tr>
                    ) : (
                        (monthlyValues || []).map(mv => (
                            <tr key={mv.id} className="hover:bg-blue-100/50 dark:hover:bg-slate-800 transition-colors duration-150">
                                <td className="p-3 text-light-text dark:text-dark-text">{mv.date}</td>
                                <td className="p-3 text-right text-light-text dark:text-dark-text">{formatCurrency(Number(mv.totalValue) || 0)}</td>
                                <td className="p-3 text-center">
                                    <div className="flex justify-center gap-2">
                                      <Button onClick={() => openEditModal(mv)} variant="secondary" className="px-2 py-1 text-xs">수정</Button>
                                      <Button onClick={() => deleteMonthlyValue(mv.id)} className="px-2 py-1 text-xs bg-loss text-white hover:bg-red-700 focus:ring-red-500">삭제</Button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
        
        {/* Mobile Card View */}
        <div className="space-y-3 md:hidden">
            {(monthlyValues || []).length === 0 ? (
                <p className="text-center py-8 text-light-secondary dark:text-dark-secondary">
                    기록된 월말 자산이 없습니다.
                </p>
            ) : (
                (monthlyValues || []).map(mv => (
                    <div key={mv.id} className="bg-light-bg dark:bg-dark-bg/50 rounded-lg p-4 flex justify-between items-center">
                        <div>
                            <p className="font-bold text-light-text dark:text-dark-text">{mv.date}</p>
                            <p className="text-sm text-light-secondary dark:text-dark-secondary mt-1">계좌 총액</p>
                            <p className="text-lg font-bold text-light-primary dark:text-dark-primary">{formatCurrency(Number(mv.totalValue) || 0)}</p>
                        </div>
                        <div className="text-right flex gap-2">
                            <Button onClick={() => openEditModal(mv)} variant="secondary" className="px-2 py-1 text-xs">수정</Button>
                            <Button onClick={() => deleteMonthlyValue(mv.id)} className="px-2 py-1 text-xs bg-loss text-white hover:bg-red-700 focus:ring-red-500">삭제</Button>
                        </div>
                    </div>
                ))
            )}
        </div>
      </Card>

      <Modal isOpen={isMvModalOpen} onClose={closeModal} title={editingMonthlyValue ? "월말 자산 기록 수정" : "월말 자산 기록 추가"}>
        <form onSubmit={handleMvSubmit} className="space-y-4">
          <Input label="기준월" id="mv-month" name="month" type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} required />
          <Input label="계좌 총액" id="mv-totalValue" name="totalValue" type="text" inputMode="numeric" placeholder="해당 월말의 총 자산액" value={formatNumber(newTotalValue)} onChange={(e) => {
              const numValue = parseFloat(e.target.value.replace(/,/g, ''));
              setNewTotalValue(isNaN(numValue) ? 0 : numValue);
            }} required />
           <p className="text-xs text-light-secondary dark:text-dark-secondary pt-1">
                선택한 월의 마지막 날짜로 기록됩니다.
           </p>
          <div className="flex justify-end pt-4">
            <Button type="submit">{editingMonthlyValue ? '저장' : '추가'}</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default MonthlyHistoryScreen;