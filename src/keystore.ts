/**
 * Persistent identity for the MCP server.
 *
 * A local stdio MCP server IS the agent's identity holder, so it owns one
 * Ed25519 keypair persisted as a PKCS8 PEM. On first run it mints a key; on
 * later runs it reloads the same one, so the agent's did:key stays stable
 * (and receipts remain attributable to the same agent over time).
 *
 * The key is a plain file with 0600 perms — never transmitted anywhere. Path
 * is configurable via ACTIONPROOF_KEY_PATH; defaults under the user's home.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { dirname } from "node:path";

import { generateKeypair, keypairFromPem, type AgentKeypair } from "./keys.ts";

function defaultKeyPath(): string {
  return (
    process.env.ACTIONPROOF_KEY_PATH ??
    join(homedir(), ".actionproof", "agent.key.pem")
  );
}

/** Load the agent's keypair, creating and persisting one on first use. */
export function loadOrCreateKeypair(path = defaultKeyPath()): {
  kp: AgentKeypair;
  path: string;
  created: boolean;
} {
  if (existsSync(path)) {
    return { kp: keypairFromPem(readFileSync(path, "utf8")), path, created: false };
  }
  const kp = generateKeypair();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, kp.privatePem, { mode: 0o600 });
  try {
    chmodSync(path, 0o600); // enforce even if umask loosened it
  } catch {
    /* best effort on platforms without POSIX perms */
  }
  return { kp, path, created: true };
}
