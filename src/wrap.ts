/**
 * Framework-agnostic auto-receipt wrappers.
 *
 * The point of a "plugin" is that a builder shouldn't have to call attest()
 * by hand after every action. These helpers wrap an existing function or tool
 * so a signed receipt is emitted automatically on each call — works with any
 * TS agent framework (LangChain.js, Mastra, Vercel AI SDK) because it wraps at
 * the plain-function/tool level rather than binding to one framework's API.
 */
import { attest, type AgentKeypair, type SignedReceipt, type Outcome } from "./index.ts";

/** How to derive receipt fields from a call's args and result. */
export interface WrapOptions<Args extends unknown[], Result> {
  /** Action verb, e.g. "email.send". */
  type: string;
  /** Resource acted upon. */
  target?: string;
  /** Build a human summary from the call. */
  summary?: (args: Args, result: Result) => string;
  /** Delegation info, if the call is on someone's authority. */
  delegation?: { by: string; scope?: string; ref?: string };
  /** Optional label for the agent. */
  agentName?: string;
  /** Called with every emitted receipt (store it, anchor it, print it, …). */
  onReceipt: (receipt: SignedReceipt) => void;
  /**
   * Map a thrown error to an outcome. Default: any throw → "failed" receipt is
   * emitted, then the error is re-thrown so behavior is unchanged.
   */
  onError?: "failed" | "partial";
}

/**
 * Wrap an async function so each invocation emits a receipt via onReceipt.
 * The wrapper is transparent: same signature, same return, same thrown errors.
 *
 *   const send = withReceipts(kp, rawSend, {
 *     type: "email.send",
 *     summary: (a) => `Sent to ${a[0]}`,
 *     onReceipt: (r) => store(r),
 *   });
 */
export function withReceipts<Args extends unknown[], Result>(
  kp: AgentKeypair,
  fn: (...args: Args) => Promise<Result>,
  opts: WrapOptions<Args, Result>,
): (...args: Args) => Promise<Result> {
  return async (...args: Args): Promise<Result> => {
    try {
      const result = await fn(...args);
      opts.onReceipt(
        attest(kp, {
          type: opts.type,
          target: opts.target,
          summary: opts.summary?.(args, result),
          params: args,
          result,
          outcome: "ok",
          delegation: opts.delegation,
          agentName: opts.agentName,
        }),
      );
      return result;
    } catch (err) {
      opts.onReceipt(
        attest(kp, {
          type: opts.type,
          target: opts.target,
          summary: `error: ${err instanceof Error ? err.message : String(err)}`,
          params: args,
          outcome: (opts.onError ?? "failed") as Outcome,
          delegation: opts.delegation,
          agentName: opts.agentName,
        }),
      );
      throw err;
    }
  };
}

/**
 * Minimal shape of an agent "tool" across TS frameworks: a name + an async
 * handler. withReceiptsTool wraps the handler so the tool auto-attests. Most
 * frameworks (LangChain.js, Mastra, Vercel AI SDK) expose a tool object whose
 * execution function fits this shape.
 */
export interface ToolLike<Args extends unknown[], Result> {
  name?: string;
  handler: (...args: Args) => Promise<Result>;
}

export function withReceiptsTool<Args extends unknown[], Result>(
  kp: AgentKeypair,
  tool: ToolLike<Args, Result>,
  opts: Omit<WrapOptions<Args, Result>, "type"> & { type?: string },
): ToolLike<Args, Result> {
  const type = opts.type ?? tool.name ?? "tool.call";
  return {
    ...tool,
    handler: withReceipts(kp, tool.handler, { ...opts, type }),
  };
}
