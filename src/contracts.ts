import { randomUUID } from "node:crypto";
import { invalid, notFound } from "./http.ts";
import { formatMoney, formatQuantity, lineAmount } from "./money.ts";
import type { Reply, RequestContext } from "./router.ts";
import type { JsonStore } from "./store.ts";
import { CONTRACT_KINDS, type Contract, type ContractKind, type Db, type Item } from "./types.ts";
import {
  requireArray,
  requireObject,
  requirePrice,
  requireQuantity,
  requireString,
} from "./validation.ts";

export function findContract(db: Db, id: string): Contract {
  const contract = db.contracts[id];
  if (!contract) throw notFound("contract");
  return contract;
}

export function contractValue(contract: Contract): number {
  return contract.items.reduce((sum, item) => sum + lineAmount(item.quantity, item.unitPrice), 0);
}

function presentContract(contract: Contract) {
  return {
    id: contract.id,
    number: contract.number,
    kind: contract.kind,
    contractor: contract.contractor,
    originalValue: formatMoney(contractValue(contract)),
    items: contract.items.map((item) => ({
      code: item.code,
      description: item.description,
      unit: item.unit,
      unitPrice: formatMoney(item.unitPrice),
      quantity: formatQuantity(item.quantity),
    })),
    createdAt: contract.createdAt,
  };
}

export function contractRoutes(store: JsonStore) {
  async function create({ body }: RequestContext): Promise<Reply> {
    const input = requireObject(body, "body");
    const number = requireString(input, "number");
    const contractor = requireString(input, "contractor");
    const kind = requireString(input, "kind") as ContractKind;
    if (!CONTRACT_KINDS.includes(kind)) {
      throw invalid(`kind must be one of ${CONTRACT_KINDS.join(", ")}`);
    }

    const seen = new Set<string>();
    const items: Item[] = requireArray(input.items, "items").map((raw, i) => {
      const line = requireObject(raw, `items[${i}]`);
      const code = requireString(line, "code");
      if (seen.has(code)) throw invalid(`duplicate item code ${code}`);
      seen.add(code);
      return {
        code,
        description: requireString(line, "description"),
        unit: requireString(line, "unit"),
        unitPrice: requirePrice(line, "unitPrice"),
        quantity: requireQuantity(line, "quantity"),
      };
    });

    const db = await store.read();
    const contract: Contract = {
      id: randomUUID(),
      number,
      kind,
      contractor,
      items,
      createdAt: new Date().toISOString(),
    };
    db.contracts[contract.id] = contract;
    db.bulletins[contract.id] = [];
    await store.write(db);
    return { status: 201, body: presentContract(contract) };
  }

  async function show({ params }: RequestContext): Promise<Reply> {
    const db = await store.read();
    return { status: 200, body: presentContract(findContract(db, params.id ?? "")) };
  }

  async function statement({ params }: RequestContext): Promise<Reply> {
    const db = await store.read();
    const contract = findContract(db, params.id ?? "");
    const bulletins = db.bulletins[contract.id] ?? [];

    let contractedTotal = 0;
    let measuredTotal = 0;
    const items = contract.items.map((item) => {
      const measuredQuantity = bulletins
        .flatMap((b) => b.lines)
        .filter((line) => line.itemCode === item.code)
        .reduce((sum, line) => sum + line.quantity, 0);
      const contractedValue = lineAmount(item.quantity, item.unitPrice);
      const measuredValue = lineAmount(measuredQuantity, item.unitPrice);
      contractedTotal += contractedValue;
      measuredTotal += measuredValue;
      return {
        code: item.code,
        description: item.description,
        unit: item.unit,
        unitPrice: formatMoney(item.unitPrice),
        contractedQuantity: formatQuantity(item.quantity),
        contractedValue: formatMoney(contractedValue),
        measuredQuantity: formatQuantity(measuredQuantity),
        measuredValue: formatMoney(measuredValue),
        balanceQuantity: formatQuantity(item.quantity - measuredQuantity),
        balanceValue: formatMoney(contractedValue - measuredValue),
      };
    });

    return {
      status: 200,
      body: {
        contractId: contract.id,
        number: contract.number,
        kind: contract.kind,
        originalValue: formatMoney(contractValue(contract)),
        items,
        totals: {
          contractedValue: formatMoney(contractedTotal),
          measuredValue: formatMoney(measuredTotal),
          balanceValue: formatMoney(contractedTotal - measuredTotal),
        },
        bulletins: bulletins.map((b) => ({
          number: b.number,
          period: b.period,
          total: formatMoney(b.total),
        })),
      },
    };
  }

  return { create, show, statement };
}
