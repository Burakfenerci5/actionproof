# ActionProof

**Verifiable receipts that prove what your AI agent actually did.** Sign locally,
verify anywhere, zero backend.

Agents increasingly *act* — they send emails, file forms, book resources, move money.
But their logs are self-asserted: an agent (or a bug, or an attacker) can claim anything
happened. ActionProof gives every action a tamper-evident, cryptographically signed
**receipt** — so you, your user, or a counterparty can later verify *what* was done,
*by which agent*, *when*, and *on whose authority*.

```ts
import { attest, verify, generateKeypair } from "actionproof";

const agent = generateKeypair();               // agent's identity = its key (did:key)

const receipt = attest(agent, {
  type: "email.send",
  summary: "Sent renewal quote to jane@acme.com",
  params: { to: "jane@acme.com", amount: 4200 }, // hashed, not stored in clear
  result: { smtp: 250 },
  outcome: "ok",
});

verify(receipt);            // -> { valid: true, agent: "did:key:z6Mk..." }
```

Edit any field of that receipt and `verify` returns `{ valid: false }`. That's the whole
idea.

## Why it's different from a logging/observability tool

LangSmith, Langfuse et al. record what your agent did **inside their platform, on their
word**. ActionProof receipts are **portable and cryptographic**: they verify offline,
anywhere, by anyone — with no trust in us or in the agent. It's a *proof*, not a log entry.

## Design principles

- **Offline & zero-backend.** The agent brings its own Ed25519 key. Signing and
  verification use only native crypto — no server, no account, no network. (This is also
  why it costs ~nothing to run at any scale.)
- **Privacy-preserving.** Sensitive inputs/outputs are stored as SHA-256 hashes; you can
  later prove a value matches without ever putting it in the receipt.
- **Composable, not competitive.** ActionProof is the *receipt envelope*. Bind stronger
  evidence into `result_hash` — an [x402](https://x402.org) settlement, an AP2 mandate
  reference, a DKIM-signed SMTP `250` — to make a receipt as strong as its counterparty
  evidence.
- **Identity with no registry.** Agent identity is a `did:key` (self-describing public
  key). Who you *trust* is your policy (pinned keys, an allow-list, or the optional log
  below).

See [SPEC.md](./SPEC.md) for the wire format.

## Use it as an MCP server (no code)

The fastest way to give an agent receipts: run ActionProof as an MCP server and add it to
Claude Desktop / Cursor. Your agent gets three tools — `attest_action`, `verify_receipt`,
`get_identity` — and can emit a receipt right after it does something.

Add to your MCP client config (e.g. Claude Desktop `claude_desktop_config.json`):

```jsonc
{
  "mcpServers": {
    "actionproof": {
      "command": "npx",
      "args": ["-y", "actionproof-mcp"]
    }
  }
}
```

The server mints a stable Ed25519 identity on first run (stored at
`~/.actionproof/agent.key.pem`, override with `ACTIONPROOF_KEY_PATH`). Every receipt it
signs is attributable to that one agent `did:key`.

## Use it as a library

```bash
npm install
npm run demo     # full sign → verify → tamper loop
npm test         # 6 tests: validity, tamper, impersonation, hash-binding, PEM round-trip
npm run mcp      # start the MCP server over stdio
```

## Roadmap

- **Now:** TypeScript reference library **+ MCP server** (this repo).
- **Next:** Python port; LangChain/CrewAI/LlamaIndex plugins so any agent emits receipts by
  adding one tool.
- **Later (the only paid, optional part):** a hosted **transparency log** — anchor a
  receipt's hash to a public append-only ledger (Certificate-Transparency style) and get
  back a shareable proof URL (`/r/<id>`) plus an inclusion proof, for disputes that need
  third-party trust. **The library and MCP server stay free and offline forever;** only
  public anchoring is a paid, metered service.

## License

MIT.
