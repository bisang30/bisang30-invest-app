import React, { useMemo, useState } from 'react';
import { calculateTradeFeeAndTax, calculateAccountCashBalance } from '../services/feeService';
import { Account, Broker, Trade, AccountTransaction, TransactionType, Stock, TradeType, HistoricalGain, PortfolioCategory, FeeSettings } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

interface AssetAllocationScreenProps {
  accounts: Account[];
  brokers: Broker[];
  trades: Trade[];
  transactions: AccountTransaction[];
  stocks: Stock[];
  setStocks: React.Dispatch<React.SetStateAction<Stock[]>>;
  stockPrices: { [key: string]: number };
  historicalGains: HistoricalGain[];
  feeSettings?: FeeSettings;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(Math.round(value));

// Smart auto-classifier helper for stocks
export function getAssetClassification(stock: Stock) {
  // Country fallback: detect South Korea vs US vs Others
  let country: '한국' | '미국' | '기타' = stock.country || '한국';
  if (!stock.country) {
    const ticker = stock.ticker || '';
    if (/^\d{6}$/.test(ticker)) {
      country = '한국';
    } else if (/^[a-zA-Z.]+$/.test(ticker) && ticker.length <= 5) {
      country = '미국';
    } else {
      country = '기타';
    }
  }

  // SubCategory fallback based on Category & Stock name
  let subCategory: '금' | '채권' | '현금' | '머니마켓액티브' | '주식' = stock.subCategory || '주식';
  if (!stock.subCategory) {
    const name = stock.name || '';
    const ticker = stock.ticker || '';
    const cat = stock.category;

    if (
      name.includes('머니마켓') || 
      name.includes('MMF') || 
      name.includes('MMDA') || 
      name.includes('KOFR') || 
      name.includes('CD금리') || 
      ticker.includes('KOFR') || 
      ticker.includes('CD금리') || 
      name.includes('Active MMF') || 
      name.includes('액티브 MMF')
    ) {
      subCategory = '머니마켓액티브';
    } else if (
      cat === PortfolioCategory.Alternatives || 
      name.includes('골드') || 
      name.includes('금선물') || 
      name.includes('GOLD') || 
      name.includes('Gold')
    ) {
      subCategory = '금';
    } else if (
      cat === '채권' || 
      name.includes('채권') || 
      name.includes('Treasury') || 
      name.includes('Bond') || 
      name.includes('T-Bill')
    ) {
      subCategory = '채권';
    } else if (cat === PortfolioCategory.Cash) {
      subCategory = '현금';
    } else {
      subCategory = '주식';
    }
  }

  // Detect ETF
  let isEtf = stock.isEtf;
  const name = stock.name || '';
  const ticker = stock.ticker || '';

  if (isEtf === undefined) {
    const etfKeywords = [
      'ETF', 'KODEX', 'TIGER', 'ACE', 'SOL', 'KBSTAR', 'HANARO', 'KOSEF', 'ARIRANG', 'WOORI',
      'SPY', 'VOO', 'QQQ', 'DIA', 'SCHD', 'JEPI', 'JEPQ', 'IWM', 'TLT', 'VNQ', 'AGG', 'VT', 'VTI', 'SOXX'
    ];
    const upperName = name.toUpperCase();
    const upperTicker = ticker.toUpperCase();
    if (etfKeywords.some(keyword => upperName.includes(keyword) || upperTicker.includes(keyword))) {
      isEtf = true;
    } else {
      isEtf = false;
    }
  }

  // Determine ETF Type
  let etfType: '배당' | '지수추종' | '섹터추종' | '없음' = stock.etfType || '없음';
  if (isEtf) {
    if (stock.etfType && stock.etfType !== '없음') {
      etfType = stock.etfType;
    } else {
      const upperName = name.toUpperCase();
      const upperTicker = ticker.toUpperCase();
      const isDividend = upperName.includes('배당') || upperName.includes('고배당') || upperName.includes('DIVIDEND') || upperName.includes('월배당') || upperName.includes('리츠') || upperName.includes('REIT') || upperTicker === 'SCHD' || upperTicker === 'JEPI' || upperTicker === 'JEPQ';
      const isIndex = upperName.includes('S&P500') || upperName.includes('나스닥') || upperName.includes('NASDAQ') || upperName.includes('코스피') || upperName.includes('KOSPI') || upperName.includes('코스닥') || upperName.includes('KOSDAQ') || upperName.includes('MSCI') || upperTicker === 'SPY' || upperTicker === 'VOO' || upperTicker === 'QQQ' || upperTicker === 'IVV' || upperTicker === 'VTI' || upperTicker === 'VT' || upperName.includes('지수');
      
      if (isDividend) {
        etfType = '배당';
      } else if (isIndex) {
        etfType = '지수추종';
      } else {
        etfType = '섹터추종';
      }
    }
  } else {
    etfType = '없음';
  }

  // Safety type classification: Safety (금, 채권, 현금, 머니마켓액티브) vs Non-Safety (주식)
  const isSafety = (subCategory === '금' || subCategory === '채권' || subCategory === '현금' || subCategory === '머니마켓액티브');
  const safetyType: '안전자산' | '비안전자산' = isSafety ? '안전자산' : '비안전자산';

  return { country, subCategory, safetyType, isEtf, etfType };
}

export const ACCOUNT_GROUPS = [
  { id: 'all', name: '전체 계좌', description: '퇴직금, 연금저축, ISA, 개별계좌, CMA 등 전체 계좌' },
  { id: 'retirement_saving', name: '퇴직연저', description: '퇴직금(퇴직DC/IRP) + 연금저축(연금저축1/이전) 계좌 합산' },
  { id: 'long_term', name: '장기투자', description: '퇴직금 + 연금저축 + ISA 계좌 합산' },
  { id: 'severance', name: '퇴직금', description: '퇴직DC 및 개인형 IRP 계좌 합산' },
  { id: 'pension', name: '연금저축', description: '연금저축1 및 연금저축(이전) 계좌 합산' },
  { id: 'general', name: '개별계좌', description: '일반 위탁 및 개별 계좌' },
];

const AssetAllocationScreen: React.FC<AssetAllocationScreenProps> = ({
  accounts,
  brokers,
  trades,
  transactions,
  stocks,
  setStocks,
  stockPrices,
  historicalGains,
  feeSettings,
}) => {
  const stockMap = useMemo(() => new Map((stocks || []).map(s => [s.id, s])), [stocks]);
  const brokerMap = useMemo(() => new Map((brokers || []).map(b => [b.id, b.name])), [brokers]);

  // Tab State
  const [selectedGroupOrAccId, setSelectedGroupOrAccId] = useState<string>('all');
  const [isEditorExpanded, setIsEditorExpanded] = useState<boolean>(false);

  // 1. Calculate holdings and cash per account (similar logic to AccountStatusScreen)
  const accountDetails = useMemo(() => {
    const order = feeSettings?.sameDayTradeOrder || 'sellFirst';
    return (accounts || []).map(account => {
      const accountTrades = (trades || [])
        .filter(t => t.accountId === account.id)
        .sort((a, b) => {
          const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          if (order === 'inputOrder') {
            return (a.id || '').localeCompare(b.id || '');
          }
          if (a.tradeType !== b.tradeType) {
            if (order === 'buyFirst') {
              return a.tradeType === TradeType.Buy ? -1 : 1;
            } else {
              return a.tradeType === TradeType.Sell ? -1 : 1;
            }
          }
          return (a.id || '').localeCompare(b.id || '');
        });

      // Evaluate Stock quantities
      const accountHoldingsMap: { [stockId: string]: { quantity: number; totalCost: number } } = {};
      accountTrades.forEach(trade => {
        if (!trade.stockId) return;
        if (!accountHoldingsMap[trade.stockId]) {
          accountHoldingsMap[trade.stockId] = { quantity: 0, totalCost: 0 };
        }
        const quantity = Number(trade.quantity) || 0;
        const price = Number(trade.price) || 0;

        if (trade.tradeType === TradeType.Buy) {
          accountHoldingsMap[trade.stockId].quantity += quantity;
          accountHoldingsMap[trade.stockId].totalCost += quantity * price;
        } else {
          const avgCost = accountHoldingsMap[trade.stockId].quantity > 0 ? accountHoldingsMap[trade.stockId].totalCost / accountHoldingsMap[trade.stockId].quantity : 0;
          accountHoldingsMap[trade.stockId].quantity -= quantity;
          accountHoldingsMap[trade.stockId].totalCost -= quantity * avgCost;
          if (accountHoldingsMap[trade.stockId].quantity < 1e-9) {
            accountHoldingsMap[trade.stockId].quantity = 0;
            accountHoldingsMap[trade.stockId].totalCost = 0;
          }
        }
      });

      // Map stock valuations and cache classifications
      const stockAssets = Object.entries(accountHoldingsMap)
        .filter(([, data]) => data.quantity > 1e-9)
        .map(([stockId, data]) => {
          const stock = stockMap.get(stockId);
          if (!stock) return null;
          const currentPrice = stockPrices[stock.ticker] || 0;
          const currentValue = data.quantity * currentPrice;

          // Asset Classification
          const classification = getAssetClassification(stock);

          return {
            id: stockId,
            name: stock.name,
            ticker: stock.ticker,
            quantity: data.quantity,
            currentValue,
            classification,
            isStock: true,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      // Cash Balance Calculation
      const cashBalance = calculateAccountCashBalance(
        account,
        trades,
        transactions,
        historicalGains,
        feeSettings,
        stockMap
      );

      return {
        ...account,
        brokerName: brokerMap.get(account.brokerId) || '알 수 없음',
        cashBalance,
        stockAssets,
        totalValue: cashBalance + stockAssets.reduce((sum, s) => sum + s.currentValue, 0),
      };
    });
  }, [accounts, trades, transactions, stocks, stockPrices, brokerMap, stockMap, historicalGains, feeSettings]);

  // Filter accounts based on Selected Group or Selected Individual Account
  const filteredAccounts = useMemo(() => {
    if (selectedGroupOrAccId.startsWith('acc_')) {
      const targetId = selectedGroupOrAccId.replace('acc_', '');
      return accountDetails.filter(a => a.id === targetId);
    }

    const isPensionAcc = (a: any) => {
      const name = a.name || '';
      return a.accountType === '연금저축' || name.includes('연금저축') || name.includes('연금저축1') || name.includes('연금저축(이전)');
    };

    const isSeveranceAcc = (a: any) => {
      const name = a.name || '';
      return a.accountType === '퇴직DC' || a.accountType === 'IRP' || name.includes('퇴직DC') || name.includes('IRP') || name.includes('개인IRP') || name.includes('퇴직금');
    };

    switch (selectedGroupOrAccId) {
      case 'severance': // 퇴직금 (퇴직DC, 개인IRP)
        return accountDetails.filter(isSeveranceAcc);
      case 'pension': // 연금저축 (연금저축1, 연금저축(이전))
        return accountDetails.filter(isPensionAcc);
      case 'retirement_saving': // 퇴직연저 (퇴직금 + 연금저축 전체)
        return accountDetails.filter(a => isSeveranceAcc(a) || isPensionAcc(a));
      case 'long_term': // 장기투자 (퇴직금 + 연금저축 + ISA)
        return accountDetails.filter(a => isSeveranceAcc(a) || isPensionAcc(a) || a.accountType === 'ISA' || (a.name || '').includes('ISA'));
      case 'general': // 개별계좌
        return accountDetails.filter(a => a.accountType === '일반' || (a.name || '').includes('일반') || (a.name || '').includes('개별계좌') || (a.name || '').includes('일반종합'));
      case 'all': // 전체
      default:
        return accountDetails;
    }
  }, [selectedGroupOrAccId, accountDetails]);

  // Aggregate assets in filtered accounts
  const aggregateAssets = useMemo(() => {
    let totalCashAmount = 0;
    const stockAssetMap: { [stockId: string]: { name: string; ticker: string; value: number; quantity: number; classification: any } } = {};

    filteredAccounts.forEach(acc => {
      totalCashAmount += acc.cashBalance;
      acc.stockAssets.forEach(sa => {
        if (!stockAssetMap[sa.id]) {
          stockAssetMap[sa.id] = {
            name: sa.name,
            ticker: sa.ticker,
            value: 0,
            quantity: 0,
            classification: sa.classification,
          };
        }
        stockAssetMap[sa.id].value += sa.currentValue;
        stockAssetMap[sa.id].quantity += sa.quantity;
      });
    });

    const activeStocks = Object.entries(stockAssetMap)
      .map(([id, s]) => ({ id, ...s }))
      .filter(s => s.value > 1e-9);

    const totalPortfolioValue = totalCashAmount + activeStocks.reduce((sum, s) => sum + s.value, 0);

    return {
      cashValue: totalCashAmount,
      stocks: activeStocks,
      totalValue: totalPortfolioValue,
    };
  }, [filteredAccounts]);

  // Hierarchy levels order (Safety, Country, Detail asset group)
  const [hierarchyLevels, setHierarchyLevels] = useState<('safety' | 'country' | 'detail')[]>(['safety', 'country', 'detail']);

  // Expanded state for tree explorer nodes
  const [expandedNodes, setExpandedNodes] = useState<{ [key: string]: boolean }>({ 'root': true });

  // Drilldown path state for visual drilldown
  const [drillPath, setDrillPath] = useState<string[]>([]);

  // 1. Prepare asset items for hierarchical grouping
  const hierarchyItems = useMemo(() => {
    const { cashValue, stocks } = aggregateAssets;
    const list: any[] = [];
    
    if (cashValue > 0) {
      list.push({
        id: 'cash',
        name: '예수금 및 원화 현금',
        ticker: 'CASH',
        value: cashValue,
        isCash: true,
        classification: {
          country: '한국',
          subCategory: '현금',
          safetyType: '안전자산',
          isEtf: false,
          etfType: '없음'
        }
      });
    }

    stocks.forEach(s => {
      list.push({
        id: s.id,
        name: s.name,
        ticker: s.ticker,
        value: s.value,
        quantity: s.quantity,
        isCash: false,
        classification: s.classification
      });
    });

    return list;
  }, [aggregateAssets]);

  // 2. Build the hierarchical tree data structure recursively
  const hierarchyTree = useMemo(() => {
    const totalValue = aggregateAssets.totalValue;
    if (totalValue <= 0) return [];

    const colorPalette: { [key: string]: string } = {
      // Safety
      '안전자산': 'bg-emerald-500 dark:bg-emerald-400 text-emerald-600 dark:text-emerald-400',
      '비안전자산': 'bg-rose-500 dark:bg-rose-400 text-rose-600 dark:text-rose-400',
      // Country
      '한국': 'bg-blue-500 dark:bg-blue-400 text-blue-600 dark:text-blue-400',
      '미국': 'bg-red-500 dark:bg-red-400 text-red-600 dark:text-red-400',
      '기타': 'bg-amber-500 dark:bg-amber-400 text-amber-600 dark:text-amber-400',
      // Detail
      '개별주식': 'bg-purple-500 dark:bg-purple-400 text-purple-600 dark:text-purple-400',
      'ETF (배당)': 'bg-pink-500 dark:bg-pink-400 text-pink-600 dark:text-pink-400',
      'ETF (지수추종)': 'bg-sky-500 dark:bg-sky-400 text-sky-600 dark:text-sky-400',
      'ETF (섹터추종)': 'bg-indigo-500 dark:bg-indigo-400 text-indigo-600 dark:text-indigo-400',
      '채권': 'bg-teal-500 dark:bg-teal-400 text-teal-600 dark:text-teal-400',
      '현금': 'bg-slate-400 dark:bg-slate-500 text-slate-500 dark:text-slate-400',
      '금': 'bg-yellow-500 dark:bg-yellow-400 text-yellow-600 dark:text-yellow-400',
      '머니마켓액티브': 'bg-emerald-600 dark:bg-emerald-500 text-emerald-600 dark:text-emerald-400',
    };

    const getEmoji = (key: string) => {
      switch (key) {
        case '안전자산': return '🛡️';
        case '비안전자산': return '🚨';
        case '한국': return '🇰🇷';
        case '미국': return '🇺🇸';
        case '기타': return '🌐';
        case '개별주식': return '💎';
        case 'ETF (배당)': return '💰';
        case 'ETF (지수추종)': return '📈';
        case 'ETF (섹터추종)': return '🎯';
        case '채권': return '🧾';
        case '현금': return '💵';
        case '금': return '🪙';
        case '머니마켓액티브': return '🏦';
        default: return '📁';
      }
    };

    const getFieldVal = (item: any, field: 'safety' | 'country' | 'detail') => {
      if (field === 'safety') {
        return item.isCash ? '안전자산' : (item.classification?.safetyType || '비안전자산');
      }
      if (field === 'country') {
        return item.isCash ? '한국' : (item.classification?.country || '한국');
      }
      if (field === 'detail') {
        if (item.isCash) return '현금';
        const sub = item.classification?.subCategory || '주식';
        if (sub === '주식') {
          const isEtf = item.classification?.isEtf;
          const etfType = item.classification?.etfType || '지수추종';
          return isEtf ? `ETF (${etfType})` : '개별주식';
        }
        return sub;
      }
      return '';
    };

    const recurse = (
      currentItems: any[],
      levelIndex: number,
      path: string
    ): any[] => {
      if (levelIndex >= hierarchyLevels.length) {
        // Leaf level - sort assets
        return currentItems
          .map(item => ({
            key: path + '_' + (item.ticker || 'cash') + '_' + item.id,
            label: item.name,
            ticker: item.ticker,
            value: item.value,
            quantity: item.quantity,
            isCash: item.isCash,
            percentageOfParent: 100,
            percentageOfTotal: (item.value / totalValue) * 100,
            emoji: item.isCash ? '💵' : '🪙',
            type: 'asset',
            classification: item.classification,
          }))
          .sort((a, b) => b.value - a.value);
      }

      const field = hierarchyLevels[levelIndex];
      const grouped: { [key: string]: any[] } = {};

      currentItems.forEach(item => {
        const val = getFieldVal(item, field);
        if (!grouped[val]) {
          grouped[val] = [];
        }
        grouped[val].push(item);
      });

      const sumGroup = currentItems.reduce((s, i) => s + i.value, 0);

      return Object.entries(grouped)
        .map(([key, itemsInGroup]) => {
          const groupVal = itemsInGroup.reduce((s, i) => s + i.value, 0);
          const childPath = path + '_' + key;
          const children = recurse(itemsInGroup, levelIndex + 1, childPath);
          return {
            key: childPath,
            label: key,
            value: groupVal,
            percentageOfParent: sumGroup > 0 ? (groupVal / sumGroup) * 100 : 0,
            percentageOfTotal: totalValue > 0 ? (groupVal / totalValue) * 100 : 0,
            color: colorPalette[key] || 'bg-slate-400 text-slate-500',
            emoji: getEmoji(key),
            type: 'group',
            levelType: field,
            children: children,
          };
        })
        .sort((a, b) => b.value - a.value);
    };

    return recurse(hierarchyItems, 0, 'root');
  }, [hierarchyItems, hierarchyLevels, aggregateAssets.totalValue]);

  // 3. Find active drill down node based on drillPath
  const activeDrillNode = useMemo(() => {
    let currentNodes = hierarchyTree;
    let node: any = null;
    for (const label of drillPath) {
      const found = currentNodes.find((n: any) => n.label === label);
      if (found) {
        node = found;
        currentNodes = found.children || [];
      } else {
        break;
      }
    }
    return node;
  }, [hierarchyTree, drillPath]);

  // Handle classification edits (extended to support isEtf & etfType)
  const handleUpdateStockClassification = (
    stockId: string,
    field: 'country' | 'subCategory' | 'isEtf' | 'etfType',
    value: any
  ) => {
    setStocks(prev =>
      (prev || []).map(s => {
        if (s.id === stockId) {
          return {
            ...s,
            [field]: value,
          };
        }
        return s;
      })
    );
  };

  // Toggle all nodes expanded/collapsed
  const handleToggleExpandAll = (expand: boolean) => {
    if (!expand) {
      setExpandedNodes({ root: true });
    } else {
      const keys: { [key: string]: boolean } = { root: true };
      const collect = (nodes: any[]) => {
        nodes.forEach(n => {
          if (n.type === 'group') {
            keys[n.key] = true;
            if (n.children) collect(n.children);
          }
        });
      };
      collect(hierarchyTree);
      setExpandedNodes(keys);
    }
  };

  // Recursive tree node renderer
  const renderTreeNode = (node: any, depth: number): React.ReactNode => {
    const isGroup = node.type === 'group';
    const isExpanded = !!expandedNodes[node.key];

    if (isGroup) {
      return (
        <div key={node.key} className="border-b border-gray-100/60 dark:border-slate-800/20">
          <div
            onClick={() => {
              setExpandedNodes(prev => ({ ...prev, [node.key]: !isExpanded }));
            }}
            className="flex items-center justify-between p-3 hover:bg-gray-50/60 dark:hover:bg-slate-800/25 cursor-pointer select-none transition-colors"
            style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-[10px] text-light-secondary dark:text-dark-secondary transition-transform duration-200">
                {isExpanded ? '▼' : '▶'}
              </span>
              <span className="text-sm select-none">{node.emoji}</span>
              <span className="text-xs font-black text-light-text dark:text-dark-text truncate">{node.label}</span>
              <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold px-1.5 py-0.5 rounded-full">
                {node.percentageOfTotal.toFixed(1)}%
              </span>
            </div>
            
            {/* Visual indicator of relative weight inside parent */}
            <div className="hidden sm:block w-20 bg-gray-100 dark:bg-slate-800/60 h-1.5 rounded-full overflow-hidden mx-4">
              <div
                className={`h-full ${node.color ? node.color.split(' ')[0] : 'bg-light-primary'}`}
                style={{ width: `${node.percentageOfParent}%` }}
              ></div>
            </div>

            <div className="text-right flex items-center gap-2 pl-2">
              <span className="text-xs font-mono font-bold text-light-text dark:text-dark-text">
                {formatCurrency(node.value)}
              </span>
              <span className="text-[9px] text-indigo-500/80 dark:text-indigo-400 font-mono font-semibold">
                (상위의 {node.percentageOfParent.toFixed(0)}%)
              </span>
            </div>
          </div>

          {/* Children nodes */}
          {isExpanded && node.children && (
            <div className="bg-gray-50/20 dark:bg-slate-900/10">
              {node.children.map((child: any) => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    } else {
      // Leaf Asset Node
      return (
        <div
          key={node.key}
          className="flex items-center justify-between p-2.5 hover:bg-gray-50/40 dark:hover:bg-slate-800/10 border-b border-gray-50/50 dark:border-slate-800/10"
          style={{ paddingLeft: `${depth * 1.5 + 1.25}rem` }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs">{node.emoji}</span>
            <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-2">
              <p className="text-xs font-bold text-light-text dark:text-dark-text truncate">{node.label}</p>
              {node.ticker && (
                <span className="text-[9px] font-mono font-medium text-light-secondary dark:text-dark-secondary px-1 py-0.5 bg-gray-100 dark:bg-slate-800 rounded">
                  {node.ticker}
                </span>
              )}
            </div>
            {node.quantity !== undefined && !node.isCash && (
              <span className="hidden md:inline-block text-[9px] text-light-secondary dark:text-dark-secondary bg-slate-50 dark:bg-slate-900/30 px-1 py-0.5 rounded">
                수량: {node.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}주
              </span>
            )}
          </div>

          <div className="text-right">
            <span className="text-xs font-mono font-semibold text-light-text dark:text-dark-text">
              {formatCurrency(node.value)}
            </span>
            <span className="text-[9px] text-light-secondary dark:text-dark-secondary font-mono block sm:inline sm:ml-2">
              전체의 {node.percentageOfTotal.toFixed(1)}%
            </span>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Introduction */}
      <div className="px-2">
        <h1 className="text-2xl font-black tracking-tight text-light-text dark:text-dark-text">통합 비중분석</h1>
        <p className="text-sm text-light-secondary dark:text-dark-secondary mt-1">
          계좌 묶음 및 개별 계좌의 보유 자산을 기준으로 자산 안전성, 국가, 세부 자산군별 가중치를 정밀 분석합니다.
        </p>
      </div>

      {/* 1. Unified Control Dashboard (Account Scope + Hierarchy Preset) */}
      <div className="bg-light-card dark:bg-dark-card p-5 rounded-xl shadow-md border border-gray-100 dark:border-slate-800/80 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: Account scope selection (7 columns) */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div>
            <label className="block text-xs font-black text-light-secondary dark:text-dark-secondary uppercase tracking-wider mb-2.5">
              📂 분석 계좌 범위 선택
            </label>
            {/* Account group grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ACCOUNT_GROUPS.map(g => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupOrAccId(g.id)}
                  className={`px-3 py-2 text-xs font-bold rounded-lg text-center transition-all ${
                    selectedGroupOrAccId === g.id
                      ? 'bg-light-primary text-white shadow-sm'
                      : 'bg-light-bg dark:bg-dark-bg/60 text-light-secondary dark:text-dark-secondary hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="truncate">{g.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Divider & individual account selector */}
          <div className="mt-4 pt-3 border-t border-dashed border-gray-100 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-light-secondary dark:text-dark-secondary font-bold">개별 계좌 직접 선택:</span>
            <select
              value={selectedGroupOrAccId.startsWith('acc_') ? selectedGroupOrAccId : ''}
              onChange={(e) => {
                if (e.target.value) setSelectedGroupOrAccId(e.target.value);
              }}
              className="text-xs font-bold px-2.5 py-1.5 bg-light-bg dark:bg-dark-bg border border-gray-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-light-primary max-w-[200px]"
            >
              <option value="" disabled>개별 계좌 선택...</option>
              {accountDetails.map(acc => (
                <option key={acc.id} value={`acc_${acc.id}`}>
                  {acc.name} ({acc.brokerName})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right column: Hierarchy Preset Order (5 columns) */}
        <div className="lg:col-span-5 lg:border-l lg:border-gray-100 lg:dark:border-slate-800 lg:pl-6 flex flex-col justify-between">
          <div>
            <label className="block text-xs font-black text-light-secondary dark:text-dark-secondary uppercase tracking-wider mb-1.5">
              ⚙️ 계층 구조 탐색 설정 (Drilldown Perspective)
            </label>
            <p className="text-[10px] text-light-secondary dark:text-dark-secondary mb-3 leading-relaxed">
              원하는 탐색 프리셋을 클릭하여 안전성, 국가, 자산군을 다차원적으로 입체 분석합니다.
            </p>
            <div className="flex flex-col gap-1.5">
              {[
                {
                  id: 'standard',
                  levels: ['safety', 'country', 'detail'] as const,
                  label: '🛡️ 안전성 ➔ 🌐 국가 ➔ 📊 자산군',
                  description: '안전/비안전 자산별 국가 비중 및 자산군 분석'
                },
                {
                  id: 'country_first',
                  levels: ['country', 'safety', 'detail'] as const,
                  label: '🌐 국가 ➔ 🛡️ 안전성 ➔ 📊 자산군',
                  description: '한국/미국/기타 국가별 자산 안전성 및 자산군 분석'
                },
                {
                  id: 'detail_first',
                  levels: ['detail', 'country', 'safety'] as const,
                  label: '📊 자산군 ➔ 🌐 국가 ➔ 🛡️ 안전성',
                  description: '개별주식/ETF/채권 등 세부 자산군별 국가 및 안전성 분석'
                }
              ].map(p => {
                const isSelected = JSON.stringify(hierarchyLevels) === JSON.stringify(p.levels);
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setHierarchyLevels(p.levels as any);
                      setDrillPath([]); // reset drill path on preset changes
                    }}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all text-left border flex justify-between items-center ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-850 text-light-secondary dark:text-dark-secondary hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-light-text dark:hover:text-dark-text'
                    }`}
                    title={p.description}
                  >
                    <span>{p.label}</span>
                    {isSelected && (
                      <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.5 rounded font-mono font-bold">
                        ACTIVE
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* 2. Total Valuation Card (Full-width for balance) */}
      <Card className="p-5 bg-gradient-to-br from-indigo-50 to-indigo-100/30 dark:from-indigo-950/20 dark:to-indigo-900/10 border-indigo-100/50 dark:border-indigo-900/30">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">선택된 범위 자산 평가 총액</p>
            <h2 className="text-3xl font-black tracking-tight text-indigo-900 dark:text-indigo-100 mt-1">
              {formatCurrency(aggregateAssets.totalValue)}
            </h2>
          </div>
          <div className="text-right text-xs text-light-secondary dark:text-dark-secondary font-mono">
            <p>주식: {formatCurrency(aggregateAssets.totalValue - aggregateAssets.cashValue)}</p>
            <p className="mt-1">현금: {formatCurrency(aggregateAssets.cashValue)}</p>
          </div>
        </div>
      </Card>

      {/* 3. Visual Content Area (Hierarchy Mode Only) */}
      {aggregateAssets.totalValue <= 0 ? (
        <Card className="p-10 text-center">
          <p className="text-light-secondary dark:text-dark-secondary text-sm">보유 중인 자산 데이터가 없습니다.</p>
        </Card>
      ) : (
        <div className="space-y-6">

          {/* Side-by-Side Visualizers */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: 🔍 Drill-down Explorer */}
            <div className="xl:col-span-5 space-y-4">
              <Card className="p-5 border border-gray-100 dark:border-slate-800/80 shadow-md h-full flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-black text-light-text dark:text-dark-text flex items-center gap-1.5">
                      <span>🔍</span> 단계별 드릴다운 분석
                    </h3>
                    <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-full">
                      Level {drillPath.length + 1} / {hierarchyLevels.length}
                    </span>
                  </div>

                  {/* Breadcrumbs */}
                  <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-gray-100 dark:border-slate-800/80 mb-4">
                    <button
                      onClick={() => setDrillPath([])}
                      className={`text-[11px] px-2 py-1 rounded-md transition-all font-bold ${
                        drillPath.length === 0
                          ? 'bg-light-primary text-white shadow-sm'
                          : 'text-light-secondary dark:text-dark-secondary hover:bg-gray-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      🏠 전체
                    </button>
                    {drillPath.map((label, idx) => (
                      <React.Fragment key={idx}>
                        <span className="text-[10px] text-gray-300 dark:text-slate-600">➔</span>
                        <button
                          onClick={() => setDrillPath(drillPath.slice(0, idx + 1))}
                          className={`text-[11px] px-2 py-1 rounded-md transition-all font-bold ${
                            idx === drillPath.length - 1
                              ? 'bg-light-primary text-white shadow-sm'
                              : 'text-light-secondary dark:text-dark-secondary hover:bg-gray-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {label}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Dynamic description of current scope */}
                  <div className="mb-4">
                    <p className="text-[11px] text-light-secondary dark:text-dark-secondary">
                      현재 탐색 수준: <strong className="text-light-text dark:text-dark-text">
                        {drillPath.length === 0 ? '포트폴리오 대분류' : drillPath[drillPath.length - 1]}
                      </strong> (총액 대비 {((activeDrillNode ? activeDrillNode.value : aggregateAssets.totalValue) / aggregateAssets.totalValue * 100).toFixed(1)}%)
                    </p>
                  </div>

                  {/* Active segment bar chart */}
                  <div className="w-full h-8 bg-gray-100 dark:bg-slate-800 rounded-xl overflow-hidden flex shadow-inner mb-4">
                    {(activeDrillNode ? (activeDrillNode.children || []) : hierarchyTree).map((item: any) => {
                      const parentVal = activeDrillNode ? activeDrillNode.value : aggregateAssets.totalValue;
                      const percentageOfParent = parentVal > 0 ? (item.value / parentVal) * 100 : 0;
                      return (
                        <div
                          key={item.key}
                          onClick={() => {
                            if (item.type === 'group') {
                              setDrillPath([...drillPath, item.label]);
                            }
                          }}
                          className={`${item.color ? item.color.split(' ')[0] : 'bg-slate-400'} h-full transition-all duration-300 hover:brightness-95 cursor-pointer relative group flex items-center justify-center`}
                          style={{ width: `${percentageOfParent}%` }}
                          title={`${item.label}: 상위 중 ${percentageOfParent.toFixed(1)}% (전체 중 ${item.percentageOfTotal.toFixed(1)}%)`}
                        >
                          {percentageOfParent > 10 && (
                            <span className="text-[10px] font-black text-white px-1 truncate select-none">
                              {item.emoji} {percentageOfParent.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Subgroups Detailed list */}
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {(activeDrillNode ? (activeDrillNode.children || []) : hierarchyTree).map((item: any) => {
                      const parentVal = activeDrillNode ? activeDrillNode.value : aggregateAssets.totalValue;
                      const percentageOfParent = parentVal > 0 ? (item.value / parentVal) * 100 : 0;
                      const isAsset = item.type === 'asset';

                      return (
                        <div
                          key={item.key}
                          onClick={() => {
                            if (!isAsset) {
                              setDrillPath([...drillPath, item.label]);
                            }
                          }}
                          className={`p-3 rounded-xl border transition-all ${
                            isAsset 
                              ? 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800/40' 
                              : 'bg-white dark:bg-slate-900 hover:bg-gray-50/50 dark:hover:bg-slate-800/25 border-gray-200 dark:border-slate-800 cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-900/60'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-lg">{item.emoji}</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-black text-light-text dark:text-dark-text truncate">
                                  {item.label}
                                  {item.ticker && (
                                    <span className="ml-1.5 text-[9px] font-mono font-medium text-light-secondary dark:text-dark-secondary px-1 py-0.5 bg-gray-100 dark:bg-slate-800 rounded">
                                      {item.ticker}
                                    </span>
                                  )}
                                </p>
                                <p className="text-[10px] text-light-secondary dark:text-dark-secondary mt-0.5">
                                  {isAsset ? '개별 종목 자산' : `${item.children?.length || 0}개 하위 항목`}
                                </p>
                              </div>
                            </div>
                            
                            <div className="text-right pl-2">
                              <span className="text-xs font-mono font-black text-light-text dark:text-dark-text">
                                {formatCurrency(item.value)}
                              </span>
                              <div className="text-[9px] text-light-secondary dark:text-dark-secondary font-mono mt-0.5">
                                {drillPath.length > 0 && (
                                  <span>상위 중 <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{percentageOfParent.toFixed(1)}%</strong> | </span>
                                )}
                                <span>전체의 <strong>{item.percentageOfTotal.toFixed(1)}%</strong></span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Miniature visual progress bar */}
                          <div className="w-full bg-gray-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden mt-2">
                            <div
                              className={`h-full ${item.color ? item.color.split(' ')[0] : 'bg-indigo-500'}`}
                              style={{ width: `${percentageOfParent}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {drillPath.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-end">
                    <button
                      onClick={() => setDrillPath(drillPath.slice(0, -1))}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 text-light-secondary dark:text-dark-secondary hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-light-text dark:hover:text-dark-text transition-colors"
                    >
                      ◀ 한 단계 상위로
                    </button>
                  </div>
                )}
              </Card>
            </div>

            {/* Right Column: 🌲 Collapsible Tree Map */}
            <div className="xl:col-span-7">
              <Card className="p-5 border border-gray-100 dark:border-slate-800/80 shadow-md">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-sm font-black text-light-text dark:text-dark-text flex items-center gap-1.5">
                      <span>🌲</span> 폴더형 전체 자산 트리 구조
                    </h3>
                    <p className="text-[10px] text-light-secondary dark:text-dark-secondary mt-0.5">
                      각 단계를 클릭해 접거나 펼쳐서 비중 분포를 세밀히 분석해보세요.
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleToggleExpandAll(true)}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 text-light-secondary dark:text-dark-secondary hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-light-text dark:hover:text-dark-text transition-colors"
                    >
                      📂 전체 열기
                    </button>
                    <button
                      onClick={() => handleToggleExpandAll(false)}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 text-light-secondary dark:text-dark-secondary hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-light-text dark:hover:text-dark-text transition-colors"
                    >
                      📁 전체 닫기
                    </button>
                  </div>
                </div>

                {/* Tree render wrapper */}
                <div className="border border-gray-100 dark:border-slate-800/60 rounded-xl divide-y divide-gray-100 dark:divide-slate-800/60 overflow-hidden bg-white/40 dark:bg-slate-900/10">
                  {hierarchyTree.map((node: any) => renderTreeNode(node, 0))}
                </div>
              </Card>
            </div>

          </div>
        </div>
      )}

      {/* 6. Customizable Classifications Panel */}
      <Card className="p-0 overflow-hidden border border-gray-200 dark:border-slate-800">
        <div
          onClick={() => setIsEditorExpanded(p => !p)}
          className="p-4 cursor-pointer flex justify-between items-center hover:bg-gray-50 dark:hover:bg-slate-800/50"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">⚙️</span>
            <span className="font-black text-sm md:text-base text-light-text dark:text-dark-text">
              종목별 자산 분류 개별 설정 (국가, 세부 자산군, ETF 정보 변경)
            </span>
          </div>
          <span className="text-xs font-bold text-light-primary dark:text-dark-primary">
            {isEditorExpanded ? '접기 ▲' : '펼치기 ▼'}
          </span>
        </div>

        {isEditorExpanded && (
          <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/20 space-y-4">
            <p className="text-xs text-light-secondary dark:text-dark-secondary">
              등록되어 있는 종목들의 국가 분류와 자산 세부 구분, 개별주식/ETF 여부 및 ETF 상세타입(배당/지수추종/섹터추종)을 직접 설정할 수 있습니다. 변경 사항은 비중 분석 그래프에 실시간 적용됩니다.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 text-light-secondary dark:text-dark-secondary font-bold">
                    <th className="py-2 px-1">종목명/티커</th>
                    <th className="py-2 px-1">카테고리</th>
                    <th className="py-2 px-1">국가 분류</th>
                    <th className="py-2 px-1">세부 자산 구분</th>
                    <th className="py-2 px-1">유형</th>
                    <th className="py-2 px-1">ETF 세부구분</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/40">
                  {stocks.map(stock => {
                    const currentCls = getAssetClassification(stock);
                    const actualIsEtf = stock.isEtf !== undefined ? stock.isEtf : currentCls.isEtf;
                    return (
                      <tr key={stock.id} className="hover:bg-white/40 dark:hover:bg-slate-800/10">
                        <td className="py-3 px-1">
                          <p className="font-bold text-light-text dark:text-dark-text">{stock.name}</p>
                          <p className="text-[10px] font-mono text-light-secondary dark:text-dark-secondary">{stock.ticker}</p>
                        </td>
                        <td className="py-3 px-1 text-light-secondary dark:text-dark-secondary">
                          {stock.category}
                        </td>
                        <td className="py-3 px-1">
                          <select
                            value={stock.country || currentCls.country}
                            onChange={(e) => handleUpdateStockClassification(stock.id, 'country', e.target.value as any)}
                            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-1.5 py-1 rounded text-xs focus:outline-none focus:ring-1 focus:ring-light-primary"
                          >
                            <option value="한국">한국 🇰🇷</option>
                            <option value="미국">미국 🇺🇸</option>
                            <option value="기타">기타 🌐</option>
                          </select>
                        </td>
                        <td className="py-3 px-1">
                          <select
                            value={stock.subCategory || currentCls.subCategory}
                            onChange={(e) => handleUpdateStockClassification(stock.id, 'subCategory', e.target.value as any)}
                            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-1.5 py-1 rounded text-xs focus:outline-none focus:ring-1 focus:ring-light-primary"
                          >
                            <option value="주식">주식</option>
                            <option value="채권">채권</option>
                            <option value="현금">현금</option>
                            <option value="금">금(대체)</option>
                            <option value="머니마켓액티브">머니마켓액티브</option>
                          </select>
                        </td>
                        <td className="py-3 px-1">
                          <select
                            value={actualIsEtf ? 'etf' : 'stock'}
                            onChange={(e) => {
                              const nextIsEtf = e.target.value === 'etf';
                              handleUpdateStockClassification(stock.id, 'isEtf', nextIsEtf);
                              if (!nextIsEtf) {
                                handleUpdateStockClassification(stock.id, 'etfType', '없음');
                              } else {
                                handleUpdateStockClassification(stock.id, 'etfType', '지수추종');
                              }
                            }}
                            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-1.5 py-1 rounded text-xs focus:outline-none focus:ring-1 focus:ring-light-primary"
                          >
                            <option value="stock">개별주식</option>
                            <option value="etf">ETF</option>
                          </select>
                        </td>
                        <td className="py-3 px-1">
                          <select
                            disabled={!actualIsEtf}
                            value={stock.etfType || currentCls.etfType}
                            onChange={(e) => handleUpdateStockClassification(stock.id, 'etfType', e.target.value as any)}
                            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-1.5 py-1 rounded text-xs focus:outline-none focus:ring-1 focus:ring-light-primary disabled:opacity-40"
                          >
                            <option value="없음">없음</option>
                            <option value="배당">배당 💰</option>
                            <option value="지수추종">지수추종 📈</option>
                            <option value="섹터추종">섹터추종 🎯</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AssetAllocationScreen;
