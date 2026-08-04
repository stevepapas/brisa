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
  const json = await res.json();
  return json;
}

const draft = await gql(
  `#graphql
  mutation DraftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
        lineItems(first: 5) {
          nodes {
            title
            quantity
            variant { id legacyResourceId }
          }
        }
      }
      userErrors { field message }
    }
  }`,
  {
    input: {
      lineItems: [
        {
          variantId: 'gid://shopify/ProductVariant/55004269412724',
          quantity: 1,
          sellingPlanId: 'gid://shopify/SellingPlan/694395470196',
        },
      ],
    },
  }
);

console.log(JSON.stringify(draft, null, 2));
