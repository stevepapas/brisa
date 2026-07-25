/**
 * Turns Monthly Better Box into a variant Fixed Bundle whose inventory
 * comes from Brisa Cores flavour variants (each core SKU = 3-pack).
 *
 * ⚠️  DO NOT RUN while Monthly Better Box has an Appstle / selling plan.
 * Shopify Fixed Bundles cannot combine with purchase options — cart/add
 * fails with "already sold out". Prefer `npm run clear:better-box` and let
 * the theme gate availability on Brisa Cores stock instead.
 *
 * Default BOM (3 × 3-packs = 9 cores):
 *   1 × Mint Ice
 *   1 × Raspberry Lime
 *   1 × Cherry Pomegranate  (the free Cherry Pom pack)
 *
 * Auth (Dev Dashboard app — preferred):
 *   Put credentials in brisa-functions/.env then run:
 *     npm run setup:better-box
 *
 *   SHOP=whsuhd-8u.myshopify.com
 *   CLIENT_ID=...
 *   CLIENT_SECRET=shpss_...
 *
 * Or pass a short-lived ADMIN_TOKEN=shpat_... directly.
 *
 * App must be installed on the shop with write_products + read_products.
 */

if (!process.env.ALLOW_FIXED_BUNDLE_WITH_SUBSCRIPTION) {
  console.error(
    'Refusing to create a Fixed Bundle on Monthly Better Box.\n' +
      'Native Fixed Bundles break Appstle selling plans (cart shows sold out).\n' +
      'Use: npm run clear:better-box\n' +
      'Or set ALLOW_FIXED_BUNDLE_WITH_SUBSCRIPTION=1 to force (not recommended).'
  );
  process.exit(1);
}

import { loadDotEnv, resolveAdminToken } from './admin-auth.mjs';

loadDotEnv();

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
const BETTER_BOX_HANDLE = process.env.BETTER_BOX_HANDLE || 'monthly-better-box';
const CORES_HANDLE = process.env.CORES_HANDLE || 'brisa-cores';
const CHERRY_QTY = Number(process.env.CHERRY_QTY || 1);

let shop;
let token;
try {
  const auth = await resolveAdminToken();
  shop = auth.shop;
  token = auth.token;
  console.log(
    `Auth: ${auth.source}` +
      (auth.expiresIn ? ` (expires in ~${Math.round(auth.expiresIn / 3600)}h)` : '') +
      (auth.scope ? `\nScopes: ${auth.scope}` : '')
  );
} catch (err) {
  console.error(err.message || err);
  console.error('\nCreate brisa-functions/.env with:');
  console.error('  SHOP=whsuhd-8u.myshopify.com');
  console.error('  CLIENT_ID=...');
  console.error('  CLIENT_SECRET=shpss_...');
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
  query BundleSources($box: String!, $cores: String!) {
    box: productByHandle(handle: $box) {
      id
      title
      variants(first: 10) {
        nodes {
          id
          title
          displayName
          inventoryQuantity
          inventoryPolicy
          inventoryItem { tracked }
          requiresComponents
          productVariantComponents(first: 20) {
            nodes {
              id
              quantity
              productVariant { id displayName }
            }
          }
        }
      }
    }
    cores: productByHandle(handle: $cores) {
      id
      title
      variants(first: 50) {
        nodes {
          id
          title
          displayName
          inventoryQuantity
          availableForSale
        }
      }
    }
  }`,
  { box: BETTER_BOX_HANDLE, cores: CORES_HANDLE }
);

if (!data.box) {
  console.error(`Product not found: ${BETTER_BOX_HANDLE}`);
  process.exit(1);
}
if (!data.cores) {
  console.error(`Product not found: ${CORES_HANDLE}`);
  process.exit(1);
}

const parent = data.box.variants.nodes[0];
if (!parent) {
  console.error('Better Box has no variants');
  process.exit(1);
}

const byTitle = Object.fromEntries(
  data.cores.variants.nodes.map((v) => [v.title.trim().toLowerCase(), v])
);

function requireFlavour(name) {
  const v = byTitle[name.toLowerCase()];
  if (!v) {
    console.error(`Missing cores variant: ${name}`);
    console.error(
      'Available:',
      data.cores.variants.nodes.map((x) => x.title).join(', ')
    );
    process.exit(1);
  }
  return v;
}

const mint = requireFlavour('Mint Ice');
const raspberry = requireFlavour('Raspberry Lime');
const cherry = requireFlavour('Cherry Pomegranate');

const bom = [
  { variant: mint, quantity: 1 },
  { variant: raspberry, quantity: 1 },
  { variant: cherry, quantity: CHERRY_QTY },
];

console.log('Parent:', data.box.title, parent.id);
console.log('BOM (each cores variant = 3-pack):');
for (const row of bom) {
  console.log(
    `  ${row.quantity} × ${row.variant.title} (${row.variant.id}) stock=${row.variant.inventoryQuantity}`
  );
}
console.log(
  `Total packs: ${bom.reduce((n, r) => n + r.quantity, 0)} → ${
    bom.reduce((n, r) => n + r.quantity, 0) * 3
  } cores`
);

if (parent.productVariantComponents.nodes.length) {
  console.log('\nExisting components (will be removed first):');
  for (const c of parent.productVariantComponents.nodes) {
    console.log(
      `  ${c.quantity} × ${c.productVariant.displayName} (${c.productVariant.id})`
    );
  }
}

const removeIds = parent.productVariantComponents.nodes.map((c) => c.id);
const create = bom.map((row) => ({
  id: row.variant.id,
  quantity: row.quantity,
}));

const update = await gql(
  `#graphql
  mutation SetupBetterBoxBundle($input: [ProductVariantRelationshipUpdateInput!]!) {
    productVariantRelationshipBulkUpdate(input: $input) {
      parentProductVariants {
        id
        requiresComponents
        productVariantComponents(first: 20) {
          nodes {
            id
            quantity
            productVariant { id displayName inventoryQuantity }
          }
        }
      }
      userErrors { code field message }
    }
  }`,
  {
    input: [
      {
        parentProductVariantId: parent.id,
        ...(removeIds.length
          ? { productVariantRelationshipsToRemove: removeIds }
          : {}),
        productVariantRelationshipsToCreate: create,
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
console.log('\nBundle configured. requiresComponents =', result?.requiresComponents);
for (const c of result?.productVariantComponents?.nodes || []) {
  console.log(
    `  ${c.quantity} × ${c.productVariant.displayName} (stock ${c.productVariant.inventoryQuantity})`
  );
}
console.log(
  '\nNote: Better Box availability now follows component stock. Stock Cherry Pom + Raspberry Lime if they are at 0.'
);
