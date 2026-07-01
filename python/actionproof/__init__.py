"""ActionProof — verifiable receipts that prove what an AI agent did."""
from .core import attest, verify, hash_value, VerifyResult, SPEC_VERSION
from .keys import (
    generate_keypair,
    keypair_from_pem,
    public_key_to_did,
    did_to_public_key,
    AgentKeypair,
)
from .wrap import attest_action, ActionProofCallbackHandler

__all__ = [
    "attest",
    "verify",
    "hash_value",
    "VerifyResult",
    "SPEC_VERSION",
    "generate_keypair",
    "keypair_from_pem",
    "public_key_to_did",
    "did_to_public_key",
    "AgentKeypair",
    "attest_action",
    "ActionProofCallbackHandler",
]
