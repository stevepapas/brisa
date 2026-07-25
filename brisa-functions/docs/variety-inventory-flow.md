# Shopify Flow: Variety pack → decrement flavour cores

Variety is a **mixed 3-pack** on `brisa-cores` (same $15 unit as Mint / Cherry / Raspberry). It has no independent stock — the three single-flavour SKUs are the source of truth (same pattern as Monthly Better Box).

## Math (important)

| What customer buys | Variety variant qty | Cores | Decrement each flavour SKU |
|---|---|---|---|
| 1 mixed 3-pack | 1 | 1 Mint + 1 Cherry + 1 Raspberry | **⅓ pack** (not integer — avoid) |
| **9 cores** pack card | **3** | 3 of each | **−1** of each flavour pack |
| 18 cores | 6 | 6 of each | −2 of each |
| 27 cores | 9 | 9 of each | −3 of each |

So: **a 9-core Variety order = 1 three-pack of each flavour.**

Shopify `inventoryAdjustQuantities` only accepts **integer** deltas. The PDP pack cards always use qty 3 / 6 / 9, so Flow can use `−(line_quantity / 3)` per flavour.

**Availability:** `min(Mint, Cherry Pom, Raspberry Lime)` pack qty ≥ 1  
**Max Variety units:** `3 × that min`

## Admin setup for the Variety variant

1. Add option value **Variety** on Brisa Cores (Aroma).
2. Price it like the others ($15).
3. **Turn inventory tracking OFF** on Variety (or leave tracked but ignore it) — flavours are the source of truth.
4. Theme already gates the swatch / ATC from component stock when the title contains `Variety`.

## Create the Flow (≈5 minutes)

Same permissions model as Better Box — **Shopify Flow** uses the shop’s Flow Admin access, so you do **not** need extra scopes on the Brisa Admin custom app.

1. Shopify Admin → **Apps** → **Flow** → **Create workflow**
2. Trigger: **Order created**
3. Condition: line item product is Brisa Cores **and** variant title contains `Variety`
4. Action: **Send Admin API request** → `inventoryAdjustQuantities`

### Mutation

```graphql
mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
  inventoryAdjustQuantities(input: $input) {
    userErrors { field message }
    inventoryAdjustmentGroup { createdAt reason }
  }
}
```

### Variables (qty 3 example → −1 each)

Primary location: `gid://shopify/Location/114492866932`

For a single line of quantity `Q`, set each delta to `-(Q / 3)`. With pack-card orders Q is 3, 6, or 9.

Start with fixed `-1` if you only sell the 9-core card, or use a **For each** line-item loop:

```json
{
  "input": {
    "reason": "correction",
    "name": "available",
    "referenceDocumentUri": "brisa://variety/{{order.id}}",
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

| Flavour | Inventory item GID |
|---|---|
| Mint Ice | `gid://shopify/InventoryItem/55551578177908` |
| Raspberry Lime | `gid://shopify/InventoryItem/55888831676788` |
| Cherry Pomegranate | `gid://shopify/InventoryItem/55888831644020` |

5. Optional idempotency tag: `variety-cores-adjusted` (same pattern as Better Box).
6. Test: order 9-core Variety → each flavour pack drops by 1.

## CLI helper (needs inventory scopes on Brisa Admin)

```bash
cd brisa-functions
# LOCATION_ID=gid://shopify/Location/… npm run variety:decrement -- --units=3
# npm run variety:decrement -- --order=gid://shopify/Order/…
```

Requires: `write_inventory`, `read_inventory`, `read_locations` (and `read_orders` for `--order`).

## Theme behaviour (already wired)

- Circular gallery thumbs **are** the flavour swatches (variant picker row hidden).
- If a Variety variant exists, its thumb is sellable only when all three flavours are available.
- Own Variety inventory is not trusted for ATC; component stock is.
