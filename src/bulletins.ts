import { findContract } from "./contracts.ts";
import { HttpError, invalid, notFound } from "./http.ts";
import { formatMoney, formatQuantity, lineAmount } from "./money.ts";
import type { Reply, RequestContext } from "./router.ts";
import type { JsonStore } from "./store.ts";
import type { Bulletin, BulletinLine } from "./types.ts";
import {
  requireArray,
  requireObject,
  requirePeriod,
  requireQuantity,
  requireString,
} from "./validation.ts";

function presentBulletin(contractId: string, bulletin: Bulletin) {
  return {
    contractId,
    number: bulletin.number,
    period: bulletin.period,
    lines: bulletin.lines.map((line) => ({
      itemCode: line.itemCode,
      quantity: formatQuantity(line.quantity),
      accumulated: formatQuantity(line.accumulated),
      amount: formatMoney(line.amount),
    })),
    total: formatMoney(bulletin.total),
    createdAt: bulletin.createdAt,
  };
}

export function bulletinRoutes(store: JsonStore) {
  async function create({ params, body }: RequestContext): Promise<Reply> {
    const input = requireObject(body, "body");
    const period = requirePeriod(input, "period");
    const rawLines = requireArray(input.lines, "lines");

    const db = await store.read();
    const contract = findContract(db, params.id ?? "");
    const existing = db.bulletins[contract.id] ?? [];

    const seen = new Set<string>();
    const lines: BulletinLine[] = rawLines.map((raw, i) => {
      const line = requireObject(raw, `lines[${i}]`);
      const itemCode = requireString(line, "itemCode");
      if (seen.has(itemCode)) throw invalid(`item ${itemCode} appears twice`);
      seen.add(itemCode);

      const item = contract.items.find((candidate) => candidate.code === itemCode);
      if (!item) {
        throw new HttpError(422, "UNKNOWN_ITEM", `item ${itemCode} is not in the contract`);
      }

      const quantity = requireQuantity(line, "quantity");
      const previous = existing
        .flatMap((b) => b.lines)
        .filter((l) => l.itemCode === itemCode)
        .reduce((sum, l) => sum + l.quantity, 0);
      const accumulated = previous + quantity;
      if (accumulated > item.quantity) {
        throw new HttpError(
          422,
          "OVER_CONTRACT",
          `item ${itemCode} would reach ${formatQuantity(accumulated)} of ${formatQuantity(item.quantity)} contracted`,
        );
      }

      return { itemCode, quantity, accumulated, amount: lineAmount(quantity, item.unitPrice) };
    });

    const bulletin: Bulletin = {
      number: existing.length + 1,
      period,
      lines,
      total: lines.reduce((sum, line) => sum + line.amount, 0),
      createdAt: new Date().toISOString(),
    };
    db.bulletins[contract.id] = [...existing, bulletin];
    await store.write(db);
    return { status: 201, body: presentBulletin(contract.id, bulletin) };
  }

  async function show({ params }: RequestContext): Promise<Reply> {
    const db = await store.read();
    const contract = findContract(db, params.id ?? "");
    const number = Number(params.n);
    const bulletin = (db.bulletins[contract.id] ?? []).find((b) => b.number === number);
    if (!bulletin) throw notFound("bulletin");
    return { status: 200, body: presentBulletin(contract.id, bulletin) };
  }

  return { create, show };
}
