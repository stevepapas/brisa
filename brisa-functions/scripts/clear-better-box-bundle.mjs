/**
 * Removes Fixed Bundle components from Monthly Better Box.
 *
 * Shopify Fixed Bundles (requiresComponents) are incompatible with selling
 * plans / subscriptions. Appstle ATC fails with "already sold out" even when
 * Brisa Cores have stock. Clear the BOM so MBB is a normal subscription
 * product again; the theme gates availability on core stock.
 *
 *   npm run clear:better-box
 */

import { loadDotEnv, resolveAdminToken } from './admin-auth.mjs';

loadDotEnv();

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
const BETTER_BOX_HANDLE = process.env.BETTER_BOX_HANDLE || 'monthly-better-box';

let shop;
let token;
try {
  const auth = await resolveAdminToken();
  shop = auth.shop;
  token = auth.token;
  console.log(
    `Auth: ${auth.source}` +
      (auth.expiresIn ? ` (expires in ~${Math.round(auth.expiresIn / 3600)}h)` : '')
  );
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
  if (!res.ok || json.errors) {
    console.error('GraphQL failed:', JSON.stringify(json, null, 2));
    process.exit(1);
  }
  return json.data;
}

const data = await gql(
  `#graphql
  query ($handle: String!) {
    productByHandle(handle: $handle) {
      title
      variants(first: 10) {
        nodes {
          id
          title
          availableForSale
          inventoryQuantity
          requiresComponents
          productVariantComponents(first: 20) {
            nodes {
              id
              quantity
              productVariant { id displayName inventoryQuantity }
            }
          }
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

const parent = product.variants.nodes[0];
if (!parent) {
  console.error('Better Box has no variants');
  process.exit(1);
}

const components = parent.productVariantComponents.nodes;
console.log('Parent:', product.title, parent.id);
console.log('requiresComponents:', parent.requiresComponents);
console.log('inventoryQuantity:', parent.inventoryQuantity);
console.log('availableForSale:', parent.availableForSale);

if (!components.length && !parent.requiresComponents) {
  console.log('\nAlready clear — no Fixed Bundle components.');
  process.exit(0);
}

if (components.length) {
  console.log('\nRemoving components:');
  for (const c of components) {
    console.log(
      `  ${c.quantity} × ${c.productVariant.displayName} (stock ${c.productVariant.inventoryQuantity})`
    );
  }
}

const update = await gql(
  `#graphql
  mutation ClearBetterBoxBundle($input: [ProductVariantRelationshipUpdateInput!]!) {
    productVariantRelationshipBulkUpdate(input: $input) {
      parentProductVariants {
        id
        requiresComponents
        availableForSale
        inventoryQuantity
        inventoryItem { tracked }
        productVariantComponents(first: 5) {
          nodes { id }
        }
      }
      userErrors { code field message }
    }
  }`,
  {
    input: [
      {
        parentProductVariantId: parent.id,
        // Prefer removeAll so requiresComponents flips back to false.
        removeAllProductVariantRelationships: true,
      },
    ],
  }
);

const payload = update.productVariantRelationshipBulkUpdate;
if (payload.userErrors?.length) {
  console.error('User errors:', JSON.stringify(payload.userErrors, null, 2));
  process.exit(1);
}

const result = payload.parentProductVariants?.[0];
console.log('\nCleared.');
console.log('requiresComponents:', result?.requiresComponents);
console.log('availableForSale:', result?.availableForSale);
console.log('inventoryQuantity:', result?.inventoryQuantity);
console.log('tracked:', result?.inventoryItem?.tracked);
console.log('remaining components:', result?.productVariantComponents?.nodes?.length || 0);
console.log(
  '\nMBB can take Appstle selling plans again. Theme gates UI on Brisa Cores stock.'
);
