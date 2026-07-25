import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loads KEY=VALUE pairs from brisa-functions/.env into process.env (no override).
 */
export function loadDotEnv(filePath = resolve(process.cwd(), '.env')) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function normalizeShop(shop) {
  return shop?.replace(/^https?:\/\//, '').replace(/\/$/, '') || '';
}

/**
 * Resolve an Admin API access token.
 * Prefers ADMIN_TOKEN; otherwise exchanges CLIENT_ID + CLIENT_SECRET
 * (Dev Dashboard credentials) via client_credentials grant.
 */
export async function resolveAdminToken({
  shop,
  adminToken = process.env.ADMIN_TOKEN,
  clientId = process.env.CLIENT_ID || process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY,
  clientSecret =
    process.env.CLIENT_SECRET ||
    process.env.SHOPIFY_CLIENT_SECRET ||
    process.env.SHOPIFY_API_SECRET,
} = {}) {
  const host = normalizeShop(shop || process.env.SHOP);
  if (!host) {
    throw new Error('Missing SHOP (e.g. whsuhd-8u.myshopify.com)');
  }

  if (adminToken) {
    return { shop: host, token: adminToken, source: 'ADMIN_TOKEN' };
  }

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing credentials. Set CLIENT_ID + CLIENT_SECRET in .env (Dev Dashboard → Settings), or ADMIN_TOKEN.'
    );
  }

  const res = await fetch(`https://${host}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Token exchange failed (${res.status}): ${JSON.stringify(json)}`
    );
  }

  return {
    shop: host,
    token: json.access_token,
    source: 'client_credentials',
    scope: json.scope,
    expiresIn: json.expires_in,
  };
}
