import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Db } from "./types.ts";

export class JsonStore {
  readonly file: string;

  constructor(dataDir: string) {
    this.file = join(dataDir, "store.json");
  }

  async read(): Promise<Db> {
    try {
      const raw = await readFile(this.file, "utf8");
      return JSON.parse(raw) as Db;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { contracts: {}, bulletins: {} };
      }
      throw err;
    }
  }

  async write(db: Db): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify(db, null, 2));
  }
}
