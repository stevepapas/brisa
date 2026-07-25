/**
 * Decrement Brisa Cores flavour packs when a Variety line appears on an order.
 *
 * Requires Brisa Admin scopes: write_inventory, read_locations (and read_orders
 * if you pass an order GID). Prefer Shopify Flow when those scopes are missing
 * — see docs/variety-inventory-flow.md.
 *
 * Usage:
 *   LOCATION_ID=gid://shopify/Location/123 npm run variety:decrement -- --units=3
 *   LOCATION_ID=... npm run variety:decrement -- --order=gid://shopify/Order/123
 *
 * Idempotent per order when --order is used (metafield brisa.variety_cores_adjusted).
 */

import { loadDotEnv, resolveAdminToken } from './admin-auth.mjs';
import {
  VARIETY_BOM,
  countVarietyUnits,
  flavourPacksForVarietyUnits,
} from './lib/variety-bom.mjs';

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
        metafield(namespace: "brisa", key: "variety_cores_adjusted") { value }
        lineItems(first: 50) {
          nodes {
            quantity
            title
            variant { id title }
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

async function markOrderAdjusted(orderId, units) {
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
        key: 'variety_cores_adjusted',
        type: 'number_integer',
        value: String(units),
      },
    }
  );
}

async function adjustCores({ locationId, varietyUnits, referenceUri }) {
  const { packsEach, remainderUnits } = flavourPacksForVarietyUnits(varietyUnits);
  if (packsEach <= 0) {
    console.log('No whole flavour packs to adjust for Variety qty', varietyUnits);
    if (remainderUnits > 0) {
      console.warn(
        `Remainder ${remainderUnits} Variety unit(s) not applied (need multiples of 3).`
      );
    }
    return null;
  }

  if (remainderUnits > 0) {
    console.warn(
      `Variety qty ${varietyUnits} leaves remainder ${remainderUnits}; decrementing ${packsEach} pack(s) each only.`
    );
  }

  const changes = VARIETY_BOM.map((row) => ({
    delta: -packsEach,
    inventoryItemId: row.inventoryItemId,
    locationId,
  }));

  console.log(`Adjusting cores for ${varietyUnits} × Variety (= ${packsEach} pack/flavour):`);
  for (const row of VARIETY_BOM) {
    console.log(`  ${-packsEach} × ${row.flavour}`);
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
        referenceDocumentUri: referenceUri || `brisa://variety/${Date.now()}`,
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
const unitsArg = argValue('--units');

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
      variant_title: n.variant?.title,
      product_id: n.product?.id,
      variant_id: n.variant?.id,
      handle: n.product?.handle,
    }));
    const units = countVarietyUnits(lines);
    console.log(`Order ${order.name}: ${units} × Variety`);
    await adjustCores({
      locationId,
      varietyUnits: units,
      referenceUri: `gid://shopify/Order/${order.id.split('/').pop()}`,
    });
    if (units > 0) await markOrderAdjusted(order.id, units);
  } else {
    const units = Number(unitsArg || 3);
    if (!Number.isFinite(units) || units <= 0) {
      console.error('Pass --units=N or --order=gid://shopify/Order/…');
      process.exit(1);
    }
    await adjustCores({ locationId, varietyUnits: units });
  }
} catch (err) {
  console.error(err.message || err);
  if (err.payload) console.error(JSON.stringify(err.payload, null, 2));
  if (/access denied|write_inventory|read_locations|read_orders/i.test(String(err.message))) {
    console.error(
      '\nAdd scopes on Brisa Admin (Dev Dashboard), reinstall/approve, then retry:\n' +
        '  read_orders, write_inventory, read_inventory, read_locations\n' +
        'Or use Shopify Flow — docs/variety-inventory-flow.md (no app scope change).'
    );
  }
  process.exit(1);
}
