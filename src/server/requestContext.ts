import { AsyncLocalStorage } from "async_hooks";

/**
 * Identity of the caller for the tool call currently executing. Over stdio
 * there is a single local caller and no session id.
 */
export interface RequestContext {
  transport: "stdio" | "http";
  sessionId?: string;
  clientId?: string;
  clientIp?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(context: RequestContext, fn: () => Promise<T>): Promise<T> =>
  storage.run(context, fn);

export const getRequestContext = (): RequestContext | undefined => storage.getStore();
