import { test } from "node:test";
import assert from "node:assert/strict";

import {
  attest,
  verify,
  hashValue,
  generateKeypair,
  keypairFromPem,
} from "./index.ts";

test("valid receipt verifies and reports the signing agent", () => {
  const kp = generateKeypair();
  const r = attest(kp, {
    type: "email.send",
    target: "acme-crm",
    summary: "Sent renewal quote",
    params: { to: "jane@acme.com" },
    result: { status: 250 },
    outcome: "ok",
  });
  const res = verify(r);
  assert.equal(res.valid, true);
  assert.equal(res.agent, kp.did);
});

test("tampering with any signed field breaks verification", () => {
  const kp = generateKeypair();
  const r = attest(kp, { type: "payment.send", summary: "Pay $5", outcome: "ok" });

  const mutated = structuredClone(r);
  mutated.receipt.action.summary = "Pay $5000";
  assert.equal(verify(mutated).valid, false);

  const reoutcome = structuredClone(r);
  reoutcome.receipt.action.outcome = "failed";
  assert.equal(verify(reoutcome).valid, false);
});

test("a different agent's DID cannot claim the receipt", () => {
  const kp = generateKeypair();
  const other = generateKeypair();
  const r = attest(kp, { type: "form.file", outcome: "ok" });

  const impersonated = structuredClone(r);
  impersonated.receipt.agent.id = other.did; // claim someone else signed it
  assert.equal(verify(impersonated).valid, false);
});

test("params/result hashes bind the real data", () => {
  const kp = generateKeypair();
  const params = { to: "jane@acme.com", amount: 4200 };
  const r = attest(kp, { type: "invoice.create", params, outcome: "ok" });

  // Correct data re-checks pass.
  assert.equal(verify(r, { expectParams: params }).valid, true);
  // Altered data is caught even though the signature itself is intact.
  assert.equal(
    verify(r, { expectParams: { to: "jane@acme.com", amount: 9999 } }).valid,
    false,
  );
  assert.equal(r.receipt.action.params_hash, hashValue(params));
});

test("keypair round-trips through PEM (agent persists identity across runs)", () => {
  const kp = generateKeypair();
  const reloaded = keypairFromPem(kp.privatePem);
  assert.equal(reloaded.did, kp.did);

  // A receipt signed by the reloaded key still verifies to the same DID.
  const r = attest(reloaded, { type: "resource.book", outcome: "ok" });
  assert.equal(verify(r).agent, kp.did);
});

test("canonicalization is order-independent (key order can't change the sig)", () => {
  // hashValue must be identical regardless of property insertion order.
  const a = hashValue({ x: 1, y: 2, nested: { b: 2, a: 1 } });
  const b = hashValue({ nested: { a: 1, b: 2 }, y: 2, x: 1 });
  assert.equal(a, b);
});
