import { resolve } from "node:path";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? 3000);
const dataDir = resolve(process.env.DATA_DIR ?? "data");

const server = createApp({ dataDir });
server.listen(port, () => {
  console.log(`medicao-api listening on :${port} (data in ${dataDir})`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
