# ActionProof

**A tamper-proof audit trail for AI agents.** Verifiable observability: every action your
agent takes gets a cryptographically signed receipt you can verify offline, anywhere —
zero backend.

Observability tools (LangSmith, Langfuse, Arize) show you what your agent *reportedly*
did — traces recorded inside their platform, on their word. But those logs are
self-asserted: an agent, a bug, or an attacker can write anything into them, and you
can't prove after the fact that the record wasn't edited.

ActionProof adds the missing layer: **verifiable** observability. Each action —
email sent, form filed, payment made — gets a tamper-evident, Ed25519-signed **receipt**
capturing *what* was done, *by which agent*, *when*, and *on whose authority*. Edit any
field and verification fails. It's an audit trail you (or an auditor, a user, or a
counterparty) can trust without trusting the agent, the vendor, or us.

Built for the compliance floor that's coming — the EU AI Act (Article 12) and ISO 42001
require traceable, tamper-evident logs for automated decisions. ActionProof produces
exactly that, as a portable primitive rather than a walled-garden platform.

## Install

```bash
npm install actionproof      # TypeScript / JavaScript
pip install actionproof      # Python
```

Receipts are cross-compatible: one signed in TypeScript verifies in Python, and vice-versa.

## Quick start (TypeScript)

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

## Quick start (Python)

```python
from actionproof import attest, verify, generate_keypair

agent = generate_keypair()

receipt = attest(
    agent,
    type="email.send",
    summary="Sent renewal quote to jane@acme.com",
    params={"to": "jane@acme.com", "amount": 4200},  # hashed, not stored in clear
    result={"smtp": 250},
    outcome="ok",
)

verify(receipt)             # -> VerifyResult(valid=True, agent="did:key:z6Mk...")
```

Edit any field of that receipt and `verify` returns invalid. That's the whole idea.

## Where it fits: the verifiable layer of agent observability

ActionProof complements your observability stack rather than replacing it. Keep using
LangSmith / Langfuse / Arize for rich traces, latency, and cost — then attach an
ActionProof receipt to the actions that *matter* (the ones that move money, change state,
or touch a user's data) so that part of your trail is **tamper-evident and independently
verifiable**.

| | Observability platforms | ActionProof |
|---|---|---|
| Recording | traces/logs inside the vendor | signed receipts you hold |
| Trust model | trust the platform's stored record | verify cryptographically, trust no one |
| Tamper-evidence | editable by whoever has DB access | any edit breaks the signature |
| Portability | lives in the vendor | offline, cross-language, anywhere |
| Cost at scale | metered per event | ~$0 (local signing, zero backend) |

It's a *proof*, not just a log entry — the difference between "our dashboard says the agent
did this" and "here's a signed receipt anyone can verify."

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

## Auto-emit receipts (framework wrappers)

You don't have to call `attest` by hand after every action — wrap the tool once and every
call emits a receipt.

TypeScript (framework-agnostic; works with LangChain.js, Mastra, Vercel AI SDK):

```ts
import { withReceipts, generateKeypair } from "actionproof";

const agent = generateKeypair();
const send = withReceipts(agent, rawSendEmail, {
  type: "email.send",
  onReceipt: (r) => store(r),   // called with a signed receipt on every call
});
```

Python (`@attest_action` decorator, or a LangChain/CrewAI callback):

```python
from actionproof import attest_action, ActionProofCallbackHandler

@attest_action(agent, type="email.send", on_receipt=store)
def send_email(to, body): ...

# or attest every tool a framework agent runs, no per-tool code:
handler = ActionProofCallbackHandler(agent, on_receipt=store)
agent_executor.invoke(input, config={"callbacks": [handler]})
```

## Develop locally

```bash
git clone https://github.com/Burakfenerci5/actionproof
cd actionproof && npm install
npm run demo     # full sign → verify → tamper loop
npm test         # TS suite (9 tests)
npm run mcp      # start the MCP server over stdio

cd python && pip install -e ".[dev]" && pytest   # Python suite (7 tests, incl. TS↔Python interop)
```

## Roadmap

- **Now (shipped):** TypeScript library + MCP server + framework wrapper, and the Python
  package with a decorator and LangChain/CrewAI callback. Receipts interoperate across both.
- **Next:** first-class LlamaIndex / CrewAI plugins; exporters that attach receipts to
  spans in your existing observability stack (OpenTelemetry, LangSmith, Langfuse).
- **Later (optional, hosted):** a **verifiable audit dashboard** — a searchable,
  shareable, tamper-evident timeline of what your fleet of agents did, backed by an
  append-only log, for teams that need compliance-grade evidence (EU AI Act / ISO 42001)
  without building it themselves. **The library and MCP server stay free and offline
  forever;** only the hosted dashboard is a paid service.

## License

MIT.
