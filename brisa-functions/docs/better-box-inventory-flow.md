# Shopify Flow: Better Box → decrement cores

Shopify Fixed Bundles can’t run with Appstle selling plans. This Flow is the inventory path:

**When an order contains Monthly Better Box (checkout or Appstle renewal), decrement the BOM cores.**

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
- Kit page hides the add-on unless Mint Ice, Raspberry Lime, and Cherry Pom are all available
- MBB inventory tracking stays **off** — cores are the source of truth
