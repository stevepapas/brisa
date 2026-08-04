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

const variantQ = `#graphql
  query MbbVariant($id: ID!) {
    productVariant(id: $id) {
      id
      legacyResourceId
      availableForSale
      sellableOnlineQuantity
      sellingPlanGroups(first: 10) {
        nodes {
          name
          appId
          sellingPlans(first: 10) {
            nodes {
              id
              name
              inventoryPolicy {
                reserve
              }
            }
          }
        }
      }
      sellingPlanAllocations(first: 10) {
        nodes {
          sellingPlan {
            id
            name
            inventoryPolicy {
              reserve
            }
          }
        }
      }
    }
  }`;

const variant = await gql(variantQ, {
  id: 'gid://shopify/ProductVariant/55004269412724',
});

console.log(JSON.stringify(variant, null, 2));
