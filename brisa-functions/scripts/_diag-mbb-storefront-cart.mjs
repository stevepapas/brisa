import { loadDotEnv, resolveAdminToken } from './admin-auth.mjs';

loadDotEnv();

const auth = await resolveAdminToken();
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
const adminEndpoint = `https://${auth.shop}/admin/api/${API_VERSION}/graphql.json`;

async function adminGql(query, variables = {}) {
  const res = await fetch(adminEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': auth.token,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

const tokenRes = await adminGql(
  `#graphql
  mutation StorefrontTokenCreate {
    storefrontAccessTokenCreate(input: { title: "diag-mbb-temp" }) {
      storefrontAccessToken {
        accessToken
      }
      userErrors {
        message
      }
    }
  }`
);

console.log('tokenRes:', JSON.stringify(tokenRes, null, 2));

const sfToken =
  tokenRes.data?.storefrontAccessTokenCreate?.storefrontAccessToken?.accessToken;
if (!sfToken) {
  process.exit(1);
}

const sfEndpoint = `https://${auth.shop}/api/${API_VERSION}/graphql.json`;
const cartRes = await fetch(sfEndpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Storefront-Access-Token': sfToken,
  },
  body: JSON.stringify({
    query: `#graphql
      mutation CartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
            lines(first: 5) {
              nodes {
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    availableForSale
                  }
                }
                sellingPlanAllocation {
                  sellingPlan {
                    id
                    name
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }`,
    variables: {
      input: {
        lines: [
          {
            merchandiseId: 'gid://shopify/ProductVariant/55004269412724',
            quantity: 1,
            sellingPlanId: 'gid://shopify/SellingPlan/694395470196',
          },
        ],
      },
    },
  }),
});

console.log('cartRes:', JSON.stringify(await cartRes.json(), null, 2));
