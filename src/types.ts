export type ContractKind = "obra" | "servico" | "reforma";

export const CONTRACT_KINDS: readonly ContractKind[] = ["obra", "servico", "reforma"];

export interface Item {
  code: string;
  description: string;
  unit: string;
  unitPrice: number;
  quantity: number;
}

export interface Contract {
  id: string;
  number: string;
  kind: ContractKind;
  contractor: string;
  items: Item[];
  createdAt: string;
}

export interface BulletinLine {
  itemCode: string;
  quantity: number;
  accumulated: number;
  amount: number;
}

export interface Bulletin {
  number: number;
  period: string;
  lines: BulletinLine[];
  total: number;
  createdAt: string;
}

export interface Db {
  contracts: Record<string, Contract>;
  bulletins: Record<string, Bulletin[]>;
}
