/**
 * Operator token validation and game allowlists.
 */

import fs from 'fs';
import { OPERATORS_FILE, REQUIRE_AUTH } from '../config.mjs';

/** @type {{ operators: object[] } | null} */
let cached = null;

function loadOperatorsFile() {
  if (cached) return cached;
  try {
    const raw = fs.readFileSync(OPERATORS_FILE, 'utf8');
    cached = JSON.parse(raw);
  } catch (err) {
    console.error('[auth] failed to load operators file', OPERATORS_FILE, err.message);
    cached = { operators: [] };
  }
  return cached;
}

/** @param {import('express').Request} req */
export function extractOperatorToken(req) {
  const auth = req.headers?.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  const q = { ...req.query, ...req.body };
  return q.token || req.headers['x-operator-token'] || null;
}

/** @param {string} token */
export function resolveOperator(token) {
  if (!token) return null;
  const { operators } = loadOperatorsFile();
  return operators.find((op) => op.token === token) ?? null;
}

/** @param {import('express').Request} req */
export function requireOperator(req, res) {
  const token = extractOperatorToken(req);
  if (!token) {
    if (REQUIRE_AUTH) {
      res.status(401).json({ error: 'Operator token required' });
      return null;
    }
    const demo = resolveOperator('op_demo_all');
    if (demo) return demo;
    res.status(401).json({ error: 'Operator token required' });
    return null;
  }
  const operator = resolveOperator(token);
  if (!operator) {
    res.status(403).json({ error: 'Invalid operator token' });
    return null;
  }
  return operator;
}

/** @param {object} operator @param {string} slug */
export function isGameEnabled(operator, slug) {
  const list = operator?.enabledGames;
  if (!Array.isArray(list)) return false;
  return list.includes(slug);
}

/** @param {import('express').Request} req @param {import('express').Response} res @param {string} slug */
export function requireGameAccess(req, res, slug) {
  const operator = requireOperator(req, res);
  if (!operator) return null;
  if (!isGameEnabled(operator, slug)) {
    res.status(403).json({ error: 'Game not enabled for this operator', slug });
    return null;
  }
  return operator;
}
