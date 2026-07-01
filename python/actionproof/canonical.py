"""Canonical JSON serialization (RFC 8785 / JCS subset).

Must produce byte-for-byte the same output as the TypeScript canonical.ts, so a
receipt signed in one language verifies in the other. That means: keys sorted
lexicographically, no whitespace, UTF-8, and the same escaping as the JS/TS
JSON serializer. Python's json.dumps with sort_keys + compact separators +
ensure_ascii=False matches for the value types receipts use (str, int, bool,
None, dict, list).
"""
from __future__ import annotations

import json
from typing import Any


def canonical_bytes(value: Any) -> bytes:
    """Return the canonical UTF-8 bytes of a JSON-compatible value."""
    text = json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )
    return text.encode("utf-8")
