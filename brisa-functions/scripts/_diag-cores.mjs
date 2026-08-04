import { loadDotEnv, resolveAdminToken } from './admin-auth.mjs';

loadDotEnv();

const auth = await resolveAdminToken();
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
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
  return res.json();
}

const cores = await gql(
  `#graphql
  query ($handle: String!) {
    productByHandle(handle: $handle) {
      id title handle
      variants(first: 20) {
        nodes {
          id title legacyResourceId availableForSale sellableOnlineQuantity inventoryQuantity inventoryPolicy
        }
      }
    }
  }`,
  { handle: 'brisa-cores' }
);

console.log(JSON.stringify(cores, null, 2));
