import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { createApp } from "../src/app.ts";

let baseUrl = "";
let dataDir = "";
let close: () => Promise<void> = async () => {};

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "medicao-api-"));
  const server = createApp({ dataDir });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise((resolve) => server.close(() => resolve()));
});

after(async () => {
  await close();
  await rm(dataDir, { recursive: true, force: true });
});

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

async function createContract() {
  const res = await call("POST", "/contracts", {
    number: "CT-001/2026",
    kind: "obra",
    contractor: "Construtora Teste Ltda",
    items: [
      { code: "1.1", description: "Escavação", unit: "m3", quantity: "100", unitPrice: "20.00" },
      { code: "1.2", description: "Aterro", unit: "m3", quantity: "50.000", unitPrice: "10.00" },
    ],
  });
  assert.equal(res.status, 201);
  return res.body;
}

describe("contracts", () => {
  test("creates a contract and reports its original value", async () => {
    const contract = await createContract();
    assert.equal(contract.originalValue, "2500.00");
    assert.equal(contract.items[0].quantity, "100.000");

    const shown = await call("GET", `/contracts/${contract.id}`);
    assert.equal(shown.status, 200);
    assert.equal(shown.body.number, "CT-001/2026");
  });

  test("rejects malformed input", async () => {
    const res = await call("POST", "/contracts", { number: "X", kind: "obra", contractor: "Y", items: [] });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION");

    const badKind = await call("POST", "/contracts", {
      number: "X",
      kind: "concessao",
      contractor: "Y",
      items: [{ code: "1", description: "a", unit: "un", quantity: "1", unitPrice: "1.00" }],
    });
    assert.equal(badKind.status, 400);
  });

  test("returns 404 for an unknown contract", async () => {
    const res = await call("GET", "/contracts/does-not-exist");
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
  });
});

describe("bulletins", () => {
  test("numbers bulletins and tracks accumulated quantities", async () => {
    const contract = await createContract();
    const first = await call("POST", `/contracts/${contract.id}/bulletins`, {
      period: "2026-09",
      lines: [
        { itemCode: "1.1", quantity: "30.000" },
        { itemCode: "1.2", quantity: "10" },
      ],
    });
    assert.equal(first.status, 201);
    assert.equal(first.body.number, 1);
    assert.equal(first.body.total, "700.00");

    const second = await call("POST", `/contracts/${contract.id}/bulletins`, {
      period: "2026-10",
      lines: [{ itemCode: "1.1", quantity: "20.000" }],
    });
    assert.equal(second.status, 201);
    assert.equal(second.body.number, 2);
    assert.equal(second.body.lines[0].accumulated, "50.000");

    const fetched = await call("GET", `/contracts/${contract.id}/bulletins/2`);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.total, "400.00");
  });

  test("rejects a bulletin that exceeds the contracted quantity", async () => {
    const contract = await createContract();
    await call("POST", `/contracts/${contract.id}/bulletins`, {
      period: "2026-09",
      lines: [{ itemCode: "1.2", quantity: "45.000" }],
    });
    const res = await call("POST", `/contracts/${contract.id}/bulletins`, {
      period: "2026-10",
      lines: [{ itemCode: "1.2", quantity: "6.000" }],
    });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, "OVER_CONTRACT");
  });

  test("rejects lines for items outside the contract", async () => {
    const contract = await createContract();
    const res = await call("POST", `/contracts/${contract.id}/bulletins`, {
      period: "2026-09",
      lines: [{ itemCode: "9.9", quantity: "1.000" }],
    });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, "UNKNOWN_ITEM");
  });

  test("returns 404 for a missing bulletin", async () => {
    const contract = await createContract();
    const res = await call("GET", `/contracts/${contract.id}/bulletins/7`);
    assert.equal(res.status, 404);
  });
});

describe("statement", () => {
  test("reports contracted, measured and balance per item and in total", async () => {
    const contract = await createContract();
    await call("POST", `/contracts/${contract.id}/bulletins`, {
      period: "2026-09",
      lines: [{ itemCode: "1.1", quantity: "25.000" }],
    });

    const res = await call("GET", `/contracts/${contract.id}/statement`);
    assert.equal(res.status, 200);
    const item = res.body.items.find((i: any) => i.code === "1.1");
    assert.equal(item.measuredQuantity, "25.000");
    assert.equal(item.measuredValue, "500.00");
    assert.equal(item.balanceQuantity, "75.000");
    assert.equal(item.balanceValue, "1500.00");
    assert.deepEqual(res.body.totals, {
      contractedValue: "2500.00",
      measuredValue: "500.00",
      balanceValue: "2000.00",
    });
    assert.deepEqual(res.body.bulletins, [{ number: 1, period: "2026-09", total: "500.00" }]);
  });
});
