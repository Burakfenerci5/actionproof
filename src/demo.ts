/**
 * Runnable demo: `npm run demo`
 *
 * Shows the whole loop an agent developer would wire up — generate an identity,
 * attest an action, verify it, and watch tampering get caught.
 */
import { attest, verify, generateKeypair } from "./index.ts";

const kp = generateKeypair();
console.log("Agent identity (did:key):\n  " + kp.did + "\n");

// 1) Agent performs an action and attests to it.
const receipt = attest(kp, {
  type: "email.send",
  target: "acme-crm",
  summary: "Sent renewal quote to jane@acme.com",
  params: { to: "jane@acme.com", template: "renewal-2026", amount: 4200 },
  result: { smtp: 250, messageId: "<abc@acme>" },
  outcome: "ok",
  delegation: {
    by: "did:key:z6MkExampleUserOrOrgKey",
    scope: "email.send",
    ref: "urn:oauth-grant:acme-crm:9f3",
  },
  agentName: "renewal-bot@v1.2.0",
});

console.log("Signed receipt:");
console.log(JSON.stringify(receipt, null, 2) + "\n");

// 2) Anyone verifies it later — offline, no server.
console.log("verify(receipt) ->", verify(receipt));

// 3) Re-check the actual params against the signed hash.
console.log(
  "verify with correct params ->",
  verify(receipt, {
    expectParams: { to: "jane@acme.com", template: "renewal-2026", amount: 4200 },
  }),
);

// 4) Tamper: someone edits the amount after the fact.
const tampered = structuredClone(receipt);
tampered.receipt.action.summary = "Sent renewal quote to attacker@evil.com";
console.log("verify(tampered) ->", verify(tampered));
