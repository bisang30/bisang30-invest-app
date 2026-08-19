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
