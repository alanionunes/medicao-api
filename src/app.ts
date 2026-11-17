import { createServer, type Server } from "node:http";
import { bulletinRoutes } from "./bulletins.ts";
import { contractRoutes } from "./contracts.ts";
import { HttpError, notFound, readJson, sendError, sendJson } from "./http.ts";
import { Router } from "./router.ts";
import { JsonStore } from "./store.ts";

export interface AppOptions {
  dataDir: string;
}

export function createApp({ dataDir }: AppOptions): Server {
  const store = new JsonStore(dataDir);
  const contracts = contractRoutes(store);
  const bulletins = bulletinRoutes(store);

  const router = new Router()
    .add("GET", "/health", async () => ({ status: 200, body: { ok: true } }))
    .add("POST", "/contracts", contracts.create)
    .add("GET", "/contracts/:id", contracts.show)
    .add("GET", "/contracts/:id/statement", contracts.statement)
    .add("POST", "/contracts/:id/bulletins", bulletins.create)
    .add("GET", "/contracts/:id/bulletins/:n", bulletins.show);

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const route = router.match(req.method ?? "GET", url.pathname);
      if (!route) throw notFound("route");
      const body = await readJson(req);
      const reply = await route.handler({ params: route.params, body });
      sendJson(res, reply.status, reply.body);
    } catch (err) {
      if (err instanceof HttpError) {
        sendError(res, err);
        return;
      }
      console.error(err);
      sendError(res, new HttpError(500, "INTERNAL", "unexpected error"));
    }
  });
}
