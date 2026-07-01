/**
 * Ed25519 keys + did:key identifiers, using only Node's native crypto.
 *
 * The agent's identity IS its public key, serialized as a `did:key` (multibase
 * base58btc of the multicodec-prefixed raw key). Self-describing, needs no
 * registry or backend — which is what keeps ActionProof near-$0 to run.
 */
import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  sign as nodeSign,
  verify as nodeVerify,
  type KeyObject,
} from "node:crypto";

// multicodec prefix for an Ed25519 public key: 0xed 0x01 (varint).
const ED25519_MULTICODEC = new Uint8Array([0xed, 0x01]);

// --- base58btc (Bitcoin alphabet) -------------------------------------------
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58encode(bytes: Uint8Array): string {
  let x = 0n;
  for (const b of bytes) x = x * 256n + BigInt(b);
  let out = "";
  while (x > 0n) {
    const r = Number(x % 58n);
    x = x / 58n;
    out = B58[r] + out;
  }
  // Preserve leading zero bytes as leading '1's.
  for (const b of bytes) {
    if (b === 0) out = "1" + out;
    else break;
  }
  return out;
}

function base58decode(str: string): Uint8Array {
  let x = 0n;
  for (const c of str) {
    const idx = B58.indexOf(c);
    if (idx < 0) throw new Error("Invalid base58 character.");
    x = x * 58n + BigInt(idx);
  }
  const bytes: number[] = [];
  while (x > 0n) {
    bytes.unshift(Number(x % 256n));
    x = x / 256n;
  }
  for (const c of str) {
    if (c === "1") bytes.unshift(0);
    else break;
  }
  return new Uint8Array(bytes);
}

/** Raw 32-byte Ed25519 public key from a KeyObject (via SPKI DER). */
function rawPublicKey(pub: KeyObject): Uint8Array {
  const der = pub.export({ type: "spki", format: "der" }) as Buffer;
  // The 32-byte raw key is the final 32 bytes of the SPKI structure.
  return new Uint8Array(der.subarray(der.length - 32));
}

/** Build a did:key string from a raw Ed25519 public key. */
export function publicKeyToDid(pub: KeyObject): string {
  const raw = rawPublicKey(pub);
  const prefixed = new Uint8Array(ED25519_MULTICODEC.length + raw.length);
  prefixed.set(ED25519_MULTICODEC, 0);
  prefixed.set(raw, ED25519_MULTICODEC.length);
  return "did:key:z" + base58encode(prefixed);
}

/** Recover a verifying KeyObject from a did:key string. */
export function didToPublicKey(did: string): KeyObject {
  if (!did.startsWith("did:key:z")) {
    throw new Error("Unsupported DID (expected did:key base58btc).");
  }
  const decoded = base58decode(did.slice("did:key:z".length));
  if (decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new Error("DID is not an Ed25519 key.");
  }
  const raw = decoded.subarray(2);
  // Wrap the 32-byte raw key in the fixed Ed25519 SPKI DER prefix.
  const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
  const der = Buffer.concat([SPKI_PREFIX, Buffer.from(raw)]);
  return createPublicKey({ key: der, format: "der", type: "spki" });
}

export interface AgentKeypair {
  did: string;
  privateKey: KeyObject;
  publicKey: KeyObject;
  /** PKCS8 PEM of the private key, for the agent to persist between runs. */
  privatePem: string;
}

/** Generate a fresh agent keypair. */
export function generateKeypair(): AgentKeypair {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    did: publicKeyToDid(publicKey),
    privateKey,
    publicKey,
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }) as string,
  };
}

/** Reload an agent keypair from a stored PKCS8 PEM private key. */
export function keypairFromPem(privatePem: string): AgentKeypair {
  const privateKey = createPrivateKey(privatePem);
  const publicKey = createPublicKey(privateKey);
  return {
    did: publicKeyToDid(publicKey),
    privateKey,
    publicKey,
    privatePem,
  };
}

/** Ed25519 sign (no pre-hash; Ed25519 hashes internally). */
export function sign(message: Uint8Array, privateKey: KeyObject): Uint8Array {
  return new Uint8Array(nodeSign(null, message, privateKey));
}

/** Ed25519 verify against a did:key. */
export function verifySignature(
  message: Uint8Array,
  signature: Uint8Array,
  did: string,
): boolean {
  try {
    return nodeVerify(null, message, didToPublicKey(did), signature);
  } catch {
    return false;
  }
}
