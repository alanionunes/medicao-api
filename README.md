# medicao-api

A small HTTP service that tracks **measurement bulletins** (*boletins de medição*) for
Brazilian public works contracts.

A public works contract is signed against a bid spreadsheet (*planilha orçamentária*):
a list of items, each with a unit, a contracted quantity and a unit price. Every month
the inspector measures what was executed and issues a bulletin with the quantity done in
that period for each item. Payment is made on the bulletin total, so the contract's
physical and financial balance is always derived from its bulletins.

## Running

Requires Node.js 24 or newer (TypeScript runs natively, no build step).

```bash
npm install
npm start          # PORT (default 3000), DATA_DIR (default ./data)
npm test
npm run typecheck
```

All state lives under `DATA_DIR`. No external services are needed.

## Conventions

- Quantities are decimal strings with up to 3 decimals in requests (`"12.5"`, `"0.125"`)
  and exactly 3 decimals in responses (`"12.500"`).
- Unit prices and money are decimal strings with up to 2 decimals in requests and exactly
  2 decimals in responses (`"1500.00"`).
- Errors use one shape and a stable `code`:

  ```json
  { "error": { "code": "OVER_CONTRACT", "message": "human readable text" } }
  ```

  | Status | Code | When |
  |---|---|---|
  | 400 | `INVALID_JSON` | Body is not valid JSON |
  | 400 | `VALIDATION` | A field is missing or badly formatted |
  | 404 | `NOT_FOUND` | Unknown contract, bulletin or route |
  | 422 | `UNKNOWN_ITEM` | A bulletin line references an item not in the contract |
  | 422 | `OVER_CONTRACT` | An item's measured quantity would exceed its contracted quantity |

## Endpoints

### `POST /contracts`

```json
{
  "number": "CT-012/2026",
  "kind": "obra",
  "contractor": "Construtora Exemplo Ltda",
  "items": [
    { "code": "1.1", "description": "Concreto fck 30 MPa", "unit": "m3", "quantity": "120.000", "unitPrice": "612.40" },
    { "code": "1.2", "description": "Forma de madeira", "unit": "m2", "quantity": "800.000", "unitPrice": "58.90" }
  ]
}
```

`kind` is one of `obra` (works), `servico` (services) or `reforma` (renovation of a
building or equipment). Responds `201` with the contract, including its generated `id`
and its `originalValue`.

### `GET /contracts/:id`

Responds `200` with the contract and its items.

### `POST /contracts/:id/bulletins`

```json
{ "period": "2026-10", "lines": [ { "itemCode": "1.1", "quantity": "35.250" } ] }
```

Responds `201` with the bulletin:

```json
{
  "contractId": "…",
  "number": 1,
  "period": "2026-10",
  "lines": [ { "itemCode": "1.1", "quantity": "35.250", "accumulated": "35.250", "amount": "21587.10" } ],
  "total": "21587.10",
  "createdAt": "…"
}
```

`accumulated` is the quantity measured for that item up to and including this bulletin.

### `GET /contracts/:id/bulletins/:n`

Responds `200` with bulletin number `n`.

### `GET /contracts/:id/statement`

The contract's physical and financial position (*planilha de acompanhamento*):

```json
{
  "contractId": "…",
  "number": "CT-012/2026",
  "kind": "obra",
  "originalValue": "120608.00",
  "items": [
    {
      "code": "1.1", "description": "…", "unit": "m3", "unitPrice": "612.40",
      "contractedQuantity": "120.000", "contractedValue": "73488.00",
      "measuredQuantity": "35.250", "measuredValue": "21587.10",
      "balanceQuantity": "84.750", "balanceValue": "51900.90"
    }
  ],
  "totals": { "contractedValue": "…", "measuredValue": "…", "balanceValue": "…" },
  "bulletins": [ { "number": 1, "period": "2026-10", "total": "21587.10" } ]
}
```

### `GET /health`

Responds `200` with `{ "ok": true }`.
