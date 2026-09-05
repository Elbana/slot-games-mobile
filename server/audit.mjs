/**
 * Append-only spin audit log (JSON lines).
 */

import fs from 'fs';
import path from 'path';
import { AUDIT_DIR } from './config.mjs';

function ensureDir() {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
}

function logFile() {
  const d = new Date();
  const name = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}.jsonl`;
  return path.join(AUDIT_DIR, name);
}

/** @param {object} entry */
export function auditLog(entry) {
  try {
    ensureDir();
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
    fs.appendFileSync(logFile(), `${line}\n`);
  } catch (err) {
    console.error('[audit] write failed', err.message);
  }
}

/** @param {object} entry */
export function auditSpin(entry) {
  auditLog({ kind: 'spin', ...entry });
}

/** @param {object} entry */
export function auditWallet(entry) {
  auditLog({ kind: 'wallet', ...entry });
}
