export interface RequestContext {
  params: Record<string, string>;
  body: unknown;
}

export interface Reply {
  status: number;
  body: unknown;
}

export type Handler = (ctx: RequestContext) => Promise<Reply>;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

export class Router {
  #routes: Route[] = [];

  add(method: string, path: string, handler: Handler): this {
    const keys: string[] = [];
    const source = path.replace(/:(\w+)/g, (_match, key: string) => {
      keys.push(key);
      return "([^/]+)";
    });
    this.#routes.push({ method, pattern: new RegExp(`^${source}/?$`), keys, handler });
    return this;
  }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
    for (const route of this.#routes) {
      if (route.method !== method) continue;
      const found = route.pattern.exec(pathname);
      if (!found) continue;
      const params: Record<string, string> = {};
      route.keys.forEach((key, i) => {
        params[key] = decodeURIComponent(found[i + 1] ?? "");
      });
      return { handler: route.handler, params };
    }
    return null;
  }
}
