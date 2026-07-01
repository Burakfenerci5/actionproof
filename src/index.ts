/**
 * ActionProof — sign and verify receipts that an AI agent performed an action.
 *
 *   const kp = generateKeypair();
 *   const receipt = attest(kp, {
 *     type: "email.send",
 *     target: "acme-crm",
 *     summary: "Sent renewal quote to jane@acme.com",
 *     params: { to: "jane@acme.com", template: "renewal" },
 *     result: { status: 250 },
 *     outcome: "ok",
 *   });
 *   verify(receipt); // -> { valid: true, ... }
 *
 * Fully offline: the agent brings its own key, signing and verification run
 * locally, no server or account required. See SPEC.md for the wire format.
 */
import { createHash, randomUUID, randomBytes } from "node:crypto";

import { canonicalBytes } from "./canonical.ts";
import {
  type AgentKeypair,
  sign,
  verifySignature,
} from "./keys.ts";

export {
  generateKeypair,
  keypairFromPem,
  publicKeyToDid,
  type AgentKeypair,
} from "./keys.ts";

export {
  withReceipts,
  withReceiptsTool,
  type WrapOptions,
  type ToolLike,
} from "./wrap.ts";

export const SPEC_VERSION = "ap0";

export type Outcome = "ok" | "failed" | "partial";

/** The signed body of a receipt (see SPEC.md). */
export interface Receipt {
  v: string;
  id: string;
  action: {
    type: string;
    target?: string;
    summary?: string;
    params_hash?: string;
    result_hash?: string;
    outcome: Outcome;
  };
  agent: { id: string; name?: string };
  delegation?: { by: string; scope?: string; ref?: string };
  ts: string;
  nonce: string;
}

/** A receipt plus its detached signature — the thing you store/transmit. */
export interface SignedReceipt {
  receipt: Receipt;
  sig: string; // base64url
  alg: "Ed25519";
}

/** Inputs an agent supplies to attest to an action. */
export interface ActionInput {
  type: string;
  target?: string;
  summary?: string;
  /** Full action inputs; hashed (never stored in clear) for privacy. */
  params?: unknown;
  /** Observed result/response; hashed. Bind counterparty evidence here. */
  result?: unknown;
  outcome?: Outcome;
  delegation?: { by: string; scope?: string; ref?: string };
  agentName?: string;
  /** Override the timestamp (RFC 3339 UTC). Defaults to now. */
  ts?: string;
}

/** sha256:<hex> of the canonical bytes of a value. */
export function hashValue(value: unknown): string {
  const digest = createHash("sha256").update(canonicalBytes(value)).digest("hex");
  return "sha256:" + digest;
}

/** Create and sign a receipt for an action. */
export function attest(kp: AgentKeypair, action: ActionInput): SignedReceipt {
  const receipt: Receipt = {
    v: SPEC_VERSION,
    id: randomUUID(),
    action: {
      type: action.type,
      ...(action.target !== undefined ? { target: action.target } : {}),
      ...(action.summary !== undefined ? { summary: action.summary } : {}),
      ...(action.params !== undefined
        ? { params_hash: hashValue(action.params) }
        : {}),
      ...(action.result !== undefined
        ? { result_hash: hashValue(action.result) }
        : {}),
      outcome: action.outcome ?? "ok",
    },
    agent: {
      id: kp.did,
      ...(action.agentName !== undefined ? { name: action.agentName } : {}),
    },
    ...(action.delegation ? { delegation: action.delegation } : {}),
    ts: action.ts ?? new Date().toISOString(),
    nonce: randomBytes(12).toString("base64url"),
  };

  const sig = sign(canonicalBytes(receipt), kp.privateKey);
  return { receipt, sig: Buffer.from(sig).toString("base64url"), alg: "Ed25519" };
}

export interface VerifyResult {
  valid: boolean;
  /** Present when valid: the agent DID that signed. */
  agent?: string;
  /** Reason string when invalid. */
  reason?: string;
}

/**
 * Verify a signed receipt offline. Optionally enforce that a given value
 * matches an embedded hash (e.g. re-check the params the agent claims it used).
 */
export function verify(
  signed: SignedReceipt,
  opts: { expectParams?: unknown; expectResult?: unknown } = {},
): VerifyResult {
  const { receipt, sig, alg } = signed ?? ({} as SignedReceipt);
  if (!receipt || !sig) return { valid: false, reason: "Malformed signed receipt." };
  if (alg !== "Ed25519") return { valid: false, reason: `Unsupported alg: ${alg}.` };
  if (receipt.v !== SPEC_VERSION) {
    return { valid: false, reason: `Unsupported spec version: ${receipt.v}.` };
  }
  const agentDid = receipt.agent?.id;
  if (!agentDid) return { valid: false, reason: "Missing agent id." };

  const ok = verifySignature(
    canonicalBytes(receipt),
    Buffer.from(sig, "base64url"),
    agentDid,
  );
  if (!ok) return { valid: false, reason: "Signature does not verify." };

  // Optional content re-checks: prove the caller's data matches what was signed.
  if (
    opts.expectParams !== undefined &&
    receipt.action.params_hash !== hashValue(opts.expectParams)
  ) {
    return { valid: false, reason: "params do not match params_hash." };
  }
  if (
    opts.expectResult !== undefined &&
    receipt.action.result_hash !== hashValue(opts.expectResult)
  ) {
    return { valid: false, reason: "result does not match result_hash." };
  }

  return { valid: true, agent: agentDid };
}
