# Shopify Flow: Better Box → decrement cores

Shopify Fixed Bundles can’t run with Appstle selling plans. This Flow is the **post-purchase** inventory path:

**When an order contains Monthly Better Box (checkout or Appstle renewal), decrement the BOM cores.**

## What Flow does vs what it does not

| Layer | When | What happens |
|---|---|---|
| **Theme** (kit + cores pages) | Pre-cart UX | Hides MBB unless Mint Ice, Raspberry Lime, and Cherry Pom are all available on `brisa-cores`. Same logic in `brisa-kit-purchase.liquid` and `snippets/brisa-cores-better-box.liquid`. |
| **Shopify cart** (`/cart/add.js`) | Add to cart | Validates **MBB’s own** sellable quantity. Appstle’s plan uses `inventoryPolicyReserve: ON_SALE`, so MBB needs tracked inventory with a dummy qty (or Appstle set to **On fulfillment**). Flow does **not** run here. |
| **Shopify Flow** (this doc) | Order created / renewal | Decrements Mint, Raspberry, and Cherry **core** inventory by −1 each per box. Does **not** increment or sync MBB qty from cores. |

**“Inventory derives from the flavour variants”** means cores are the **business** source of truth: the theme gates on them, and Flow decrements them after purchase. It does **not** mean Shopify’s cart API reads core stock when adding MBB — that only worked with native Fixed Bundles, which break Appstle subscriptions.

There is **no** Flow that sets or increments MBB availability from core stock — only the order-created decrement on the three core SKUs (plus optional idempotency tag `better-box-cores-adjusted`).

## BOM (per box)

| Core flavour | Inventory item GID | Qty |
|---|---|---|
| Mint Ice | `gid://shopify/InventoryItem/55551578177908` | −1 |
| Raspberry Lime | `gid://shopify/InventoryItem/55888831676788` | −1 |
| Cherry Pomegranate | `gid://shopify/InventoryItem/55888831644020` | −1 |

Product ID: `15171159949684` · Handle: `monthly-better-box`

## Create the Flow (≈5 minutes)

1. Shopify Admin → **Apps** → **Flow** → **Create workflow**
2. Trigger: **Order created**
3. Condition: **Order → Line items → Product ID**  
   - Equal to `15171159949684`  
   - (Or: Product title contains `Monthly better box`)
4. Action: **Send Admin API request**
   - Mutation: `inventoryAdjustQuantities`
   - API version: `2025-01` (or latest available)

### Mutation

```graphql
mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
  inventoryAdjustQuantities(input: $input) {
    userErrors { field message }
    inventoryAdjustmentGroup { createdAt reason }
  }
}
```

### Variables (replace `LOCATION_ID`)

Find location ID: **Settings → Locations →** open your warehouse → copy the number from the URL  
(`.../locations/123456789` → `gid://shopify/Location/123456789`).

Brisa’s primary location is already filled in below (`114492866932`). Only change it if you stock cores elsewhere.

Most orders are 1× Better Box. Start with fixed `-1` deltas (reliable in Flow). If you ever sell multiple boxes on one order, switch to a **For each** line-item loop and use `-{{lineItemsForeachitem.quantity}}`.

Primary location (from shop): `gid://shopify/Location/114492866932`

```json
{
  "input": {
    "reason": "correction",
    "name": "available",
    "referenceDocumentUri": "brisa://better-box/{{order.id}}",
    "changes": [
      {
        "delta": -1,
        "inventoryItemId": "gid://shopify/InventoryItem/55551578177908",
        "locationId": "gid://shopify/Location/114492866932"
      },
      {
        "delta": -1,
        "inventoryItemId": "gid://shopify/InventoryItem/55888831676788",
        "locationId": "gid://shopify/Location/114492866932"
      },
      {
        "delta": -1,
        "inventoryItemId": "gid://shopify/InventoryItem/55888831644020",
        "locationId": "gid://shopify/Location/114492866932"
      }
    ]
  }
}
```
5. **Turn on** the workflow.
6. Place a test order with Better Box checked (or wait for a renewal) and confirm Mint / Raspberry / Cherry stock each drop by 1.

## Optional: tag for idempotency

Add a second action after a successful adjust: **Add order tags** → `better-box-cores-adjusted`.  
Add a condition at the top: order tags do **not** include `better-box-cores-adjusted` (avoids double-runs if the Flow is re-triggered).

## Theme / product setup (already done)

- MBB is **not** a Fixed Bundle (so Appstle works)
- Kit + cores pages hide the add-on unless Mint Ice, Raspberry Lime, and Cherry Pom are all available
- **MBB Shopify inventory is a dummy gate only** — flavour cores are the source of truth

### Why cart/add still says “already sold out”

Appstle’s plan uses **`inventoryPolicyReserve: ON_SALE`**. At cart time Shopify checks
MBB’s own **sellable** quantity (`sellableOnlineQuantity`), not Brisa Cores stock.
With qty **0** (even with **`inventory_policy: continue`**), `/cart/add.js` returns
*“The product 'Monthly better box' is already sold out”* while cores are in stock.

This affects **both** the devices kit page and the cores picker — they use the same
MBB product, selling plan, and `/cart/add.js` + `selling_plan` payload. If one fails at
cart time, the other would too.

**Fix (Admin — completes the architecture, does not contradict Flow):**

1. MBB variant → **Track quantity** + **Continue selling when out of stock**  
   (CLI: `npm run setup:better-box-inventory` — needs `write_products`)
2. Set a high **dummy available qty** on MBB (e.g. 9999) — Admin → Products → Monthly
   better box → Inventory, or re-run `npm run setup:better-box-inventory -- --set-qty`
   once the Brisa Admin app has **`write_inventory`** + **`read_locations`**. Cores remain
   the real gate via theme + Flow decrements.
3. Do **not** re-add Fixed Bundle components (`npm run clear:better-box` if needed)

Alternative: in Appstle, change the plan inventory policy from **On sale** to **On fulfillment** (reserves inventory at ship time instead of cart time).

**Live check (2026-07):** MBB is tracked, `CONTINUE`, Fixed Bundle cleared, Appstle
`ON_SALE`, but `sellableOnlineQuantity: 0` — dummy qty is the remaining step.
