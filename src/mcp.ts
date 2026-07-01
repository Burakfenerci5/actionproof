#!/usr/bin/env -S node --experimental-strip-types
/**
 * ActionProof MCP server (stdio).
 *
 * Exposes the library as three drop-in tools so any MCP client (Claude Desktop,
 * Cursor, etc.) can emit and check verifiable action-receipts with zero code:
 *
 *   attest_action  — sign a receipt for an action the agent just performed
 *   verify_receipt — check a signed receipt offline (validity + optional data match)
 *   get_identity   — return this server's stable agent did:key
 *
 * The server owns one persistent Ed25519 key (see keystore.ts), so every receipt
 * is attributable to the same agent identity across runs. No network, no backend.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { attest, verify, type SignedReceipt, type Outcome } from "./index.ts";
import { loadOrCreateKeypair } from "./keystore.ts";

const { kp, path, created } = loadOrCreateKeypair();

const server = new McpServer({ name: "actionproof", version: "0.0.1" });

// --- attest_action -----------------------------------------------------------
server.registerTool(
  "attest_action",
  {
    title: "Attest an action",
    description:
      "Create a signed, tamper-evident receipt that THIS agent performed an " +
      "action (e.g. sent an email, filed a form, made a payment). Call it right " +
      "after you perform the action. Returns a SignedReceipt you can store or " +
      "share; anyone can later verify it offline.",
    inputSchema: {
      type: z
        .string()
        .describe("Action verb in reverse-dot form, e.g. 'email.send', 'payment.send'."),
      summary: z
        .string()
        .optional()
        .describe("Human-readable one-line description of what was done."),
      target: z.string().optional().describe("System/resource acted upon, e.g. 'acme-crm'."),
      params: z
        .any()
        .optional()
        .describe("The action's inputs. Stored only as a hash (privacy-preserving)."),
      result: z
        .any()
        .optional()
        .describe("The observed result/response. Stored only as a hash."),
      outcome: z
        .enum(["ok", "failed", "partial"])
        .optional()
        .describe("Outcome of the action. Defaults to 'ok'."),
      delegation_by: z
        .string()
        .optional()
        .describe("did:key or id of the principal who authorized this action, if any."),
      delegation_scope: z.string().optional().describe("Authority granted, e.g. 'email.send'."),
      delegation_ref: z
        .string()
        .optional()
        .describe("Pointer to the grant (OAuth grant, AP2 mandate URL/URN)."),
    },
  },
  async (args) => {
    const receipt = attest(kp, {
      type: args.type,
      summary: args.summary,
      target: args.target,
      params: args.params,
      result: args.result,
      outcome: args.outcome as Outcome | undefined,
      delegation: args.delegation_by
        ? {
            by: args.delegation_by,
            scope: args.delegation_scope,
            ref: args.delegation_ref,
          }
        : undefined,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(receipt, null, 2) }],
    };
  },
);

// --- verify_receipt ----------------------------------------------------------
server.registerTool(
  "verify_receipt",
  {
    title: "Verify a receipt",
    description:
      "Verify a signed ActionProof receipt offline. Returns whether the " +
      "signature is valid and which agent did:key signed it. Optionally " +
      "re-check that supplied params/result match the hashes in the receipt.",
    inputSchema: {
      signed_receipt: z
        .string()
        .describe("The SignedReceipt JSON (as produced by attest_action)."),
      expect_params: z
        .any()
        .optional()
        .describe("If provided, verify these params match the receipt's params_hash."),
      expect_result: z
        .any()
        .optional()
        .describe("If provided, verify this result matches the receipt's result_hash."),
    },
  },
  async (args) => {
    let parsed: SignedReceipt;
    try {
      parsed = JSON.parse(args.signed_receipt) as SignedReceipt;
    } catch {
      return {
        isError: true,
        content: [{ type: "text", text: "signed_receipt is not valid JSON." }],
      };
    }
    const result = verify(parsed, {
      expectParams: args.expect_params,
      expectResult: args.expect_result,
    });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// --- get_identity ------------------------------------------------------------
server.registerTool(
  "get_identity",
  {
    title: "Get this agent's identity",
    description:
      "Return this ActionProof server's stable agent identity (a did:key). " +
      "Receipts from attest_action are signed by this identity.",
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify({ agent: kp.did, keyPath: path }, null, 2),
      },
    ],
  }),
);

async function main() {
  // Log identity to stderr (never stdout — stdout is the JSON-RPC channel).
  process.stderr.write(
    `[actionproof] agent ${kp.did} (${created ? "created" : "loaded"} key at ${path})\n`,
  );
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  process.stderr.write(`[actionproof] fatal: ${String(err)}\n`);
  process.exit(1);
});
