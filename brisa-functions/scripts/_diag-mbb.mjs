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

const planQ = `#graphql
  query PlanNode($id: ID!) {
    node(id: $id) {
      ... on SellingPlan {
        id
        name
        inventoryPolicy {
          reserve
        }
      }
    }
  }`;

const variantQ = `#graphql
  query MbbVariant($id: ID!) {
    productVariant(id: $id) {
      id
      title
      legacyResourceId
      availableForSale
      sellableOnlineQuantity
      inventoryQuantity
      inventoryPolicy
      inventoryItem {
        id
        tracked
      }
      requiresComponents
      productVariantComponents(first: 5) {
        nodes {
          id
        }
      }
      product {
        id
        title
        handle
        status
        publishedAt
        requiresSellingPlan
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
      }
    }
  }`;

const [plan, variant] = await Promise.all([
  gql(planQ, { id: 'gid://shopify/SellingPlan/694395470196' }),
  gql(variantQ, { id: 'gid://shopify/ProductVariant/55004269412724' }),
]);

console.log(JSON.stringify({ authSource: auth.source, scope: auth.scope, plan, variant }, null, 2));
