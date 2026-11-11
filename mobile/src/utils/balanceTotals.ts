/**
 * Balance helpers on decimal text (Principle III). Amounts become BigInt minor units, never a
 * JavaScript number, so totals are exact whatever their size.
 */

import type { AccountSummary } from "../services/api/types";

const ZERO = BigInt(0);

export interface CurrencyTotal {
  currency: string;
  decimals: number;
  /** "Te deben": sum of the positive balances, as decimal text. */
  owedToMe: string;
  /** "Debés": sum of the negative balances, without the sign. */
  iOwe: string;
}

/** -1 owes, 0 settled up, 1 is owed. */
export function amountSign(amount: string): -1 | 0 | 1 {
  if (!/[1-9]/.test(amount)) return 0;
  return amount.startsWith("-") ? -1 : 1;
}

/** The amount without its sign ("-30.00" → "30.00"). */
export function absAmount(amount: string): string {
  return amount.replace(/^-/, "");
}

export function toMinor(amount: string, decimals: number): bigint {
  const negative = amount.startsWith("-");
  const [whole, fraction = ""] = absAmount(amount).split(".");
  const minor = BigInt(whole + fraction.padEnd(decimals, "0").slice(0, decimals));
  return negative ? -minor : minor;
}

export function fromMinor(minor: bigint, decimals: number): string {
  const negative = minor < ZERO;
  const digits = (negative ? -minor : minor).toString().padStart(decimals + 1, "0");
  const text = decimals === 0 ? digits : `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
  return negative ? `-${text}` : text;
}

/**
 * "Te deben" and "Debés" per currency over every account, closed ones included (FR-024).
 * Currencies keep the order in which they first appear; all-zero currencies are left out.
 */
export function totalsByCurrency(accounts: AccountSummary[]): CurrencyTotal[] {
  const groups = new Map<string, { decimals: number; owed: bigint; owe: bigint }>();
  for (const account of accounts) {
    const group = groups.get(account.currency) ?? {
      decimals: account.currencyDecimals,
      owed: ZERO,
      owe: ZERO,
    };
    const minor = toMinor(account.myBalance, account.currencyDecimals);
    if (minor > ZERO) group.owed += minor;
    else group.owe -= minor;
    groups.set(account.currency, group);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.owed !== ZERO || group.owe !== ZERO)
    .map(([currency, group]) => ({
      currency,
      decimals: group.decimals,
      owedToMe: fromMinor(group.owed, group.decimals),
      iOwe: fromMinor(group.owe, group.decimals),
    }));
}
