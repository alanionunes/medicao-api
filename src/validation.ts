import { invalid } from "./http.ts";
import { parseDecimal } from "./money.ts";

const QUANTITY = /^\d{1,9}(\.\d{1,3})?$/;
const PRICE = /^\d{1,9}(\.\d{1,2})?$/;
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalid(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw invalid(`${field} must be a non-empty array`);
  }
  return value;
}

export function requireString(obj: Record<string, unknown>, field: string): string {
  const value = obj[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw invalid(`${field} must be a non-empty string`);
  }
  return value.trim();
}

export function requireQuantity(obj: Record<string, unknown>, field: string): number {
  const value = obj[field];
  if (typeof value !== "string" || !QUANTITY.test(value)) {
    throw invalid(`${field} must be a decimal string with up to 3 decimals`);
  }
  const parsed = parseDecimal(value);
  if (parsed <= 0) throw invalid(`${field} must be greater than zero`);
  return parsed;
}

export function requirePrice(obj: Record<string, unknown>, field: string): number {
  const value = obj[field];
  if (typeof value !== "string" || !PRICE.test(value)) {
    throw invalid(`${field} must be a decimal string with up to 2 decimals`);
  }
  const parsed = parseDecimal(value);
  if (parsed <= 0) throw invalid(`${field} must be greater than zero`);
  return parsed;
}

export function requirePeriod(obj: Record<string, unknown>, field: string): string {
  const value = requireString(obj, field);
  if (!PERIOD.test(value)) throw invalid(`${field} must look like YYYY-MM`);
  return value;
}
