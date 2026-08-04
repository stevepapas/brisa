/**
 * Creates (or reports) the automatic PRODUCT discount that runs
 * `brisa-cores-volume` on the shop.
 *
 * Prerequisites:
 *   1. `shopify app deploy` released the discount function
 *   2. App installed on the store with `write_discounts`
 *   3. Token from the **Brisa Kit Bundle** app (not Brisa Admin)
 *
 * Usage:
 *   SHOP=whsuhd-8u.myshopify.com ADMIN_TOKEN=shpat_xxx npm run activate:cores-volume
 *
 * Or after linking Kit Bundle client credentials:
 *   CLIENT_ID=… CLIENT_SECRET=… npm run activate:cores-volume
 */

import { loadDotEnv, resolveAdminToken } from './admin-auth.mjs';

loadDotEnv();

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-10';
const FUNCTION_HANDLE = process.env.CORES_VOLUME_HANDLE || 'brisa-cores-volume';
const TITLE = process.env.CORES_VOLUME_TITLE || 'Brisa Cores Volume';

const auth = await resolveAdminToken();
const endpoint = `https://${auth.shop}/admin/api/${API_VERSION}/graphql.json`;

async function gql(query, variables = {}) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': auth.token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(JSON.stringify(json, null, 2));
  }
  return json.data;
}

function hasScope(scope) {
  const scopes = (auth.scope || '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return scopes.includes(scope);
}

console.log(`Shop: ${auth.shop} (auth: ${auth.source}, scopes: ${auth.scope || 'n/a'})`);

if (auth.scope && !hasScope('write_discounts')) {
  console.error(`
This token lacks write_discounts (got: ${auth.scope}).

.br env CLIENT_ID/SECRET are usually **Brisa Admin**, not Kit Bundle.
Use Admin UI instead:

  1. Discounts → Create discount
  2. Choose **Brisa Cores Volume** (under Brisa Kit Bundle)
  3. Method: Automatic → Save

Or run with a Kit Bundle Admin token:
  ADMIN_TOKEN=shpat_xxx npm run activate:cores-volume
`);
  process.exit(1);
}

const existing = await gql(
  `#graphql
  query ($query: String!) {
    discountNodes(first: 25, query: $query) {
      nodes {
        id
        discount {
          __typename
          ... on DiscountAutomaticApp {
            title
            status
            discountClasses
            appDiscountType {
              functionId
              title
            }
          }
        }
      }
    }
  }`,
  { query: `title:${TITLE}` }
);

const already = (existing.discountNodes?.nodes || []).find((n) => {
  const d = n.discount;
  return d?.__typename === 'DiscountAutomaticApp' && d.title === TITLE;
});

if (already) {
  console.log('Discount already exists:', {
    id: already.id,
    title: already.discount.title,
    status: already.discount.status,
    functionId: already.discount.appDiscountType?.functionId,
  });
  process.exit(0);
}

// shopifyFunctions has no `query` filter — filter by apiType, then match title.
const functions = await gql(
  `#graphql
  query {
    shopifyFunctions(first: 25, apiType: "discount") {
      nodes {
        id
        title
        apiType
        useCreationUi
        app {
          title
        }
      }
    }
  }`
);

const nodes = functions.shopifyFunctions?.nodes || [];
const needle = FUNCTION_HANDLE.replace(/^brisa-/, '').replace(/-/g, ' '); // "cores volume"
const fn =
  nodes.find((n) => (n.title || '').toLowerCase() === 'brisa cores volume') ||
  nodes.find((n) => (n.title || '').toLowerCase().includes(needle)) ||
  nodes.find((n) => (n.title || '').toLowerCase().includes('cores')) ||
  nodes[0];

if (!fn?.id) {
  console.error(`
Could not find Shopify Function for "${FUNCTION_HANDLE}" (expected title match on discount functions).

Confirm:
  1. brisa-kit-bundle-4 (or later) is the active app version
  2. Brisa Kit Bundle is installed on this shop
  3. Token is from Kit Bundle (with write_discounts), not Brisa Admin
`);
  process.exit(1);
}

console.log('Using function:', { id: fn.id, title: fn.title, apiType: fn.apiType });

const created = await gql(
  `#graphql
  mutation ($discount: DiscountAutomaticAppInput!) {
    discountAutomaticAppCreate(automaticAppDiscount: $discount) {
      automaticAppDiscount {
        discountId
        title
        status
        discountClasses
        appDiscountType {
          functionId
          title
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }`,
  {
    discount: {
      title: TITLE,
      functionId: fn.id,
      discountClasses: ['PRODUCT'],
      startsAt: new Date().toISOString(),
      combinesWith: {
        orderDiscounts: true,
        productDiscounts: true,
        shippingDiscounts: true,
      },
    },
  }
);

const payload = created.discountAutomaticAppCreate;
if (payload?.userErrors?.length) {
  console.error('User errors:', JSON.stringify(payload.userErrors, null, 2));
  console.error(`
If this failed with access/scope errors, create the discount in Admin instead:

  1. Shopify Admin → Discounts → Create discount
  2. Choose app discount / "Brisa Cores Volume" (Product)
  3. Set to Automatic, Active
  4. Combinations: allow with order + shipping as needed
`);
  process.exit(1);
}

console.log('Created automatic discount:', payload.automaticAppDiscount);
