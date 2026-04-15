import React, { useState, useMemo } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { AccountTransaction, TransactionType, Account, BankAccount, InvestmentGoal } from '../types';

interface AccountTransactionsScreenProps {
  transactions: AccountTransaction[];
  setTransactions: React.Dispatch<React.SetStateAction<AccountTransaction[]>>;
  accounts: Account[];
  bankAccounts: BankAccount[];
  investmentGoals: InvestmentGoal[];
}

const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);

const formatNumber = (value: number | string): string => {
  if (value === '' || value === null || value === undefined || Number(value) === 0) return '';
  const num = Number(String(value).replace(/,/g, ''));
  if (isNaN(num)) return '';
  return num.toLocaleString('ko-KR');
};

type SortKey = keyof AccountTransaction | 'accountName' | 'counterpartyAccountName';

const AccountTransactionsScreen: React.FC<AccountTransactionsScreenProps> = ({ transactions, setTransactions, accounts, bankAccounts, investmentGoals }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<AccountTransaction | null>(null);
  const [formState, setFormState] = useState<Omit<AccountTransaction, 'id'>>({
    date: new Date().toISOString().split('T')[0],
    accountId: (accounts || [])[0]?.id || '',
    amount: 0,
    transactionType: TransactionType.Deposit,
    counterpartyAccountId: undefined,
    goalId: undefined,
  });
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<AccountTransaction | null>(null);

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' }>({ key: 'date', direction: 'descending' });
  const [filters, setFilters] = useState({
    year: 'all',
    month: 'all',
    accountId: 'all',
    transactionType: 'all',
    counterpartyAccountId: 'all'
  });

  const allAccountsMap = useMemo(() => {
    const map = new Map<string, string>();
    (accounts || []).forEach(a => map.set(a.id, a.name));
    (bankAccounts || []).forEach(b => map.set(b.id, `${b.bankName} ${b.name}`));
    return map;
  }, [accounts, bankAccounts]);
  
  const filterOptions = useMemo(() => {
    const years = new Set<string>();
    const accountIds = new Set<string>();
    const counterpartyAccountIds = new Set<string>();

    (transactions || []).forEach(t => {
      years.add(new Date(t.date).getFullYear().toString());
      if (t.accountId) accountIds.add(t.accountId);
      if (t.counterpartyAccountId) counterpartyAccountIds.add(t.counterpartyAccountId);
    });

    return {
      years: Array.from(years).sort((a, b) => b.localeCompare(a)),
      months: Array.from({ length: 12 }, (_, i) => (i + 1).toString()),
      accounts: Array.from(accountIds).map(id => ({ id, name: allAccountsMap.get(id) || '알 수 없는 계좌' })),
      counterpartyAccounts: Array.from(counterpartyAccountIds).map(id => ({ id, name: allAccountsMap.get(id) || '알 수 없는 계좌' })),
    };
  }, [transactions, allAccountsMap]);

  const filteredAndSortedTransactions = useMemo(() => {
    let filteredItems = (transactions || []).filter(t => t.transactionType !== TransactionType.Dividend);

    // Filtering
    filteredItems = filteredItems.filter(t => {
      const date = new Date(t.date);
      if (filters.year !== 'all' && date.getFullYear().toString() !== filters.year) return false;
      if (filters.month !== 'all' && (date.getMonth() + 1).toString() !== filters.month) return false;
      if (filters.accountId !== 'all' && t.accountId !== filters.accountId) return false;
      if (filters.transactionType !== 'all' && t.transactionType !== filters.transactionType) return false;
      if (filters.counterpartyAccountId !== 'all') {
         if (filters.counterpartyAccountId === 'none' && t.counterpartyAccountId) return false;
         if (filters.counterpartyAccountId !== 'none' && t.counterpartyAccountId !== filters.counterpartyAccountId) return false;
      }
      return true;
    });

    // Sorting
    if (sortConfig !== null) {
      filteredItems.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        const key = sortConfig.key;

        if (key === 'accountName') {
            aValue = allAccountsMap.get(a.accountId) || '';
            bValue = allAccountsMap.get(b.accountId) || '';
        } else if (key === 'counterpartyAccountName') {
            aValue = a.counterpartyAccountId ? allAccountsMap.get(a.counterpartyAccountId) || '' : '';
            bValue = b.counterpartyAccountId ? allAccountsMap.get(b.counterpartyAccountId) || '' : '';
        } else if (key === 'date') {
            aValue = new Date(a.date).getTime();
            bValue = new Date(b.date).getTime();
        } else {
            aValue = a[key as keyof AccountTransaction];
            bValue = b[key as keyof AccountTransaction];
        }
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        } else {
            const strA = String(aValue).toLowerCase();
            const strB = String(bValue).toLowerCase();
            if (strA < strB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (strA > strB) return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return filteredItems;
  }, [transactions, sortConfig, filters, allAccountsMap]);

  const isFilterActive = useMemo(() => Object.values(filters).some(v => v !== 'all'), [filters]);
  
  const resetFilters = () => {
    setFilters({
      year: 'all',
      month: 'all',
      accountId: 'all',
      transactionType: 'all',
      counterpartyAccountId: 'all',
    });
  };

  const requestSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const getSortIndicator = (columnKey: SortKey) => {
    if (sortConfig?.key !== columnKey) return null;
    return <span className="ml-1">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'amount') {
      const numValue = parseFloat(value.replace(/,/g, ''));
      setFormState(prev => ({ ...prev, [name]: isNaN(numValue) ? 0 : numValue }));
    } else {
      if (name === 'counterpartyAccountId' || name === 'goalId') {
        setFormState(prev => ({...prev, [name]: value === '' ? undefined : value}));
      } else {
        setFormState(prev => ({ ...prev, [name]: value }));
      }
    }
  };

  const handleAddClick = () => {
    setEditingTransaction(null);
    setFormState({
      date: new Date().toISOString().split('T')[0],
      accountId: (accounts || [])[0]?.id || '',
      amount: 0,
      transactionType: TransactionType.Deposit,
      counterpartyAccountId: undefined,
      goalId: undefined,
    });
    setIsModalOpen(true);
  };

  const handleEditClick = (transaction: AccountTransaction) => {
    setEditingTransaction(transaction);
    setFormState({
      date: transaction.date,
      accountId: transaction.accountId,
      amount: transaction.amount,
      transactionType: transaction.transactionType,
      counterpartyAccountId: transaction.counterpartyAccountId,
      goalId: transaction.goalId,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTransaction(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = Number(formState.amount);
    if (isNaN(amount)) {
      alert('금액에 유효한 숫자를 입력해주세요.');
      return;
    }

    if (!formState.accountId || amount <= 0) {
      alert('모든 필드를 올바르게 입력해주세요.');
      return;
    }

    const transactionToSave = {
      ...formState,
      amount,
    };

    if (editingTransaction) {
      const updatedTransaction: AccountTransaction = {
        ...editingTransaction,
        ...transactionToSave,
      };
      setTransactions(prev =>
        (prev || []).map(t => (t.id === editingTransaction.id ? updatedTransaction : t))
      );
    } else {
      setTransactions(prev => [{ ...transactionToSave, id: Date.now().toString() } as AccountTransaction, ...(prev || [])]);
    }
    
    handleCloseModal();
  };
  
  const handleSelect = (id: string) => {
    setSelectedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        return newSet;
    });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          const allIds = new Set(filteredAndSortedTransactions.map(t => t.id));
          setSelectedIds(allIds);
      } else {
          setSelectedIds(new Set());
      }
  };
  
  const handleDeleteClick = (transaction: AccountTransaction) => {
    setTransactionToDelete(transaction);
    setIsConfirmModalOpen(true);
  };
  
  const handleDeleteSelectedClick = () => {
    if (selectedIds.size > 0) {
        setTransactionToDelete(null);
        setIsConfirmModalOpen(true);
    }
  };
  
  const confirmDelete = () => {
    if (transactionToDelete) {
        setTransactions(prev => (prev || []).filter(t => t.id !== transactionToDelete.id));
        handleCloseModal();
    } else {
        setTransactions(prev => (prev || []).filter(t => !selectedIds.has(t.id)));
        setSelectedIds(new Set());
    }
    setIsConfirmModalOpen(false);
    setTransactionToDelete(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex justify-end gap-2">
          {selectedIds.size > 0 ? (
            <Button onClick={handleDeleteSelectedClick} className="bg-loss text-white hover:bg-red-700 focus:ring-red-500">
              {`선택된 ${selectedIds.size}개 항목 삭제`}
            </Button>
          ) : (
            <Button onClick={handleAddClick}>기록하기</Button>
          )}
        </div>
      </Card>

      <Card>
        <details className="group">
          <summary className="cursor-pointer font-semibold text-light-text dark:text-dark-text list-none group-open:mb-4">
            <div className="flex justify-between items-center">
              <span>
                필터링 옵션
                {isFilterActive && <span className="ml-2 text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">적용 중</span>}
              </span>
              <div className="flex items-center">
                {isFilterActive && <button type="button" onClick={(e) => { e.preventDefault(); resetFilters(); }} className="text-xs font-medium text-light-primary dark:text-dark-primary hover:underline mr-2">초기화</button>}
                <span className="text-xs text-light-secondary dark:text-dark-secondary group-open:hidden">펼치기</span>
              </div>
            </div>
          </summary>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Select label="연도" name="year" value={filters.year} onChange={handleFilterChange}>
              <option value="all">전체</option>
              {filterOptions.years.map(y => <option key={y} value={y}>{y}년</option>)}
            </Select>
            <Select label="월" name="month" value={filters.month} onChange={handleFilterChange}>
              <option value="all">전체</option>
              {filterOptions.months.map(m => <option key={m} value={m}>{m}월</option>)}
            </Select>
            <Select label="계좌" name="accountId" value={filters.accountId} onChange={handleFilterChange}>
              <option value="all">전체</option>
              {filterOptions.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
            <Select label="구분" name="transactionType" value={filters.transactionType} onChange={handleFilterChange}>
              <option value="all">전체</option>
              <option value={TransactionType.Deposit}>입금</option>
              <option value={TransactionType.Withdrawal}>출금</option>
            </Select>
            <Select label="상대계좌" name="counterpartyAccountId" value={filters.counterpartyAccountId} onChange={handleFilterChange}>
              <option value="all">전체</option>
              <option value="none">없음(외부)</option>
              {filterOptions.counterpartyAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
        </details>
      </Card>
      
      <Card>
        {/* Desktop Table View */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr className="text-xs font-medium text-light-secondary dark:text-dark-secondary uppercase tracking-wider">
                <th className="p-3">
                  <input type="checkbox" onChange={handleSelectAll} checked={filteredAndSortedTransactions.length > 0 && selectedIds.size === filteredAndSortedTransactions.length} disabled={filteredAndSortedTransactions.length === 0} aria-label="모든 항목 선택" className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-light-primary focus:ring-light-primary bg-gray-100 dark:bg-gray-700" />
                </th>
                <th className="p-3 text-left"><button className="flex items-center" onClick={() => requestSort('date')}>일자{getSortIndicator('date')}</button></th>
                <th className="p-3 text-left"><button className="flex items-center" onClick={() => requestSort('accountName')}>계좌{getSortIndicator('accountName')}</button></th>
                <th className="p-3 text-left"><button className="flex items-center" onClick={() => requestSort('transactionType')}>구분{getSortIndicator('transactionType')}</button></th>
                <th className="p-3 text-right"><button className="flex items-center w-full justify-end" onClick={() => requestSort('amount')}>금액{getSortIndicator('amount')}</button></th>
                <th className="p-3 text-left"><button className="flex items-center" onClick={() => requestSort('counterpartyAccountName')}>상대계좌{getSortIndicator('counterpartyAccountName')}</button></th>
                <th className="p-3 text-center">수정</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedTransactions.map(transaction => (
                <tr key={transaction.id} className="border-b dark:border-gray-700 last:border-b-0 hover:bg-blue-100/50 dark:hover:bg-gray-800 transition-colors duration-150">
                  <td className="p-3"><input type="checkbox" checked={selectedIds.has(transaction.id)} onChange={() => handleSelect(transaction.id)} aria-labelledby={`transaction-account-${transaction.id}`} className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-light-primary focus:ring-light-primary bg-gray-100 dark:bg-gray-700" /></td>
                  <td className="p-3">{transaction.date}</td>
                  <td className="p-3 font-semibold" id={`transaction-account-${transaction.id}`}>{allAccountsMap.get(transaction.accountId) || 'N/A'}</td>
                  <td className={`p-3 font-semibold ${transaction.transactionType === TransactionType.Deposit ? 'text-profit' : 'text-loss'}`}>{transaction.transactionType === TransactionType.Deposit ? '입금' : '출금'}</td>
                  <td className="p-3 text-right">{formatCurrency(Number(transaction.amount) || 0)}</td>
                  <td className="p-3">{transaction.counterpartyAccountId ? allAccountsMap.get(transaction.counterpartyAccountId) : '외부'}</td>
                  <td className="p-3 text-center"><Button variant="secondary" onClick={() => handleEditClick(transaction)} className="px-2 py-1 text-xs">수정</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile Card View */}
        <div className="space-y-3 md:hidden">
            <div className="flex items-center p-2">
                <input type="checkbox" onChange={handleSelectAll} checked={filteredAndSortedTransactions.length > 0 && selectedIds.size === filteredAndSortedTransactions.length} disabled={filteredAndSortedTransactions.length === 0} aria-label="모든 항목 선택" className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-light-primary focus:ring-light-primary bg-gray-100 dark:bg-gray-700" />
                <label className="ml-2 text-sm">전체 선택</label>
            </div>
            {filteredAndSortedTransactions.length === 0 ? (
                <p className="text-center py-8 text-light-secondary dark:text-dark-secondary">해당 조건의 기록이 없습니다.</p>
            ) : (
                filteredAndSortedTransactions.map(transaction => {
                    const isDeposit = transaction.transactionType === TransactionType.Deposit;
                    return (
                    <div key={transaction.id} className="bg-light-bg dark:bg-dark-bg/50 rounded-lg p-3 flex items-center gap-3 border-l-4" style={{borderColor: isDeposit ? '#22c55e' : '#ef4444'}}>
                        <input type="checkbox" checked={selectedIds.has(transaction.id)} onChange={() => handleSelect(transaction.id)} aria-label="항목 선택" className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-light-primary focus:ring-light-primary bg-gray-100 dark:bg-gray-700 flex-shrink-0" />
                        <div className="flex-grow">
                            <div className="flex justify-between items-start text-sm">
                                <div>
                                    <p className="font-bold text-base sm:text-lg text-light-text dark:text-dark-text">{allAccountsMap.get(transaction.accountId) || 'N/A'}</p>
                                    <p className="text-light-secondary dark:text-dark-secondary">{transaction.date}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold text-base sm:text-lg ${isDeposit ? 'text-profit' : 'text-loss'}`}>{formatCurrency(transaction.amount)}</p>
                                    <p className="text-light-secondary dark:text-dark-secondary">{isDeposit ? '입금' : '출금'}</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-end mt-2 text-sm">
                                <p className="text-light-secondary dark:text-dark-secondary">
                                    상대: {transaction.counterpartyAccountId ? allAccountsMap.get(transaction.counterpartyAccountId) : '외부'}
                                </p>
                                <Button variant="secondary" onClick={() => handleEditClick(transaction)} className="px-2 py-1 text-xs">수정</Button>
                            </div>
                        </div>
                    </div>
                    );
                })
            )}
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingTransaction ? '입출금 기록 수정' : '입출금 기록 추가'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="일자" id="date" name="date" type="date" value={formState.date} onChange={handleInputChange} required />
          <Select label="계좌" id="accountId" name="accountId" value={formState.accountId} onChange={handleInputChange} required>
            {(accounts || []).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
          </Select>
           <Select label="입금/출금" id="transactionType" name="transactionType" value={formState.transactionType} onChange={handleInputChange} required>
            <option value={TransactionType.Deposit}>입금</option>
            <option value={TransactionType.Withdrawal}>출금</option>
          </Select>
          <Input label="금액" id="amount" name="amount" type="text" inputMode="numeric" value={formatNumber(formState.amount || 0)} onChange={handleInputChange} required />
           <Select label="상대계좌 (선택)" id="counterpartyAccountId" name="counterpartyAccountId" value={formState.counterpartyAccountId || ''} onChange={handleInputChange}>
            <option value="">없음 (외부 입출금)</option>
            <optgroup label="증권계좌">
              {(accounts || []).filter(acc => acc.id !== formState.accountId).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
            </optgroup>
            <optgroup label="은행계좌">
              {(bankAccounts || []).map(bacc => <option key={bacc.id} value={bacc.id}>{bacc.bankName} {bacc.name}</option>)}
            </optgroup>
          </Select>
          <Select label="투자 구분" id="goalId" name="goalId" value={formState.goalId || ''} onChange={handleInputChange}>
            <option value="">자산배분 포트폴리오</option>
            {(investmentGoals || []).map(goal => <option key={goal.id} value={goal.id}>{goal.name}</option>)}
          </Select>
          <div className="flex justify-between items-center pt-4">
            <div>
              {editingTransaction && (
                  <Button
                      type="button"
                      onClick={() => editingTransaction && handleDeleteClick(editingTransaction)}
                      className="bg-loss text-white hover:bg-red-700 focus:ring-red-500"
                  >
                      삭제
                  </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={handleCloseModal}>
                  취소
              </Button>
              <Button type="submit">{editingTransaction ? '저장' : '추가'}</Button>
            </div>
          </div>
        </form>
      </Modal>
      
      <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title="삭제 확인">
        <div>
          {transactionToDelete ? (
            <p>정말로 이 입출금 기록을 삭제하시겠습니까?</p>
          ) : (
            <p>정말로 선택된 {selectedIds.size}개의 입출금 기록을 삭제하시겠습니까?</p>
          )}
          <p className="text-sm text-loss mt-2">이 작업은 되돌릴 수 없습니다.</p>
        </div>
        <div className="flex justify-end mt-6 space-x-2">
            <Button onClick={() => setIsConfirmModalOpen(false)} variant="secondary">
            취소
            </Button>
            <Button onClick={confirmDelete} className="bg-loss text-white hover:bg-red-700 focus:ring-red-500">
            삭제
            </Button>
        </div>
      </Modal>
    </div>
  );
};

export default AccountTransactionsScreen;