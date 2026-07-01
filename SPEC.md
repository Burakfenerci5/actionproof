# ActionProof Receipt — v0 draft spec

A tiny, offline, verifiable record that **an AI agent performed a specific action** —
signed by the agent's key so anyone can later check *what* was done, *by whom*, *when*,
and *on whose authority*, without trusting the agent's word.

## Why

Agents increasingly *act* (send email, file forms, book resources, move money). Today
there is no cheap, standard way for an agent to **prove after the fact** that an action
happened and was authorized. Logs are self-asserted and forgeable. ActionProof makes the
claim cryptographically checkable and tamper-evident — with **zero backend** in the base
case (the agent signs locally; the verifier checks locally).

Design goals: near-zero cost (no server required), a few lines to adopt, composable with
payment/authorization protocols (x402, AP2, ACP) rather than competing with them.

## The receipt

A receipt is a JSON object with a detached signature over its canonical form.

```jsonc
{
  "v": "ap0",                       // spec version
  "id": "uuid-v4",                  // unique receipt id
  "action": {
    "type": "email.send",           // reverse-dot verb namespace (freeform)
    "target": "acme-crm",           // system/resource acted upon
    "summary": "Sent renewal quote to jane@acme.com",
    "params_hash": "sha256:...",    // hash of the full action inputs (privacy-preserving)
    "result_hash": "sha256:...",    // hash of the observed result/response
    "outcome": "ok"                 // ok | failed | partial
  },
  "agent": {
    "id": "did:key:z6Mk...",        // agent public-key identifier (see Identity)
    "name": "renewal-bot@v1.2.0"    // human label, optional
  },
  "delegation": {                   // optional: who authorized the agent
    "by": "did:key:z6Mk...",        // the delegating principal (user/org)
    "scope": "email.send",          // authority granted
    "ref": "https://... | urn:..."  // pointer to the grant (AP2 mandate, OAuth grant, etc.)
  },
  "ts": "2026-07-01T18:22:05Z",     // RFC 3339 UTC, action time
  "nonce": "base64url"              // replay guard
}
```

The **signature** is Ed25519 over the JCS-canonicalized bytes of the object above
(RFC 8785 canonical JSON), detached and carried alongside:

```jsonc
{ "receipt": { ...above... }, "sig": "base64url", "alg": "Ed25519" }
```

## Identity

- Agent identity is a public key. We serialize it as a `did:key` (multibase Ed25519) so it
  is self-describing and needs no registry — **no backend, no accounts**.
- Verification is: recompute canonical bytes → check `sig` against `agent.id`'s key.
- Trust of *which* agent key is legitimate is out of scope for v0 (bring-your-own trust:
  pinned keys, an org allow-list, or — later — the optional transparency log).

## What a receipt proves (and doesn't)

Proves: a holder of the agent private key asserted this exact action + result at this time,
and (if present) referenced a delegation. Tampering with any field breaks the signature.

Does NOT prove on its own: that the external world actually reflects the action (that the
email truly arrived). For that, `result_hash` should bind a **counterparty-signed**
response when available (e.g. an x402 settlement receipt, an SMTP 250 with DKIM, an API
2xx body). ActionProof is the envelope; stronger receipts embed counterparty evidence in
`result_hash`.

## Optional anchoring (the only paid, non-required part)

For disputes needing third-party trust, a receipt's `id`+hash may be appended to a public,
append-only **transparency log** (Certificate-Transparency style) returning an inclusion
proof. The base library never requires this. Anchoring is the intended monetization surface
(a per-anchor micro-fee); signing and verifying are free and offline forever.
