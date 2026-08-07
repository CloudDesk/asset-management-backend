export interface RefundWalletSource {
  amount: number;
  expiresAt: number | null;
}

export interface ReturnRefundWalletSource extends RefundWalletSource {
  reservationId: number;
  creditId?: number;
  couponCode?: string | null;
  couponName?: string | null;
  reservationStatus?: string;
  availableAmount?: number;
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function isRefundWalletSourceExpired(expiresAt: number | null, currentEpochSeconds: number) {
  return expiresAt !== null && expiresAt < currentEpochSeconds;
}

export function calculateCancellationRefundBreakdown(
  onlineAmountInput: number,
  walletSources: RefundWalletSource[],
  currentEpochSeconds: number,
) {
  const onlineAmount = money(Math.max(Number(onlineAmountInput || 0), 0));
  const originalWalletAmount = money(walletSources.reduce((sum, source) => sum + Number(source.amount || 0), 0));
  const eligibleWalletAmount = money(walletSources
    .filter((source) => !isRefundWalletSourceExpired(source.expiresAt, currentEpochSeconds))
    .reduce((sum, source) => sum + Number(source.amount || 0), 0));
  const expiredWalletAmount = money(originalWalletAmount - eligibleWalletAmount);
  return {
    approvedAmount: money(onlineAmount + originalWalletAmount),
    originalWalletAmount,
    eligibleWalletAmount,
    expiredWalletAmount,
    onlineAmount,
    customerReceivesAmount: money(onlineAmount + eligibleWalletAmount),
  };
}

export function calculateReturnRefundBreakdown(
  approvedAmountInput: number,
  onlineAvailableInput: number,
  walletSources: ReturnRefundWalletSource[],
  currentEpochSeconds: number,
) {
  const onlineAvailable = money(Math.max(Number(onlineAvailableInput || 0), 0));
  const availableSources = walletSources.map((source) => ({
    ...source,
    availableAmount: money(Math.max(Number(source.availableAmount ?? source.amount ?? 0), 0)),
  }));
  const walletAvailable = money(availableSources.reduce((sum, source) => sum + source.availableAmount, 0));
  const totalAvailable = money(onlineAvailable + walletAvailable);
  const approvedAmount = money(Math.min(Math.max(Number(approvedAmountInput || 0), 0), totalAvailable));

  if (approvedAmount <= 0 || totalAvailable <= 0) {
    return {
      approvedAmount: 0,
      originalWalletAmount: 0,
      eligibleWalletAmount: 0,
      expiredWalletAmount: 0,
      onlineAmount: 0,
      customerReceivesAmount: 0,
      walletAllocations: [] as Array<ReturnRefundWalletSource & { allocatedAmount: number; expired: boolean }>,
    };
  }

  const walletAmount = money(Math.min(walletAvailable, approvedAmount * (walletAvailable / totalAvailable)));
  const onlineAmount = money(Math.min(onlineAvailable, approvedAmount - walletAmount));
  const adjustedWalletAmount = money(approvedAmount - onlineAmount);
  let allocatedWallet = 0;
  const positiveSources = availableSources.filter((source) => source.availableAmount > 0);
  const walletAllocations = positiveSources.map((source, index) => {
    const remaining = money(adjustedWalletAmount - allocatedWallet);
    const allocatedAmount = index === positiveSources.length - 1
      ? Math.min(source.availableAmount, remaining)
      : Math.min(source.availableAmount, money(adjustedWalletAmount * (source.availableAmount / walletAvailable)));
    allocatedWallet = money(allocatedWallet + allocatedAmount);
    return {
      ...source,
      allocatedAmount,
      expired: isRefundWalletSourceExpired(source.expiresAt, currentEpochSeconds),
    };
  }).filter((source) => source.allocatedAmount > 0);

  const originalWalletAmount = money(walletAllocations.reduce((sum, source) => sum + source.allocatedAmount, 0));
  const eligibleWalletAmount = money(walletAllocations
    .filter((source) => !source.expired)
    .reduce((sum, source) => sum + source.allocatedAmount, 0));
  const expiredWalletAmount = money(originalWalletAmount - eligibleWalletAmount);

  return {
    approvedAmount,
    originalWalletAmount,
    eligibleWalletAmount,
    expiredWalletAmount,
    onlineAmount,
    customerReceivesAmount: money(eligibleWalletAmount + onlineAmount),
    walletAllocations,
  };
}
