import * as XLSX from 'xlsx';
import { Broker, Account, BankAccount, Stock, InitialPortfolio, Trade, TradeType, AccountTransaction, TransactionType, MonthlyAccountValue, HistoricalGain, AlertThresholds, InvestmentGoal, RetirementGoal, FeeSettings } from '../types';

/**
 * Helper to resolve stock metadata (country, strategy, subCategory, and portfolio subGroup)
 * ensuring full consistency across export sheets and UI groupings.
 */
export const resolveStockDetails = (stock: Stock) => {
  let cat = stock.category || '주식형';
  if (cat === '현금성자산' || cat === '현금성' || cat === '현금') cat = '현금성';
  else if (cat === '대체(금)' || cat === '대체' || cat === '금') cat = '대체(금)';
  else cat = '주식형';

  let country = stock.country;
  if (!country) {
    const ticker = stock.ticker || '';
    if (/^\d{6}$/.test(ticker)) country = '한국';
    else country = '미국';
  }

  let strategy = stock.stockStrategy;
  if (!strategy) {
    if (cat === '현금성') {
      strategy = '현금';
    } else if (cat === '대체(금)') {
      strategy = '금';
    } else {
      const name = stock.name || '';
      const etfType = stock.etfType || '';
      if (
        etfType === '지수추종' ||
        name.includes('S&P500') ||
        name.includes('나스닥') ||
        name.includes('200') ||
        name.includes('지수') ||
        name.includes('TR')
      ) {
        strategy = country === '미국' ? '지수추종' : '지수추종형';
      } else {
        strategy = '개별/섹터투자';
      }
    }
  }

  let subGroup = '주식형 - 기타';
  if (cat === '현금성') {
    subGroup = '현금성';
  } else if (cat === '대체(금)') {
    subGroup = '대체(금)';
  } else if (country === '한국') {
    subGroup = (strategy === '지수추종형' || strategy === '지수추종')
      ? '주식형 - 한국 (지수추종형)'
      : '주식형 - 한국 (개별/섹터투자)';
  } else if (country === '미국') {
    subGroup = (strategy === '지수추종' || strategy === '지수추종형')
      ? '주식형 - 미국 (지수추종)'
      : '주식형 - 미국 (개별/섹터투자)';
  }

  return {
    country,
    category: cat,
    strategy,
    subCategory: stock.subCategory || '',
    subGroup,
  };
};

/**
 * Takes an array of sheet objects, converts them to an Excel file with multiple sheets, and triggers a download.
 * @param sheets An array of objects, where each object has a 'name' for the sheet and 'data' for the content.
 * @param fileName The desired file name (without extension).
 */
export const exportToExcel = (sheets: { name: string, data: any[] }[], fileName: string): void => {
  try {
    const findValidXlsxLibrary = (mod: any): any | null => {
      const isValid = (lib: any) =>
        lib &&
        typeof lib.utils?.book_new === 'function' &&
        typeof lib.writeFile === 'function';

      if (isValid(mod)) return mod;
      
      const queue = [mod];
      const visited = new Set();

      while (queue.length > 0) {
        const current = queue.shift();

        if (!current || typeof current !== 'object' || visited.has(current)) {
          continue;
        }
        visited.add(current);
        
        if (isValid(current)) {
          return current;
        }

        for (const key in current) {
          if (Object.prototype.hasOwnProperty.call(current, key)) {
            queue.push(current[key]);
          }
        }
      }
      
      if (isValid((window as any).XLSX)) {
        return (window as any).XLSX;
      }

      return null;
    };

    const xlsxLib = findValidXlsxLibrary(XLSX);

    if (!xlsxLib) {
      console.error("Could not find a valid xlsx library object.", { importedModule: XLSX });
      throw new Error("SheetJS (xlsx) library not loaded correctly.");
    }

    const wb = xlsxLib.utils.book_new();

    sheets.forEach(sheet => {
      const ws = xlsxLib.utils.json_to_sheet(sheet.data);
      xlsxLib.utils.book_append_sheet(wb, ws, sheet.name);
    });

    if (wb.SheetNames.length > 0) {
      xlsxLib.writeFile(wb, `${fileName}.xlsx`);
    } else {
      console.warn("No data was provided to export, so no file was generated.");
      alert("내보낼 데이터가 없습니다.");
    }
  } catch (error) {
    console.error("Failed to export data to Excel:", error);
    alert("엑셀 파일로 내보내는 중 오류가 발생했습니다.");
  }
};

export const exportAllData = (
  brokers: Broker[],
  accounts: Account[],
  bankAccounts: BankAccount[],
  stocks: Stock[],
  initialPortfolio: InitialPortfolio,
  trades: Trade[],
  transactions: AccountTransaction[],
  monthlyValues: MonthlyAccountValue[],
  historicalGains: HistoricalGain[],
  alertThresholds: AlertThresholds,
  backgroundFetchInterval: number,
  showSummary: boolean,
  investmentGoals: InvestmentGoal[],
  fileName: string,
  retirementGoal?: RetirementGoal | null,
  feeSettings?: FeeSettings,
  homeScreenPreference?: string
) => {
    const sheets: { name: string, data: any[] }[] = [];
    const brokerMap = new Map((brokers || []).map(b => [b.id, b.name]));
    const accountMap = new Map((accounts || []).map(a => [a.id, a.name]));
    const goalMap = new Map((investmentGoals || []).map(g => [g.id, g.name]));
    const stockMap = new Map<string, Stock>((stocks || []).map(s => [s.id, s]));
    const portfolioStocks = (stocks || []).filter(s => s.isPortfolio);
    
    sheets.push({ name: '투자 목표', data: (investmentGoals || []).map(g => ({ 
      '목표명': g.name, 
      '생성일': g.creationDate,
      '목표달성일': g.targetDate || '',
      '목표유형': g.goalType === 'shares' ? '수량' : '금액',
      '목표금액': g.goalType === 'amount' ? g.targetAmount : '' 
    })) });
    
    const goalSharesData: { '목표명': string; '종목명': string; '티커': string; '목표수량': number }[] = [];
    (investmentGoals || []).forEach(g => {
      if (g.goalType === 'shares' && g.targetShares) {
        Object.entries(g.targetShares).forEach(([stockId, shares]) => {
          const stock = stockMap.get(stockId);
          if (stock) {
            goalSharesData.push({ '목표명': g.name, '종목명': stock.name, '티커': stock.ticker, '목표수량': shares });
          }
        });
      }
    });
    if (goalSharesData.length > 0) {
      sheets.push({ name: '목표-종목수량', data: goalSharesData });
    }

    sheets.push({ name: '증권사', data: (brokers || []).map(b => ({ '증권사명': b.name })) });
    sheets.push({ 
      name: '증권계좌', 
      data: (accounts || []).map((a, idx) => ({ 
        '계좌명': a.name, 
        '증권사': brokerMap.get(a.brokerId) || 'N/A',
        '계좌유형': a.accountType || '일반',
        '비과세/절세여부': a.isTaxFree ? '예' : '아니오',
        '표시순서': a.order !== undefined ? a.order : (idx + 1)
      })) 
    });
    sheets.push({ name: '은행계좌', data: (bankAccounts || []).map(b => ({ '은행명': b.bankName, '계좌별명': b.name })) });
    
    sheets.push({ 
      name: '종목', 
      data: (stocks || []).map(s => {
        const details = resolveStockDetails(s);
        return {
          '종목명': s.name, 
          '티커': s.ticker, 
          '국가': details.country,
          '대분류': details.category,
          '투자구분': details.strategy,
          '세부구분': details.subCategory,
          '포트폴리오 그룹': details.subGroup,
          '포트폴리오 포함': s.isPortfolio ? '예' : '아니오',
          'ETF 여부': s.isEtf ? '예' : '아니오',
          'ETF 유형': s.etfType || '',
          '실부담비용률 (%)': s.isEtf ? (s.expenseRatio ?? '') : ''
        };
      }) 
    });

    sheets.push({ 
      name: '포트폴리오', 
      data: portfolioStocks.map(s => {
        const details = resolveStockDetails(s);
        return {
          '종목명': s.name, 
          '티커': s.ticker, 
          '국가': details.country,
          '대분류': details.category,
          '투자구분': details.strategy,
          '세부구분': details.subCategory,
          '포트폴리오 그룹': details.subGroup,
          '목표 비중 (%)': initialPortfolio[s.id] || 0 
        };
      }) 
    });
    
    sheets.push({
        name: '매매기록',
        data: (trades || []).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(trade => {
            const stock = stockMap.get(trade.stockId);
            const account = accountMap.get(trade.accountId);
            const quantity = Number(trade.quantity) || 0;
            const price = Number(trade.price) || 0;
            return { 
              '일자': trade.date, 
              '계좌': account || 'N/A', 
              '종목명': stock?.name || 'N/A', 
              '티커': stock?.ticker || 'N/A', 
              '구분': trade.tradeType === TradeType.Buy ? '매수' : '매도', 
              '수량': quantity, 
              '단가': price, 
              '금액': quantity * price, 
              '매매방법': trade.tradeMethod || '직접매매', 
              '수수료/제세금': trade.customFeeAndTax !== undefined ? trade.customFeeAndTax : '',
              '목표': trade.goalId ? goalMap.get(trade.goalId) : '' 
            };
        })
    });
    
    const allAccountsMap = new Map<string, string>();
    (accounts || []).forEach(a => allAccountsMap.set(a.id, a.name));
    (bankAccounts || []).forEach(b => allAccountsMap.set(b.id, `${b.bankName} ${b.name}`));
    
    const regularTransactions = (transactions || []).filter(t => t.transactionType !== TransactionType.Dividend && t.transactionType !== TransactionType.Interest);
    const dividendTransactions = (transactions || []).filter(t => t.transactionType === TransactionType.Dividend);
    const interestTransactions = (transactions || []).filter(t => t.transactionType === TransactionType.Interest);
    
    sheets.push({
        name: '입출금기록',
        data: regularTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => ({
            '일자': tx.date,
            '계좌': allAccountsMap.get(tx.accountId) || 'N/A',
            '구분': tx.transactionType === TransactionType.Deposit ? '입금' : '출금',
            '금액': tx.amount,
            '상대계좌': tx.counterpartyAccountId ? allAccountsMap.get(tx.counterpartyAccountId) : '외부',
            '메모': tx.memo || '',
            '목표': tx.goalId ? goalMap.get(tx.goalId) : ''
        }))
    });

    sheets.push({
        name: '배당금기록',
        data: dividendTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => {
            const stock = tx.stockId ? stockMap.get(tx.stockId) : null;
            return {
                '일자': tx.date,
                '계좌': allAccountsMap.get(tx.accountId) || 'N/A',
                '종목명': stock?.name || 'N/A',
                '티커': stock?.ticker || 'N/A',
                '금액': tx.amount,
            };
        })
    });

    sheets.push({
        name: '이용료기록',
        data: interestTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => ({
            '일자': tx.date,
            '계좌': allAccountsMap.get(tx.accountId) || 'N/A',
            '금액': tx.amount,
        }))
    });

    sheets.push({
        name: '월말결산',
        data: (monthlyValues || []).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(mv => ({
            '기준일': mv.date,
            '계좌총액': mv.totalValue,
        }))
    });

    sheets.push({
        name: '초기손익기록',
        data: (historicalGains || []).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(hg => ({
            '일자': hg.date,
            '계좌명': accountMap.get(hg.accountId) || 'N/A',
            '종목명': hg.stockName,
            '실현손익': hg.realizedPnl,
            '메모': hg.note || ''
        }))
    });

    const alertSettingsData: {
      '구분': string;
      'ID'?: string;
      'ID(티커)'?: string;
      '주의 기준 (%)': number | string;
      '경고 기준 (%)': number | string;
    }[] = [
        { '구분': '전체', 'ID': 'global', '주의 기준 (%)': alertThresholds.global.caution, '경고 기준 (%)': alertThresholds.global.warning }
    ];
    for (const stockId in (alertThresholds.stocks || {})) {
        const stock = stockMap.get(stockId);
        if (stock) {
            alertSettingsData.push({
                '구분': '개별 종목',
                'ID(티커)': stock.ticker,
                '주의 기준 (%)': alertThresholds.stocks[stockId]?.caution ?? '',
                '경고 기준 (%)': alertThresholds.stocks[stockId]?.warning ?? ''
            });
        }
    }
    sheets.push({ name: '리밸런싱알림설정', data: alertSettingsData });

    if (retirementGoal) {
      sheets.push({
        name: '은퇴목표',
        data: [{
          '목표금액': retirementGoal.targetAmount,
          '목표연도': retirementGoal.targetYear,
          '목표월': retirementGoal.targetMonth || 1,
          '기준연도': retirementGoal.currentYear,
          '초기자산': retirementGoal.initialAssets ?? '',
          '필요수익률': retirementGoal.initialRequiredCagr ?? ''
        }]
      });
      if (retirementGoal.intermediateExpenses && retirementGoal.intermediateExpenses.length > 0) {
        sheets.push({
          name: '은퇴중간지출',
          data: retirementGoal.intermediateExpenses.map(exp => ({
            '항목명': exp.name,
            '발생연도': exp.year,
            '금액': exp.amount,
            '반복여부': exp.isRecurring ? '예' : '아니오'
          }))
        });
      }
    }

    const appSettingsData: { '설정명': string; '설정값': string }[] = [
        { '설정명': '백그라운드 조회 주기 (분)', '설정값': String(backgroundFetchInterval) },
        { '설정명': '홈 화면 요약 정보 표시', '설정값': showSummary ? '예' : '아니오' }
    ];

    if (homeScreenPreference) {
      const screenNameMap: Record<string, string> = {
        'HOME': '투자 현황',
        'HOLDINGS_STATUS': '포트폴리오 가꾸기',
        'GOAL_INVESTING': '목표 달성'
      };
      appSettingsData.push({ '설정명': '기본 홈 화면', '설정값': screenNameMap[homeScreenPreference] || homeScreenPreference });
    }

    if (feeSettings) {
      appSettingsData.push({
        '설정명': '동일 일자 매매 처리 방식',
        '설정값': feeSettings.sameDayTradeOrder === 'buyFirst' ? '매수 우선' : feeSettings.sameDayTradeOrder === 'inputOrder' ? '입력 순서' : '매도 우선'
      });
      if (feeSettings.buyFeeRate !== undefined) {
        appSettingsData.push({ '설정명': '매수 수수료율 (%)', '설정값': String((feeSettings.buyFeeRate * 100).toFixed(4)) });
      }
      if (feeSettings.sellFeeRate !== undefined) {
        appSettingsData.push({ '설정명': '매도 수수료율 (%)', '설정값': String((feeSettings.sellFeeRate * 100).toFixed(4)) });
      }
      if (feeSettings.stockTaxRate !== undefined) {
        appSettingsData.push({ '설정명': '주식 제세금 (%)', '설정값': String(feeSettings.stockTaxRate) });
      }
      if (feeSettings.etfTaxRate !== undefined) {
        appSettingsData.push({ '설정명': 'ETF 매매세율 (%)', '설정값': String(feeSettings.etfTaxRate) });
      }
      if (feeSettings.etfDividendTaxRate !== undefined) {
        appSettingsData.push({ '설정명': '배당소득세율 (%)', '설정값': String(feeSettings.etfDividendTaxRate) });
      }
    }

    sheets.push({ name: '앱설정', data: appSettingsData });

    exportToExcel(sheets, fileName);
};