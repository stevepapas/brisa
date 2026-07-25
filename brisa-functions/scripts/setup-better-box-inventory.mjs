/**
 * Configure Monthly Better Box so Appstle subscription cart/add succeeds.
 *
 * Appstle selling plans use inventoryPolicyReserve ON_SALE. With MBB at qty 0
 * and inventoryPolicy DENY (or untracked with no sellable qty), /cart/add.js
 * returns "The product 'Monthly better box' is already sold out" even when
 * Brisa Cores flavour packs are in stock.
 *
 * Fix: tracked inventory + CONTINUE policy. Optionally set a high dummy qty
 * (requires write_inventory) — cores remain the source of truth via theme
 * gating + Shopify Flow BOM decrements.
 *
 *   npm run setup:better-box-inventory
 *
 * Scopes: write_products (required). write_inventory + read_locations optional
 * for --qty.
 */

import { loadDotEnv, resolveAdminToken } from './admin-auth.mjs';

loadDotEnv();

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
const BETTER_BOX_HANDLE = process.env.BETTER_BOX_HANDLE || 'monthly-better-box';
const DEFAULT_LOCATION_ID =
  process.env.LOCATION_ID || 'gid://shopify/Location/114492866932';
const DEFAULT_DUMMY_QTY = Number(process.env.MBB_DUMMY_QTY || 9999);

function argValue(flag) {
  const argv = process.argv.slice(2);
  const idx = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (idx < 0) return null;
  const raw = argv[idx];
  if (raw.includes('=')) return raw.split('=').slice(1).join('=');
  return argv[idx + 1] || null;
}

let shop;
let token;
let scope;
try {
  const auth = await resolveAdminToken();
  shop = auth.shop;
  token = auth.token;
  scope = auth.scope || '';
  console.log(
    `Auth: ${auth.source}` +
      (auth.expiresIn ? ` (expires in ~${Math.round(auth.expiresIn / 3600)}h)` : '')
  );
  if (scope) console.log(`Scopes: ${scope}`);
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}

const endpoint = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;

async function gql(query, variables = {}) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    console.error('GraphQL failed:', JSON.stringify(json, null, 2));
    process.exit(1);
  }
  return json.data;
}

const data = await gql(
  `#graphql
  query ($handle: String!) {
    productByHandle(handle: $handle) {
      id title
      variants(first: 5) {
        nodes {
          id
          legacyResourceId
          availableForSale
          inventoryQuantity
          inventoryPolicy
          sellableOnlineQuantity
          inventoryItem { id tracked }
          requiresComponents
          productVariantComponents(first: 5) { nodes { id } }
        }
      }
    }
  }`,
  { handle: BETTER_BOX_HANDLE }
);

const product = data.productByHandle;
if (!product) {
  console.error(`Product not found: ${BETTER_BOX_HANDLE}`);
  process.exit(1);
}

const variant = product.variants.nodes[0];
if (!variant) {
  console.error('Better Box has no variants');
  process.exit(1);
}

console.log('\nBefore:');
console.log(`  ${product.title} · variant ${variant.legacyResourceId}`);
console.log(`  tracked: ${variant.inventoryItem.tracked}`);
console.log(`  policy: ${variant.inventoryPolicy}`);
console.log(`  qty: ${variant.inventoryQuantity}`);
console.log(`  sellableOnlineQuantity: ${variant.sellableOnlineQuantity}`);
console.log(`  availableForSale: ${variant.availableForSale}`);
console.log(`  requiresComponents: ${variant.requiresComponents}`);

const restRes = await fetch(
  `https://${shop}/admin/api/${API_VERSION}/variants/${variant.legacyResourceId}.json`,
  {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({
      variant: {
        id: Number(variant.legacyResourceId),
        inventory_policy: 'continue',
        inventory_management: 'shopify',
      },
    }),
  }
);
const restJson = await restRes.json();
if (!restRes.ok) {
  console.error('Variant update failed:', JSON.stringify(restJson, null, 2));
  process.exit(1);
}

const bulk = await gql(
  `#graphql
  mutation ($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants {
        id
        inventoryPolicy
        availableForSale
        sellableOnlineQuantity
        inventoryQuantity
        inventoryItem { tracked }
      }
      userErrors { field message }
    }
  }`,
  {
    productId: product.id,
    variants: [
      {
        id: variant.id,
        inventoryPolicy: 'CONTINUE',
      },
    ],
  }
);

const bulkErrors = bulk.productVariantsBulkUpdate.userErrors;
if (bulkErrors?.length) {
  console.error('Bulk update errors:', JSON.stringify(bulkErrors, null, 2));
  process.exit(1);
}

const qtyArg = argValue('--qty');
const dummyQty = qtyArg != null ? Number(qtyArg) : DEFAULT_DUMMY_QTY;
const setQty = argValue('--set-qty') != null || scope.includes('write_inventory');

if (setQty && scope.includes('write_inventory')) {
  const qtyRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({
      query: `#graphql
        mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
          inventorySetQuantities(input: $input) {
            userErrors { field message code }
          }
        }`,
      variables: {
        input: {
          name: 'available',
          reason: 'correction',
          ignoreCompareQuantity: true,
          quantities: [
            {
              inventoryItemId: variant.inventoryItem.id,
              locationId: DEFAULT_LOCATION_ID,
              quantity: dummyQty,
            },
          ],
        },
      },
    }),
  });
  const qtyJson = await qtyRes.json();
  const qtyErrors = qtyJson.data?.inventorySetQuantities?.userErrors;
  if (qtyErrors?.length) {
    console.error('Inventory set errors:', JSON.stringify(qtyErrors, null, 2));
    process.exit(1);
  }
  console.log(`\nSet dummy available qty: ${dummyQty} at ${DEFAULT_LOCATION_ID}`);
} else if (setQty) {
  console.warn(
    '\nSkipping dummy qty — Brisa Admin app needs write_inventory + read_locations scopes.'
  );
  console.warn(
    'Appstle ON_SALE still requires sellableOnlineQuantity > 0 — set dummy qty in Admin or grant write_inventory.'
  );
  console.warn(
    `Or set qty manually in Admin, then re-run with --set-qty once scopes are granted.`
  );
}

const after = await gql(
  `#graphql
  query ($id: ID!) {
    productVariant(id: $id) {
      availableForSale
      inventoryPolicy
      inventoryQuantity
      sellableOnlineQuantity
      inventoryItem { tracked }
      requiresComponents
    }
  }`,
  { id: variant.id }
);

const v = after.productVariant;
console.log('\nAfter:');
console.log(`  tracked: ${v.inventoryItem.tracked}`);
console.log(`  policy: ${v.inventoryPolicy}`);
console.log(`  qty: ${v.inventoryQuantity}`);
console.log(`  sellableOnlineQuantity: ${v.sellableOnlineQuantity}`);
console.log(`  availableForSale: ${v.availableForSale}`);
console.log(
  '\nTheme still gates MBB on Mint / Raspberry / Cherry cores stock. Flow decrements cores on order.'
);
