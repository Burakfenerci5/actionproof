import { test } from "node:test";
import assert from "node:assert/strict";

import { verify, generateKeypair, type SignedReceipt } from "./index.ts";
import { withReceipts, withReceiptsTool } from "./wrap.ts";

test("withReceipts emits a valid 'ok' receipt and returns the result unchanged", async () => {
  const kp = generateKeypair();
  const receipts: SignedReceipt[] = [];

  const send = withReceipts(
    kp,
    async (to: string, amount: number) => ({ status: 250, to, amount }),
    {
      type: "email.send",
      summary: (args) => `Sent to ${args[0]}`,
      onReceipt: (r) => receipts.push(r),
    },
  );

  const out = await send("jane@acme.com", 4200);
  assert.deepEqual(out, { status: 250, to: "jane@acme.com", amount: 4200 });
  assert.equal(receipts.length, 1);

  const r = receipts[0];
  assert.equal(verify(r).valid, true);
  assert.equal(r.receipt.action.type, "email.send");
  assert.equal(r.receipt.action.outcome, "ok");
  assert.equal(r.receipt.action.summary, "Sent to jane@acme.com");
  // Args were captured as params and hash-bound.
  assert.equal(verify(r, { expectParams: ["jane@acme.com", 4200] }).valid, true);
});

test("withReceipts emits a 'failed' receipt and re-throws the original error", async () => {
  const kp = generateKeypair();
  const receipts: SignedReceipt[] = [];

  const boom = withReceipts(
    kp,
    async () => {
      throw new Error("smtp refused");
    },
    { type: "email.send", onReceipt: (r) => receipts.push(r) },
  );

  await assert.rejects(() => boom(), /smtp refused/);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].receipt.action.outcome, "failed");
  assert.equal(verify(receipts[0]).valid, true);
});

test("withReceiptsTool defaults the action type to the tool name", async () => {
  const kp = generateKeypair();
  const receipts: SignedReceipt[] = [];

  const tool = withReceiptsTool(
    kp,
    { name: "book_flight", handler: async (dest: string) => ({ booked: dest }) },
    { onReceipt: (r) => receipts.push(r) },
  );

  await tool.handler("LIS");
  assert.equal(receipts[0].receipt.action.type, "book_flight");
  assert.equal(verify(receipts[0]).valid, true);
});
