/**
 * Activates the deployed Brisa Kit Bundle cart transform on a shop.
 *
 * Prerequisites:
 *   1. `shopify app deploy` completed
 *   2. App installed on the store
 *   3. Env vars set (see README)
 *
 * Usage:
 *   SHOP=your-store.myshopify.com ADMIN_TOKEN=shpat_xxx npm run activate
 */

const SHOP = process.env.SHOP?.replace(/^https?:\/\//, '').replace(/\/$/, '');
const TOKEN = process.env.ADMIN_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
const FUNCTION_HANDLE = process.env.FUNCTION_HANDLE || 'brisa-kit-bundle';

if (!SHOP || !TOKEN) {
  console.error('Missing SHOP or ADMIN_TOKEN env vars.');
  console.error('Example: SHOP=brisa.myshopify.com ADMIN_TOKEN=shpat_xxx npm run activate');
  process.exit(1);
}

const endpoint = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;

const mutation = `#graphql
  mutation CartTransformCreate($functionHandle: String!, $blockOnFailure: Boolean) {
    cartTransformCreate(functionHandle: $functionHandle, blockOnFailure: $blockOnFailure) {
      cartTransform {
        id
        functionId
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const res = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': TOKEN,
  },
  body: JSON.stringify({
    query: mutation,
    variables: {
      functionHandle: FUNCTION_HANDLE,
      blockOnFailure: false,
    },
  }),
});

const json = await res.json();
if (!res.ok || json.errors) {
  console.error('Request failed:', JSON.stringify(json, null, 2));
  process.exit(1);
}

const payload = json.data?.cartTransformCreate;
if (payload?.userErrors?.length) {
  console.error('User errors:', JSON.stringify(payload.userErrors, null, 2));
  process.exit(1);
}

console.log('Cart transform activated:', payload.cartTransform);
