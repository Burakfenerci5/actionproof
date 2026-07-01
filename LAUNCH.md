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
  `[ActionProof](https://github.com/Burakfenerci5/actionproof) - Verifiable, tamper-evident receipts proving what an AI agent did; sign locally, verify anywhere, zero backend.`

---

# Launch posts (copy-paste, tune before posting)

## Show HN
**Title:** Show HN: ActionProof – verifiable receipts that prove what an AI agent did

**Body:**
Agents increasingly *act* — send emails, file forms, move money. But their logs are
self-asserted: an agent, a bug, or an attacker can claim anything happened. There's no
cheap standard way to prove, after the fact, that an action actually occurred and was
authorized.

ActionProof gives each action a tamper-evident, Ed25519-signed **receipt**. Sign it
locally, verify it anywhere — offline, no backend, no account. The agent's identity is a
`did:key` (its public key), so there's nothing to host and nothing to trust but the math.
Edit any field and verification fails.

- `npm install actionproof` / `pip install actionproof` (receipts interoperate across both)
- Also ships as an MCP server (`npx -y actionproof-mcp`) — three tools: attest_action,
  verify_receipt, get_identity — so Claude Desktop / Cursor agents emit receipts with no code.
- Composable with x402 / AP2 / ACP: bind a counterparty signature into the receipt's
  result hash to make it as strong as the evidence behind it.

It's MIT and deliberately tiny (no deps beyond native crypto). Repo:
https://github.com/Burakfenerci5/actionproof — would love feedback on the receipt format
(SPEC.md) and whether this is a real pain for people building agents.

## Reddit r/AI_Agents  (also fits r/LocalLLaMA, r/mcp)
**Title:** I built a tiny open-source way to prove what your AI agent actually did (offline, zero backend)

**Body:**
If you build agents that *act* (not just chat), you've probably hit this: after a run, how
do you *prove* the agent really sent that email / made that booking, and didn't just log
that it did? Logs are self-asserted and forgeable.

ActionProof is a small MIT library that makes each action a cryptographically signed,
tamper-evident receipt — verify it later offline, no server, no account. Works in
TypeScript and Python (receipts cross-verify), and drops into Claude Desktop / Cursor as an
MCP server so your agent emits receipts automatically.

`npm install actionproof` · `pip install actionproof` · https://github.com/Burakfenerci5/actionproof

Genuinely want to know: is verifiable proof-of-action something you'd use, or do your
existing logs/observability already cover it? Trying to learn if this is a real gap.

## X / short post
Agents can *act* now — but can they *prove* they did?

ActionProof: tamper-evident, cryptographically signed receipts for AI agent actions.
Sign locally, verify anywhere, zero backend. TS + Python + MCP. MIT.

npm i actionproof · pip install actionproof
https://github.com/Burakfenerci5/actionproof

---

# After posting — what to watch (the demand signal)
- npm downloads: https://npm-stat.com/charts.html?package=actionproof
- PyPI downloads: https://pypistats.org/packages/actionproof
- GitHub stars/issues/forks traffic (repo Insights)
- Any inbound "can it also do X" — that's the roadmap, and the signal for the paid anchor service.
