# ActionProof (Python)

Verifiable receipts that prove what your AI agent did. Sign locally, verify anywhere,
zero backend. Receipts are cross-compatible with the [TypeScript library](../README.md) —
a receipt signed in one verifies in the other.

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

verify(receipt)  # -> VerifyResult(valid=True, agent="did:key:z6Mk...")
```

## Auto-emit receipts

Decorator — every call to the function emits a signed receipt:

```python
from actionproof import attest_action

@attest_action(agent, type="email.send", on_receipt=store)
def send_email(to, body): ...
```

LangChain / CrewAI — attest every tool the agent runs, no per-tool code:

```python
from actionproof import ActionProofCallbackHandler

handler = ActionProofCallbackHandler(agent, on_receipt=store)
agent_executor.invoke(input, config={"callbacks": [handler]})
```

## Install & test

```bash
pip install -e ".[dev]"
pytest tests/          # 7 tests incl. a TS↔Python cross-language interop check
```

Requires `cryptography`. The optional `langchain` extra makes the callback handler a real
`BaseCallbackHandler`; without it, the handler still works as a plain object.
