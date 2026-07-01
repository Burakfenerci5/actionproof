"""ActionProof core: attest() and verify(), matching the TS reference.

A receipt signed here verifies in TypeScript and vice-versa, because both sign
the RFC-8785 canonical bytes of the same receipt object with Ed25519, and use
the same did:key identity encoding.
"""
from __future__ import annotations

import base64
import hashlib
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from cryptography.exceptions import InvalidSignature

from .canonical import canonical_bytes
from .keys import AgentKeypair, did_to_public_key

SPEC_VERSION = "ap0"
Outcome = Literal["ok", "failed", "partial"]


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def hash_value(value: Any) -> str:
    """sha256:<hex> over the canonical bytes of a value (matches TS hashValue)."""
    return "sha256:" + hashlib.sha256(canonical_bytes(value)).hexdigest()


def _now_iso() -> str:
    # RFC 3339 UTC with millisecond precision + 'Z', matching JS toISOString().
    return (
        datetime.now(timezone.utc)
        .strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]
        + "Z"
    )


def attest(
    kp: AgentKeypair,
    *,
    type: str,
    summary: Optional[str] = None,
    target: Optional[str] = None,
    params: Any = None,
    result: Any = None,
    outcome: Outcome = "ok",
    delegation: Optional[dict] = None,
    agent_name: Optional[str] = None,
    ts: Optional[str] = None,
) -> dict:
    """Create and sign a receipt. Returns a SignedReceipt dict."""
    action: dict[str, Any] = {"type": type}
    if target is not None:
        action["target"] = target
    if summary is not None:
        action["summary"] = summary
    if params is not None:
        action["params_hash"] = hash_value(params)
    if result is not None:
        action["result_hash"] = hash_value(result)
    action["outcome"] = outcome

    agent: dict[str, Any] = {"id": kp.did}
    if agent_name is not None:
        agent["name"] = agent_name

    receipt: dict[str, Any] = {
        "v": SPEC_VERSION,
        "id": str(uuid.uuid4()),
        "action": action,
        "agent": agent,
    }
    if delegation:
        receipt["delegation"] = delegation
    receipt["ts"] = ts or _now_iso()
    receipt["nonce"] = _b64url(os.urandom(12))

    sig = kp.private_key.sign(canonical_bytes(receipt))
    return {"receipt": receipt, "sig": _b64url(sig), "alg": "Ed25519"}


@dataclass
class VerifyResult:
    valid: bool
    agent: Optional[str] = None
    reason: Optional[str] = None


def verify(
    signed: dict,
    *,
    expect_params: Any = None,
    expect_result: Any = None,
) -> VerifyResult:
    """Verify a signed receipt offline (mirrors TS verify)."""
    if not isinstance(signed, dict) or "receipt" not in signed or "sig" not in signed:
        return VerifyResult(False, reason="Malformed signed receipt.")
    if signed.get("alg") != "Ed25519":
        return VerifyResult(False, reason=f"Unsupported alg: {signed.get('alg')}.")
    receipt = signed["receipt"]
    if receipt.get("v") != SPEC_VERSION:
        return VerifyResult(False, reason=f"Unsupported spec version: {receipt.get('v')}.")
    agent_did = receipt.get("agent", {}).get("id")
    if not agent_did:
        return VerifyResult(False, reason="Missing agent id.")

    try:
        did_to_public_key(agent_did).verify(
            _b64url_decode(signed["sig"]), canonical_bytes(receipt)
        )
    except (InvalidSignature, ValueError):
        return VerifyResult(False, reason="Signature does not verify.")

    if expect_params is not None and receipt["action"].get("params_hash") != hash_value(
        expect_params
    ):
        return VerifyResult(False, reason="params do not match params_hash.")
    if expect_result is not None and receipt["action"].get("result_hash") != hash_value(
        expect_result
    ):
        return VerifyResult(False, reason="result does not match result_hash.")

    return VerifyResult(True, agent=agent_did)
