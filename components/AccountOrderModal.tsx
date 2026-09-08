import React, { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { Account, Broker } from '../types';
import { ArrowsUpDownIcon, ChevronUpIcon, ChevronDownIcon } from './Icons';

interface AccountOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  brokers: Broker[];
  accountValues?: { [accountId: string]: number };
  onSaveOrder: (orderedAccounts: Account[]) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);

const AccountOrderModal: React.FC<AccountOrderModalProps> = ({
  isOpen,
  onClose,
  accounts,
  brokers,
  accountValues = {},
  onSaveOrder,
}) => {
  const [items, setItems] = useState<Account[]>([]);
  const [hasChanged, setHasChanged] = useState(false);

  // Broker ID to Name map
  const brokerMap = React.useMemo(
    () => new Map((brokers || []).map((b) => [b.id, b.name])),
    [brokers]
  );

  // Initialize sorted items when modal opens
  useEffect(() => {
    if (isOpen) {
      const sorted = [...(accounts || [])].sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 999999;
        const orderB = typeof b.order === 'number' ? b.order : 999999;
        if (orderA !== orderB) return orderA - orderB;
        return 0;
      });
      setItems(sorted);
      setHasChanged(false);
    }
  }, [isOpen, accounts]);

  // Move item up or down
  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    setItems(newItems);
    setHasChanged(true);
  };

  // Move directly to top or bottom
  const moveToExtreme = (index: number, position: 'top' | 'bottom') => {
    if (index < 0 || index >= items.length) return;
    const newItems = [...items];
    const [target] = newItems.splice(index, 1);
    if (position === 'top') {
      newItems.unshift(target);
    } else {
      newItems.push(target);
    }
    setItems(newItems);
    setHasChanged(true);
  };

  // Jump item to a specific rank (1-based index)
  const jumpToRank = (currentIndex: number, newRankStr: string) => {
    const targetRank = parseInt(newRankStr, 10);
    if (isNaN(targetRank)) return;
    const targetIndex = targetRank - 1;
    if (targetIndex < 0 || targetIndex >= items.length || targetIndex === currentIndex) return;

    const newItems = [...items];
    const [target] = newItems.splice(currentIndex, 1);
    newItems.splice(targetIndex, 0, target);

    setItems(newItems);
    setHasChanged(true);
  };

  // Preset sort: Name (A-Z)
  const sortByName = () => {
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
    setItems(sorted);
    setHasChanged(true);
  };

  // Preset sort: Broker
  const sortByBroker = () => {
    const sorted = [...items].sort((a, b) => {
      const brokerA = brokerMap.get(a.brokerId) || '';
      const brokerB = brokerMap.get(b.brokerId) || '';
      const brokerDiff = brokerA.localeCompare(brokerB, 'ko-KR');
      if (brokerDiff !== 0) return brokerDiff;
      return a.name.localeCompare(b.name, 'ko-KR');
    });
    setItems(sorted);
    setHasChanged(true);
  };

  // Preset sort: Total Asset Value (High to Low)
  const sortByAssets = () => {
    const sorted = [...items].sort((a, b) => {
      const valA = accountValues[a.id] ?? 0;
      const valB = accountValues[b.id] ?? 0;
      return valB - valA;
    });
    setItems(sorted);
    setHasChanged(true);
  };

  // Preset sort: Account Type (일반 -> ISA -> 연금저축 -> IRP -> 퇴직DC)
  const sortByAccountType = () => {
    const typeOrder: Record<string, number> = {
      일반: 1,
      ISA: 2,
      연금저축: 3,
      IRP: 4,
      퇴직DC: 5,
    };
    const sorted = [...items].sort((a, b) => {
      const rankA = typeOrder[a.accountType || '일반'] || 99;
      const rankB = typeOrder[b.accountType || '일반'] || 99;
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name, 'ko-KR');
    });
    setItems(sorted);
    setHasChanged(true);
  };

  // Save changes
  const handleSave = () => {
    const withOrder = items.map((acc, index) => ({
      ...acc,
      order: index + 1,
    }));
    onSaveOrder(withOrder);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="주식계좌 표시 순서 변경">
      <div className="space-y-4">
        <p className="text-xs sm:text-sm text-light-secondary dark:text-dark-secondary leading-relaxed">
          계좌화면 및 앱 전체에서 표시될 주식계좌의 순서를 자유롭게 조정할 수 있습니다. 
          화살표 또는 순위 번호를 눌러 변경하거나 빠른 정렬 버튼을 이용해 보세요.
        </p>

        {/* Quick Sort Presets */}
        <div className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200/80 dark:border-slate-700/60">
          <div className="text-xs font-semibold text-light-text dark:text-dark-text mb-2 flex items-center gap-1.5">
            <ArrowsUpDownIcon className="w-3.5 h-3.5 text-blue-500" />
            <span>빠른 자동 정렬</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={sortByName}
              className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 text-light-text dark:text-dark-text transition-colors cursor-pointer shadow-2xs"
            >
              이름순 (가나다)
            </button>
            <button
              type="button"
              onClick={sortByBroker}
              className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 text-light-text dark:text-dark-text transition-colors cursor-pointer shadow-2xs"
            >
              증권사순
            </button>
            <button
              type="button"
              onClick={sortByAssets}
              className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 text-light-text dark:text-dark-text transition-colors cursor-pointer shadow-2xs"
            >
              총 자산 많은 순
            </button>
            <button
              type="button"
              onClick={sortByAccountType}
              className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 text-light-text dark:text-dark-text transition-colors cursor-pointer shadow-2xs"
            >
              계좌 유형순
            </button>
          </div>
        </div>

        {/* Reorderable List */}
        <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
          {items.map((account, index) => {
            const brokerName = brokerMap.get(account.brokerId) || '증권사 미지정';
            const totalVal = accountValues[account.id];

            return (
              <div
                key={account.id}
                className="flex items-center justify-between p-2.5 sm:p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-200/90 dark:border-slate-700/80 shadow-2xs hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
              >
                {/* Left: Rank & Details */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                  {/* Rank selector */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <select
                      value={index + 1}
                      onChange={(e) => jumpToRank(index, e.target.value)}
                      className="text-xs bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded px-1 py-0.5 text-light-text dark:text-dark-text cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      title="원하는 순서로 직접 이동"
                    >
                      {items.map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}위
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-light-text dark:text-dark-text truncate">
                        {account.name}
                      </span>
                      {account.accountType && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 uppercase">
                          {account.accountType}
                        </span>
                      )}
                      {account.isTaxFree && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
                          비과세
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-light-secondary dark:text-dark-secondary mt-0.5">
                      <span>{brokerName}</span>
                      {typeof totalVal === 'number' && (
                        <>
                          <span>•</span>
                          <span className="font-medium text-light-text dark:text-dark-text">
                            {formatCurrency(totalVal)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Movement Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveToExtreme(index, 'top')}
                    className="px-1.5 py-1 text-[11px] font-semibold rounded bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-30 disabled:hover:bg-gray-100 dark:disabled:hover:bg-slate-700 text-light-text dark:text-dark-text cursor-pointer disabled:cursor-not-allowed"
                    title="맨 위로"
                  >
                    ⤒
                  </button>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveItem(index, -1)}
                    className="p-1.5 rounded bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-30 disabled:hover:bg-gray-100 dark:disabled:hover:bg-slate-700 text-light-text dark:text-dark-text cursor-pointer disabled:cursor-not-allowed"
                    title="한 칸 위로"
                  >
                    <ChevronUpIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === items.length - 1}
                    onClick={() => moveItem(index, 1)}
                    className="p-1.5 rounded bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-30 disabled:hover:bg-gray-100 dark:disabled:hover:bg-slate-700 text-light-text dark:text-dark-text cursor-pointer disabled:cursor-not-allowed"
                    title="한 칸 아래로"
                  >
                    <ChevronDownIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === items.length - 1}
                    onClick={() => moveToExtreme(index, 'bottom')}
                    className="px-1.5 py-1 text-[11px] font-semibold rounded bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-30 disabled:hover:bg-gray-100 dark:disabled:hover:bg-slate-700 text-light-text dark:text-dark-text cursor-pointer disabled:cursor-not-allowed"
                    title="맨 아래로"
                  >
                    ⤓
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-3 border-t border-gray-200/80 dark:border-slate-700">
          <span className="text-xs text-light-secondary dark:text-dark-secondary">
            {hasChanged ? '순서가 변경되었습니다.' : '총 ' + items.length + '개 계좌'}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button variant="primary" onClick={handleSave}>
              순서 적용 및 저장
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AccountOrderModal;
