# ActionProof — launch & distribution playbook

Internal checklist for getting ActionProof discovered. Not shipped in the npm/pip
package (it's in the repo for reference). Work top-down; the official MCP Registry is
highest-leverage because aggregators (MCPfinder, etc.) pull from it.

## 0. Prerequisite: publish npm 0.0.2 (carries the `mcpName` marker)

The official registry verifies ownership by reading `mcpName` from the *published* npm
package. Our 0.0.1 lacks it, so publish 0.0.2 first:

```bash
cd /Users/bfenercioglu/Documents/actionproof
npm publish --access public      # prepublishOnly builds + tests; enter 2FA when prompted
```

(Optional, keep parity) republish Python 0.0.2:
```bash
cd python && rm -rf dist && .venv/bin/python -m build && .venv/bin/twine upload dist/*
```
> Bump `python/pyproject.toml` version to 0.0.2 first if you do this.

## 1. Official MCP Registry  (do this first)

```bash
brew install mcp-publisher        # or download the binary from the registry repo releases
cd /Users/bfenercioglu/Documents/actionproof
mcp-publisher login github        # device-code OAuth as Burakfenerci5 (verifies io.github.Burakfenerci5/*)
mcp-publisher publish             # reads ./server.json
# verify:
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.Burakfenerci5/actionproof"
```
`server.json` is already in the repo root, version pinned to 0.0.2. If npm ends up on a
different version, bump `server.json`'s two `version` fields to match before publishing.

## 2. Glama.ai — web form (also auto-crawls GitHub)
- https://glama.ai/mcp/servers → "Add Server"
- Repo URL: https://github.com/Burakfenerci5/actionproof
- Capabilities: Tools. Hosting: Local (stdio). Language: TypeScript. Category: Security / Dev Tools.

## 3. mcp.so — GitHub issue
- https://mcp.so/submit  (or open an issue at https://github.com/chatmcp/mcpso/issues)
- Type: MCP Server · Name: ActionProof · URL: the GitHub repo
- Server config to paste:
  ```json
  { "mcpServers": { "actionproof": { "command": "npx", "args": ["-y", "actionproof-mcp"] } } }
  ```

## 4. PulseMCP — PR (auto-promotes to official registry)
- Open an issue at https://github.com/pulsemcp/mcp-servers to get assigned, then PR
  adding ActionProof under a Security/Productionized category per their CONTRIBUTING.md.

## 5. Smithery.ai — CLI
```bash
npm install -g smithery@latest
smithery auth login
smithery mcp publish -n Burakfenerci5/actionproof   # or publish the npx command per their docs
```

## 6. Awesome MCP Servers — PR (90k+ stars, high traffic)
- Fork https://github.com/punkpeye/awesome-mcp-servers
- Add under the most fitting category (Security / Developer Tools), alphabetical:
  `[ActionProof](https://github.com/Burakfenerci5/actionproof) - Tamper-proof audit trail for AI agents; signed, offline-verifiable receipts for every action. Zero backend.`

---

# Launch posts (copy-paste, tune before posting)

Framing: lead with "verifiable observability / tamper-proof audit trail" (the growing
market) and — crucially — ask whether this is a real pain. The goal of the launch is a
demand signal, not just installs.

## Show HN
**Title:** Show HN: ActionProof – a tamper-proof audit trail for AI agents

**Body:**
Observability tools (LangSmith, Langfuse, Arize) show what your agent *reportedly* did —
traces stored inside a platform, on its word. But those logs are self-asserted: anyone
with DB access (an agent, a bug, an attacker) can write or edit them, and you can't prove
after the fact that the record wasn't changed.

ActionProof adds the missing layer — *verifiable* observability. Each action (email sent,
form filed, payment made) gets a tamper-evident, Ed25519-signed receipt you can verify
offline, anywhere. The agent's identity is a `did:key`; edit any field and verification
fails. It complements your observability stack rather than replacing it — attach a receipt
to the actions that actually matter.

- `npm install actionproof` / `pip install actionproof` (receipts interoperate across both)
- Ships as an MCP server (`npx -y actionproof-mcp`) — three tools: attest_action,
  verify_receipt, get_identity — so Claude Desktop / Cursor agents emit receipts with no code.
- Framework wrappers auto-emit receipts (LangChain, CrewAI). Zero backend, zero deps
  beyond native crypto. MIT.

I built this because the audit-trail requirements coming from the EU AI Act (Art. 12) and
ISO 42001 want tamper-evidence that a vendor-stored log can't really give. **Honest
question for HN:** is verifiable/tamper-proof agent logging a real need you'd adopt, or do
your existing traces already cover it? Repo (+ the receipt spec in SPEC.md):
https://github.com/Burakfenerci5/actionproof

## Reddit r/AI_Agents  (also fits r/LocalLLaMA, r/mcp)
**Title:** Made a tamper-proof audit trail for AI agents — is verifiable logging something you'd actually use?

**Body:**
If you run agents that *act* (not just chat), your observability tool logs what happened —
but that log lives in a vendor and is editable. You can't hand it to an auditor (or a
customer) and prove it wasn't changed after the fact.

ActionProof is a small MIT library that gives each agent action a cryptographically
signed, tamper-evident receipt — verify it offline, anywhere, no server or account. Works
in TypeScript and Python (receipts cross-verify), and drops into Claude Desktop / Cursor
as an MCP server. Meant to sit *alongside* LangSmith/Langfuse, not replace them.

`npm install actionproof` · `pip install actionproof` · https://github.com/Burakfenerci5/actionproof

Genuinely trying to learn if this is a real gap: does anyone actually need *verifiable*
(not just recorded) agent logs — for compliance, multi-party trust, or disputes — or is
this a solution looking for a problem? Blunt takes welcome.

## X / short post
Your agent's logs say it sent the email. Can you *prove* it — to an auditor, offline,
without trusting the vendor that stored the log?

ActionProof: a tamper-proof audit trail for AI agents. Signed, offline-verifiable
receipts. Sits alongside your observability stack. TS + Python + MCP. MIT.

npm i actionproof · pip install actionproof
https://github.com/Burakfenerci5/actionproof

---

# After posting — what to watch (the demand signal)
- npm downloads: https://npm-stat.com/charts.html?package=actionproof
- PyPI downloads: https://pypistats.org/packages/actionproof
- GitHub stars/issues/forks traffic (repo Insights)
- Any inbound "can it also do X" — that's the roadmap, and the signal for the paid anchor service.
