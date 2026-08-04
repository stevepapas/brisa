/**
 * Switch Monthly Better Box Appstle plan inventory reserve to ON_FULFILLMENT.
 *
 * Appstle-owned selling plan groups cannot be updated via Shopify Admin GraphQL
 * (sellingPlanGroupUpdate returns "Selling plan group does not exist"). With
 * inventoryPolicyReserve ON_SALE, /cart/add.js checks MBB sellable qty at cart
 * time even when Brisa Cores are in stock. ON_FULFILLMENT reserves at ship time.
 *
 * Requires Appstle Admin API key (merchant portal → Settings → API / Integrations).
 *
 *   APPSTLE_API_KEY=sk_live_… npm run setup:better-box-appstle-plan
 *
 * Optional dry run:
 *   npm run setup:better-box-appstle-plan -- --dry-run
 */

import { loadDotEnv } from './admin-auth.mjs';

loadDotEnv();

const API_BASE = process.env.APPSTLE_API_BASE || 'https://subscription-admin.appstle.com';
const API_KEY = process.env.APPSTLE_API_KEY;
const GROUP_ID = Number(process.env.APPSTLE_GROUP_ID || 81208377716);
const PLAN_GID = process.env.APPSTLE_PLAN_GID || 'gid://shopify/SellingPlan/694395470196';
const dryRun = process.argv.includes('--dry-run');

if (!API_KEY) {
  console.error(
    'Missing APPSTLE_API_KEY. Appstle merchant portal → Settings → API / Integrations.\n' +
      'Then: APPSTLE_API_KEY=sk_live_… npm run setup:better-box-appstle-plan'
  );
  process.exit(1);
}

/** Current plan shape from live Appstle widget + Admin API (2026-07-25). */
const body = {
  id: GROUP_ID,
  groupName: 'Monthly Better Box',
  subscriptionPlans: [
    {
      idNew: PLAN_GID,
      groupId: GROUP_ID,
      groupName: 'Monthly Better Box',
      frequencyName: 'Monthly Subscription',
      frequencyDescription: '',
      frequencyCount: 4,
      frequencyInterval: 'WEEK',
      billingFrequencyCount: 4,
      billingFrequencyInterval: 'WEEK',
      frequencyType: 'ON_PURCHASE_DAY',
      planType: 'PAY_AS_YOU_GO',
      deliveryPolicyPreAnchorBehavior: 'ASAP',
      inventoryPolicyReserve: 'ON_FULFILLMENT',
      discountEnabled: false,
      discountEnabled2: false,
      freeTrialEnabled: false,
      memberOnly: false,
      nonMemberOnly: false,
      afterCycle1: 0,
      afterCycle2: 0,
      cutOff: 0,
      formFieldJson: '[]',
      appstleCycles: [],
    },
  ],
  updateProducts: {
    productIds: [15171159949684],
  },
};

console.log('Appstle subscription group update');
console.log(`  group id: ${GROUP_ID}`);
console.log(`  plan: ${PLAN_GID}`);
console.log(`  inventoryPolicyReserve: ON_FULFILLMENT (was ON_SALE)`);

if (dryRun) {
  console.log('\nDry run — request body:');
  console.log(JSON.stringify(body, null, 2));
  process.exit(0);
}

const res = await fetch(`${API_BASE}/api/external/v2/subscription-groups`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  },
  body: JSON.stringify(body),
});

const text = await res.text();
let json;
try {
  json = text ? JSON.parse(text) : {};
} catch {
  json = { raw: text };
}

if (!res.ok) {
  console.error(`Appstle API failed (${res.status}):`, JSON.stringify(json, null, 2));
  console.error(
    '\nIf no API key: change manually in Appstle → Plans → Monthly Better Box → Monthly Subscription → Advanced → Reserve inventory → On fulfillment.'
  );
  process.exit(1);
}

console.log('\nSuccess:', JSON.stringify(json, null, 2));
console.log('\nVerify in Shopify Admin GraphQL: selling plan 694395470196 inventoryPolicy.reserve should be ON_FULFILLMENT.');
console.log('Then retest MBB add on Brisa Cores (hard refresh).');
