import { Trade, Stock, Account, FeeSettings, TradeType, AccountTransaction, TransactionType, HistoricalGain } from '../types';

/**
 * 수수료/세금 면제 대상 계좌인지 검사하는 헬퍼
 */
export function isTaxFreeAccount(account: Account | undefined): boolean {
  if (!account) return false;
  if (account.isTaxFree) return true;
  
  // 계좌 종류에 따른 매칭
  if (account.accountType && ['연금저축', 'IRP', 'ISA', '퇴직DC'].includes(account.accountType)) {
    return true;
  }

  // 계좌명 기반 검사 (연금, IRP, ISA, DC, 퇴직 등의 키워드 수동 감지)
  const name = account.name || '';
  return name.includes('연금') || 
         name.includes('IRP') || 
         name.includes('ISA') || 
         name.includes('DC') || 
         name.includes('퇴직');
}

/**
 * 매수/매도 거래 시 발생하는 수수료 및 거래세 계산
 */
export function calculateTradeFeeAndTax(
  trade: Pick<Trade, 'tradeType' | 'quantity' | 'price' | 'customFeeAndTax'>,
  stock: Stock | undefined,
  account: Account | undefined,
  feeSettings: FeeSettings
) {
  const quantity = Number(trade.quantity) || 0;
  const price = Number(trade.price) || 0;
  const amount = quantity * price;

  // 사용자가 수동으로 매매비용(수수료+제세금)을 기입한 경우
  if (trade.customFeeAndTax !== undefined && trade.customFeeAndTax !== null) {
    const customVal = Number(trade.customFeeAndTax) || 0;
    if (trade.tradeType === TradeType.Buy) {
      return {
        fee: customVal,
        tax: 0,
        total: amount + customVal,
      };
    } else {
      return {
        fee: customVal,
        tax: 0,
        total: amount - customVal,
      };
    }
  }

  // 면제 대상 계좌인 경우 수수료 및 거래세 모두 0
  if (isTaxFreeAccount(account)) {
    return {
      fee: 0,
      tax: 0,
      total: amount,
    };
  }

  const isEtf = stock?.isEtf || false;

  if (trade.tradeType === TradeType.Buy) {
    // 매수 수수료
    const fee = amount * (feeSettings.buyFeeRate / 100);
    return {
      fee,
      tax: 0,
      total: amount + fee,
    };
  } else {
    // 매도 수수료 & 거래세
    const fee = amount * (feeSettings.sellFeeRate / 100);
    const taxRate = isEtf ? feeSettings.etfTaxRate : feeSettings.stockTaxRate;
    const tax = amount * (taxRate / 100);
    return {
      fee,
      tax,
      total: amount - fee - tax,
    };
  }
}

/**
 * 배당금 수령 시 발생하는 배당소득세 계산
 */
export function calculateDividendTax(
  amount: number,
  stock: Stock | undefined,
  account: Account | undefined,
  feeSettings: FeeSettings
) {
  const rawAmount = Number(amount) || 0;

  // 면제 대상 계좌 (연금저축/IRP/ISA/퇴직DC) 면제 처리
  if (isTaxFreeAccount(account)) {
    return {
      tax: 0,
      netAmount: rawAmount,
    };
  }

  const isEtf = stock?.isEtf || false;
  const taxRate = isEtf ? feeSettings.etfDividendTaxRate : feeSettings.stockDividendTaxRate;
  const tax = rawAmount * (taxRate / 100);

  return {
    tax,
    netAmount: rawAmount - tax,
  };
}

/**
 * 계좌별 현금 예수금 정확한 계산 (매수비용 차감, 매도수령액 가산, 입출금/배당/이자, 과거확정손익 반영)
 */
export function calculateAccountCashBalance(
  account: Account,
  trades: Trade[],
  transactions: AccountTransaction[],
  historicalGains: HistoricalGain[] = [],
  feeSettings?: FeeSettings,
  stockMap?: Map<string, Stock>
): number {
  const accountTrades = (trades || []).filter(t => t.accountId === account.id);

  const totalBuyCost = accountTrades
    .filter(t => t.tradeType === TradeType.Buy)
    .reduce((sum, t) => {
      const stock = stockMap ? stockMap.get(t.stockId) : undefined;
      const feeCalc = feeSettings
        ? calculateTradeFeeAndTax(t, stock, account, feeSettings)
        : { total: (Number(t.price) || 0) * (Number(t.quantity) || 0) };
      return sum + feeCalc.total;
    }, 0);

  const totalSellProceeds = accountTrades
    .filter(t => t.tradeType === TradeType.Sell)
    .reduce((sum, t) => {
      const stock = stockMap ? stockMap.get(t.stockId) : undefined;
      const feeCalc = feeSettings
        ? calculateTradeFeeAndTax(t, stock, account, feeSettings)
        : { total: (Number(t.price) || 0) * (Number(t.quantity) || 0) };
      return sum + feeCalc.total;
    }, 0);

  let netCashFromTransactions = 0;
  (transactions || []).forEach(t => {
    const amount = Number(t.amount) || 0;
    if (
      (t.accountId === account.id &&
        (t.transactionType === TransactionType.Deposit ||
          t.transactionType === TransactionType.Dividend ||
          t.transactionType === TransactionType.Interest)) ||
      (t.counterpartyAccountId === account.id && t.transactionType === TransactionType.Withdrawal)
    ) {
      netCashFromTransactions += amount;
    } else if (
      (t.accountId === account.id && t.transactionType === TransactionType.Withdrawal) ||
      (t.counterpartyAccountId === account.id && t.transactionType === TransactionType.Deposit)
    ) {
      netCashFromTransactions -= amount;
    }
  });

  const historicalPnlForAccount = (historicalGains || [])
    .filter(g => g.accountId === account.id)
    .reduce((sum, g) => sum + (Number(g.realizedPnl) || 0), 0);

  return netCashFromTransactions + totalSellProceeds - totalBuyCost + historicalPnlForAccount;
}

/**
 * 매매 기록을 날짜순 및 동일 일자 매매 처리 방식에 맞추어 지능적으로 정렬하는 함수.
 * '선매도 후매수'를 선택한 경우라도, 당일 이전 보유 수량(Prior Holding)이 0이거나
 * 매도량에 미달하는 경우(공매도 불가능한 정상 계좌) 당일 매수분을 먼저 처리하여
 * '당일 1주 매수 후 1주 매도 시 잔고가 여전히 1주로 남는 오류'를 완벽히 차단합니다.
 */
export function sortTradesForProcessing(
  trades: Trade[],
  orderPreference: 'buyFirst' | 'sellFirst' | 'inputOrder' = 'buyFirst'
): Trade[] {
  if (!trades || trades.length <= 1) return trades ? [...trades] : [];

  // 1. 날짜별 그룹화 (YYYY-MM-DD 기준)
  const dateMap = new Map<string, Trade[]>();
  trades.forEach(t => {
    if (!t) return;
    const dStr = (t.date ? String(t.date).split('T')[0] : '').trim();
    if (!dateMap.has(dStr)) {
      dateMap.set(dStr, []);
    }
    dateMap.get(dStr)!.push(t);
  });

  // 날짜 오름차순 정렬
  const sortedDates = Array.from(dateMap.keys()).sort((a, b) => {
    const timeA = new Date(a).getTime();
    const timeB = new Date(b).getTime();
    if (isNaN(timeA) || isNaN(timeB)) return a.localeCompare(b);
    return timeA - timeB;
  });

  // 누적 보유 수량 추적 (key: `${accountId || 'global'}_${stockId}`)
  const cumulativeHoldings = new Map<string, number>();
  const finalSortedTrades: Trade[] = [];

  for (const dStr of sortedDates) {
    const dayTrades = dateMap.get(dStr)!;

    // 계좌 및 종목별로 그룹 분리
    const subGroups = new Map<string, Trade[]>();
    dayTrades.forEach(t => {
      const key = `${t.accountId || 'global'}_${t.stockId || ''}`;
      if (!subGroups.has(key)) subGroups.set(key, []);
      subGroups.get(key)!.push(t);
    });

    for (const [key, groupTrades] of subGroups.entries()) {
      const priorQty = cumulativeHoldings.get(key) || 0;
      const buys = groupTrades.filter(t => t.tradeType === TradeType.Buy);
      const sells = groupTrades.filter(t => t.tradeType === TradeType.Sell);

      let sortedGroup: Trade[] = [];

      if (buys.length === 0 || sells.length === 0) {
        // 매수만 있거나 매도만 있는 경우 ID순 정렬
        sortedGroup = groupTrades.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
      } else if (orderPreference === 'buyFirst') {
        // 선매수 후매도: 당일 매수 전량 선반영 후 매도 반영
        sortedGroup = [
          ...buys.sort((a, b) => (a.id || '').localeCompare(b.id || '')),
          ...sells.sort((a, b) => (a.id || '').localeCompare(b.id || ''))
        ];
      } else if (orderPreference === 'sellFirst') {
        // 선매도 후매수:
        // 단, 당일 거래 이전 보유량이 0주 이하이면 없는 주식을 팔 수 없으므로(당일 단타)
        // 무조건 당일 매수가 먼저 실행되어야 음수 클램핑 오류가 생기지 않음
        if (priorQty <= 1e-9) {
          sortedGroup = [
            ...buys.sort((a, b) => (a.id || '').localeCompare(b.id || '')),
            ...sells.sort((a, b) => (a.id || '').localeCompare(b.id || ''))
          ];
        } else {
          // 기존 보유분이 있는 경우: 기존 보유 수량 범위 내 매도는 먼저 실행하고, 초과 매도는 매수 뒤로 배치
          let coveredSellQty = 0;
          const earlySells: Trade[] = [];
          const lateSells: Trade[] = [];

          sells.forEach(s => {
            const sQty = Number(s.quantity) || 0;
            if (coveredSellQty + sQty <= priorQty + 1e-9) {
              earlySells.push(s);
              coveredSellQty += sQty;
            } else {
              lateSells.push(s);
            }
          });

          sortedGroup = [
            ...earlySells.sort((a, b) => (a.id || '').localeCompare(b.id || '')),
            ...buys.sort((a, b) => (a.id || '').localeCompare(b.id || '')),
            ...lateSells.sort((a, b) => (a.id || '').localeCompare(b.id || ''))
          ];
        }
      } else {
        // 'inputOrder' (입력 순서):
        // 입력 순서대로 처리하되, 사전 잔고가 0인데 매도가 먼저 오면 잔고 왜곡이 생기므로 매수 우선 보호
        if (priorQty <= 1e-9) {
          sortedGroup = [
            ...buys.sort((a, b) => (a.id || '').localeCompare(b.id || '')),
            ...sells.sort((a, b) => (a.id || '').localeCompare(b.id || ''))
          ];
        } else {
          sortedGroup = groupTrades.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
        }
      }

      // 누적 수량 업데이트 및 최종 결과에 추가
      let updatedQty = priorQty;
      sortedGroup.forEach(t => {
        const q = Number(t.quantity) || 0;
        if (t.tradeType === TradeType.Buy) {
          updatedQty += q;
        } else {
          updatedQty -= q;
          if (updatedQty < 1e-9) updatedQty = 0;
        }
        finalSortedTrades.push(t);
      });
      cumulativeHoldings.set(key, updatedQty);
    }
  }

  return finalSortedTrades;
}
