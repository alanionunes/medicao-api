export function parseDecimal(value: string): number {
  return Number.parseFloat(value);
}

export function formatMoney(value: number): string {
  return value.toFixed(2);
}

export function formatQuantity(value: number): string {
  return value.toFixed(3);
}

export function lineAmount(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}
