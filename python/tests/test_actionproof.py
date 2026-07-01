"""Python unit tests + the critical cross-language interop check."""
import copy
import json
import os
import subprocess

from actionproof import (
    attest,
    verify,
    hash_value,
    generate_keypair,
    keypair_from_pem,
)


def test_valid_receipt_verifies():
    kp = generate_keypair()
    r = attest(kp, type="email.send", summary="hi", params={"to": "jane"}, outcome="ok")
    res = verify(r)
    assert res.valid is True
    assert res.agent == kp.did


def test_tamper_breaks_verification():
    kp = generate_keypair()
    r = attest(kp, type="payment.send", summary="Pay $5", outcome="ok")
    mutated = copy.deepcopy(r)
    mutated["receipt"]["action"]["summary"] = "Pay $5000"
    assert verify(mutated).valid is False


def test_impersonation_fails():
    kp = generate_keypair()
    other = generate_keypair()
    r = attest(kp, type="form.file", outcome="ok")
    bad = copy.deepcopy(r)
    bad["receipt"]["agent"]["id"] = other.did
    assert verify(bad).valid is False


def test_params_hash_binding():
    kp = generate_keypair()
    params = {"to": "jane@acme.com", "amount": 4200}
    r = attest(kp, type="invoice.create", params=params, outcome="ok")
    assert verify(r, expect_params=params).valid is True
    assert verify(r, expect_params={"to": "jane@acme.com", "amount": 9999}).valid is False


def test_pem_roundtrip():
    kp = generate_keypair()
    reloaded = keypair_from_pem(kp.private_pem)
    assert reloaded.did == kp.did
    r = attest(reloaded, type="resource.book", outcome="ok")
    assert verify(r).agent == kp.did


def test_hash_value_matches_key_order():
    a = hash_value({"x": 1, "y": 2, "nested": {"b": 2, "a": 1}})
    b = hash_value({"nested": {"a": 1, "b": 2}, "y": 2, "x": 1})
    assert a == b


# --- The one that matters: a TS-signed receipt must verify in Python ---------
def test_cross_language_ts_receipt_verifies_in_python():
    """Sign a receipt in TypeScript, verify it here. Proves the spec is portable."""
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    out = subprocess.run(
        [
            "node",
            "--experimental-strip-types",
            "-e",
            (
                'import { attest, generateKeypair } from "./src/index.ts";'
                'const kp = generateKeypair();'
                'const r = attest(kp, { type: "email.send", target: "acme-crm",'
                ' summary: "cross-lang", params: { to: "jane@acme.com", amount: 4200 },'
                ' result: { status: 250 }, outcome: "ok" });'
                'process.stdout.write(JSON.stringify({ did: kp.did, signed: r }));'
            ),
        ],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=True,
    )
    payload = json.loads(out.stdout)
    res = verify(payload["signed"])
    assert res.valid is True, res.reason
    assert res.agent == payload["did"]
    # And the params hash computed in Python matches the TS-embedded hash.
    assert verify(
        payload["signed"], expect_params={"to": "jane@acme.com", "amount": 4200}
    ).valid is True
