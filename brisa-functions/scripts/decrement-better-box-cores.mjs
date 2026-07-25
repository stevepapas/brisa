/**
 * Decrement Brisa Cores BOM when Monthly Better Box appears on an order.
 *
 * Requires Brisa Admin scopes: write_inventory, read_locations (and read_orders
 * if you pass an order GID instead of box quantity).
 *
 * Usage:
 *   LOCATION_ID=gid://shopify/Location/123 npm run better-box:decrement -- --boxes=1
 *   LOCATION_ID=... npm run better-box:decrement -- --order=gid://shopify/Order/123
 *
 * Idempotent per order when --order is used (metafield brisa.better_box_cores_adjusted).
 */

import { loadDotEnv, resolveAdminToken } from './admin-auth.mjs';
import {
  BETTER_BOX_BOM,
  BETTER_BOX_HANDLE,
  countBetterBoxes,
} from './lib/better-box-bom.mjs';

loadDotEnv();

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';

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
try {
  const auth = await resolveAdminToken();
  shop = auth.shop;
  token = auth.token;
  console.log(`Auth: ${auth.source}` + (auth.scope ? `\nScopes: ${auth.scope}` : ''));
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
    const msg = json.errors.map((e) => e.message).join('; ');
    const err = new Error(msg);
    err.payload = json;
    throw err;
  }
  return json.data;
}

async function resolveLocationId() {
  if (process.env.LOCATION_ID) return process.env.LOCATION_ID;

  const data = await gql(`#graphql
    query {
      locations(first: 20, includeInactive: false) {
        nodes { id name isActive fulfillsOnlineOrders }
      }
    }
  `);
  const nodes = data.locations?.nodes || [];
  const online = nodes.find((l) => l.fulfillsOnlineOrders && l.isActive) || nodes[0];
  if (!online) throw new Error('No location found. Set LOCATION_ID=gid://shopify/Location/…');
  console.log(`Using location: ${online.name} (${online.id})`);
  return online.id;
}

async function loadOrder(orderId) {
  const id = orderId.startsWith('gid://')
    ? orderId
    : `gid://shopify/Order/${orderId}`;
  const data = await gql(
    `#graphql
    query ($id: ID!) {
      order(id: $id) {
        id
        name
        tags
        metafield(namespace: "brisa", key: "better_box_cores_adjusted") { value }
        lineItems(first: 50) {
          nodes {
            quantity
            title
            variant { id }
            product { id handle title }
          }
        }
      }
    }`,
    { id }
  );
  if (!data.order) throw new Error(`Order not found: ${id}`);
  return data.order;
}

async function markOrderAdjusted(orderId, boxes) {
  await gql(
    `#graphql
    mutation ($input: MetafieldsSetInput!) {
      metafieldsSet(metafields: [$input]) {
        userErrors { field message }
      }
    }`,
    {
      input: {
        ownerId: orderId,
        namespace: 'brisa',
        key: 'better_box_cores_adjusted',
        type: 'number_integer',
        value: String(boxes),
      },
    }
  );
}

async function adjustCores({ locationId, boxes, referenceUri }) {
  if (boxes <= 0) {
    console.log('No Better Box lines to adjust.');
    return null;
  }

  const changes = BETTER_BOX_BOM.map((row) => ({
    delta: -(row.quantityPerBox * boxes),
    inventoryItemId: row.inventoryItemId,
    locationId,
  }));

  console.log(`Adjusting cores for ${boxes} × Better Box:`);
  for (const row of BETTER_BOX_BOM) {
    console.log(`  ${-(row.quantityPerBox * boxes)} × ${row.flavour}`);
  }

  const data = await gql(
    `#graphql
    mutation ($input: InventoryAdjustQuantitiesInput!) {
      inventoryAdjustQuantities(input: $input) {
        userErrors { field message code }
        inventoryAdjustmentGroup {
          createdAt
          reason
          referenceDocumentUri
          changes { name delta }
        }
      }
    }`,
    {
      input: {
        reason: 'correction',
        name: 'available',
        referenceDocumentUri: referenceUri || `brisa://better-box/${Date.now()}`,
        changes,
      },
    }
  );

  const payload = data.inventoryAdjustQuantities;
  if (payload.userErrors?.length) {
    console.error('User errors:', JSON.stringify(payload.userErrors, null, 2));
    process.exit(1);
  }
  console.log('OK:', JSON.stringify(payload.inventoryAdjustmentGroup, null, 2));
  return payload.inventoryAdjustmentGroup;
}

const locationId = await resolveLocationId();
const orderArg = argValue('--order');
const boxesArg = argValue('--boxes');

try {
  if (orderArg) {
    const order = await loadOrder(orderArg);
    if (order.metafield?.value) {
      console.log(
        `Order ${order.name} already adjusted (metafield=${order.metafield.value}). Skipping.`
      );
      process.exit(0);
    }
    const lines = (order.lineItems?.nodes || []).map((n) => ({
      quantity: n.quantity,
      title: n.title,
      product_id: n.product?.id,
      variant_id: n.variant?.id,
      handle: n.product?.handle,
    }));
    const boxes = countBetterBoxes(lines);
    console.log(`Order ${order.name}: ${boxes} × ${BETTER_BOX_HANDLE}`);
    await adjustCores({
      locationId,
      boxes,
      referenceUri: `gid://shopify/Order/${order.id.split('/').pop()}`,
    });
    if (boxes > 0) await markOrderAdjusted(order.id, boxes);
  } else {
    const boxes = Number(boxesArg || 1);
    if (!Number.isFinite(boxes) || boxes <= 0) {
      console.error('Pass --boxes=N or --order=gid://shopify/Order/…');
      process.exit(1);
    }
    await adjustCores({ locationId, boxes });
  }
} catch (err) {
  console.error(err.message || err);
  if (err.payload) console.error(JSON.stringify(err.payload, null, 2));
  if (/access denied|write_inventory|read_locations|read_orders/i.test(String(err.message))) {
    console.error(
      '\nAdd scopes on Brisa Admin (Dev Dashboard), reinstall/approve, then retry:\n' +
        '  read_orders, write_inventory, read_inventory, read_locations'
    );
  }
  process.exit(1);
}
