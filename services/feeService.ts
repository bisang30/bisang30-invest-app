import { Trade, Stock, Account, FeeSettings, TradeType } from '../types';

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
  trade: Pick<Trade, 'tradeType' | 'quantity' | 'price'>,
  stock: Stock | undefined,
  account: Account | undefined,
  feeSettings: FeeSettings
) {
  const quantity = Number(trade.quantity) || 0;
  const price = Number(trade.price) || 0;
  const amount = quantity * price;

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
