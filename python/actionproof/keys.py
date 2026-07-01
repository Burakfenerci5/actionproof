"""Ed25519 keys + did:key identifiers, matching the TypeScript implementation.

Uses the `cryptography` package for Ed25519. did:key encoding is the multicodec
prefix (0xed 0x01) + raw 32-byte public key, base58btc-encoded with a leading
'z' multibase marker — identical to keys.ts, so DIDs match across languages.
"""
from __future__ import annotations

from dataclasses import dataclass

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

ED25519_MULTICODEC = bytes([0xED, 0x01])
_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def _b58encode(data: bytes) -> str:
    x = int.from_bytes(data, "big")
    out = ""
    while x > 0:
        x, r = divmod(x, 58)
        out = _B58[r] + out
    for b in data:  # preserve leading zero bytes as '1'
        if b == 0:
            out = "1" + out
        else:
            break
    return out


def _b58decode(s: str) -> bytes:
    x = 0
    for c in s:
        x = x * 58 + _B58.index(c)
    # Convert to bytes.
    full = x.to_bytes((x.bit_length() + 7) // 8, "big") if x else b""
    n_leading = 0
    for c in s:
        if c == "1":
            n_leading += 1
        else:
            break
    return b"\x00" * n_leading + full


def public_key_to_did(pub: Ed25519PublicKey) -> str:
    raw = pub.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return "did:key:z" + _b58encode(ED25519_MULTICODEC + raw)


def did_to_public_key(did: str) -> Ed25519PublicKey:
    if not did.startswith("did:key:z"):
        raise ValueError("Unsupported DID (expected did:key base58btc).")
    decoded = _b58decode(did[len("did:key:z"):])
    if decoded[0:2] != ED25519_MULTICODEC:
        raise ValueError("DID is not an Ed25519 key.")
    return Ed25519PublicKey.from_public_bytes(decoded[2:])


@dataclass
class AgentKeypair:
    did: str
    private_key: Ed25519PrivateKey
    public_key: Ed25519PublicKey

    @property
    def private_pem(self) -> str:
        return self.private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("utf-8")


def generate_keypair() -> AgentKeypair:
    priv = Ed25519PrivateKey.generate()
    pub = priv.public_key()
    return AgentKeypair(did=public_key_to_did(pub), private_key=priv, public_key=pub)


def keypair_from_pem(private_pem: str) -> AgentKeypair:
    priv = serialization.load_pem_private_key(private_pem.encode("utf-8"), password=None)
    assert isinstance(priv, Ed25519PrivateKey)
    pub = priv.public_key()
    return AgentKeypair(did=public_key_to_did(pub), private_key=priv, public_key=pub)
