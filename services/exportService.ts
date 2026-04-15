import * as XLSX from 'xlsx';
import { Broker, Account, BankAccount, Stock, InitialPortfolio, Trade, TradeType, AccountTransaction, TransactionType, MonthlyAccountValue, HistoricalGain, AlertThresholds, InvestmentGoal } from '../types';


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
  fileName: string
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
    sheets.push({ name: '증권계좌', data: (accounts || []).map(a => ({ '계좌명': a.name, '증권사': brokerMap.get(a.brokerId) || 'N/A' })) });
    sheets.push({ name: '은행계좌', data: (bankAccounts || []).map(b => ({ '은행명': b.bankName, '계좌별명': b.name })) });
    sheets.push({ name: '종목', data: (stocks || []).map(s => ({ 
        '종목명': s.name, 
        '티커': s.ticker, 
        '카테고리': s.category, 
        '포트폴리오 포함': s.isPortfolio ? '예' : '아니오',
        'ETF 여부': s.isEtf ? '예' : '아니오',
        '실부담비용률 (%)': s.isEtf ? s.expenseRatio : ''
    })) });
    sheets.push({ name: '포트폴리오', data: portfolioStocks.map(s => ({ '종목명': s.name, '티커': s.ticker, '카테고리': s.category, '목표 비중 (%)': initialPortfolio[s.id] || 0 })) });
    
    sheets.push({
        name: '매매기록',
        data: (trades || []).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(trade => {
            const stock = stockMap.get(trade.stockId);
            const account = accountMap.get(trade.accountId);
            const quantity = Number(trade.quantity) || 0;
            const price = Number(trade.price) || 0;
            return { '일자': trade.date, '계좌': account || 'N/A', '종목명': stock?.name || 'N/A', '티커': stock?.ticker || 'N/A', '구분': trade.tradeType === TradeType.Buy ? '매수' : '매도', '수량': quantity, '단가': price, '금액': quantity * price, '매매방법': trade.tradeMethod, '목표': trade.goalId ? goalMap.get(trade.goalId) : '' };
        })
    });
    
    const allAccountsMap = new Map<string, string>();
    (accounts || []).forEach(a => allAccountsMap.set(a.id, a.name));
    (bankAccounts || []).forEach(b => allAccountsMap.set(b.id, `${b.bankName} ${b.name}`));
    
    const regularTransactions = (transactions || []).filter(t => t.transactionType !== TransactionType.Dividend);
    const dividendTransactions = (transactions || []).filter(t => t.transactionType === TransactionType.Dividend);
    
    sheets.push({
        name: '입출금기록',
        data: regularTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => ({
            '일자': tx.date,
            '계좌': allAccountsMap.get(tx.accountId) || 'N/A',
            '구분': tx.transactionType === TransactionType.Deposit ? '입금' : '출금',
            '금액': tx.amount,
            '상대계좌': tx.counterpartyAccountId ? allAccountsMap.get(tx.counterpartyAccountId) : '외부',
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

    sheets.push({ name: '앱설정', data: [
        { '설정명': '백그라운드 조회 주기 (분)', '설정값': String(backgroundFetchInterval) },
        { '설정명': '홈 화면 요약 정보 표시', '설정값': showSummary ? '예' : '아니오' }
    ]});

    exportToExcel(sheets, fileName);
};