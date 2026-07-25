# Brisa Kit Bundle — Cart Transform

Shopify Function that expands Brisa kit cart lines into pack + coloured device components (**Option A** pricing).

## What it does

When the theme adds a kit with these line properties:

| Property | Purpose |
|---|---|
| `_device_1_variant_id` | Your device colour variant ID |
| `_device_2_variant_id` | Mate’s device colour variant ID (Mates only) |
| `_kit_key` | `try` / `commitment` / `mates` |
| `Your colour` / `Mate's colour` | Display labels |

…the function runs a **`expand`** operation:

1. **Pack parent** — full kit price  
2. **Device 1** — $0 (inventory + colour)  
3. **Device 2** — $0 (Mates only)

Checkout still charges the pack price. Device variants track stock.

## Setup

### 1. Create the Partner app

```bash
cd brisa-functions
npm install
npx shopify app config link   # or create a new app when prompted
```

Set `client_id` in `shopify.app.toml` after linking.

### 2. Deploy

```bash
npx shopify app deploy
```

### 3. Install on the store

Install the app on the Brisa shop (CLI will open a link during `shopify app dev` / Partners dashboard).

### 4. Activate the cart transform (once per shop)

Only **one** cart transform can be active per shop.

```bash
SHOP=your-store.myshopify.com ADMIN_TOKEN=shpat_xxx npm run activate
```

The Admin token needs `write_cart_transforms`.

### 5. Theme requirements

- Colour blocks in **Brisa kit purchase** must link real device products so `_device_*_variant_id` is populated.
- Mates ATC already writes the properties from `assets/brisa-kit-purchase.js`.

## Monthly Better Box inventory + subscription

**Do not use Shopify Fixed Bundles on Monthly Better Box** while it has an Appstle selling plan. Native Fixed Bundles (`requiresComponents`) are incompatible with purchase options — cart/add returns *"The product 'Monthly better box' is already sold out"* even when flavour cores are in stock.

### Intended BOM (marketing + fulfilment)

Each **Brisa Cores** variant is a **3-pack**. Box contents:

| Component | Qty | Cores | Notes |
|---|---|---|---|
| Mint Ice | 1 | 3 | |
| Raspberry Lime | 1 | 3 | |
| Cherry Pomegranate | 1 | 3 | Free Cherry Pom pack |
| **Total** | **3** | **9** | |

### Current setup

1. **MBB product** — normal variant + Appstle monthly selling plan. **Tracked + continue selling** (dummy Shopify qty; cores are the real stock gate). Run `npm run setup:better-box-inventory` after Admin API scope changes.
2. **Theme gate** — `brisa-kit-purchase` marks the add-on sold out unless Mint Ice, Raspberry Lime, and Cherry Pom are all available on `brisa-cores`.
3. **Auto-decrement on every order / renewal** — Shopify Flow (or `npm run better-box:decrement`) adjusts those three core inventory items by −1 per box. See [docs/better-box-inventory-flow.md](./docs/better-box-inventory-flow.md).

## Variety pack inventory

Variety is a mixed **3-pack** on `brisa-cores` (1 core of each flavour). Flavour SKUs stay the source of truth — same Flow pattern as Better Box.

| Customer buys | Variety qty | Stock move |
|---|---|---|
| 9 cores | 3 | −1 Mint, −1 Cherry Pom, −1 Raspberry Lime pack |
| 18 cores | 6 | −2 of each |
| 27 cores | 9 | −3 of each |

Availability = all three flavours in stock. Max Variety units = `3 × min(flavour packs)`.  
See [docs/variety-inventory-flow.md](./docs/variety-inventory-flow.md).

### Scripts

```bash
cd brisa-functions
cp .env.example .env   # SHOP + CLIENT_ID + CLIENT_SECRET
npm run clear:better-box   # strip Fixed Bundle if one was applied
# Inventory helpers (need write_inventory + read_locations on Brisa Admin):
# LOCATION_ID=gid://shopify/Location/… npm run better-box:decrement -- --boxes=1
# LOCATION_ID=… npm run variety:decrement -- --units=3
# npm run setup:better-box # DO NOT use while Appstle plan is attached
```

Auth (Dev Dashboard → **Brisa Admin** → Client ID/secret) is shared with other admin scripts. Prefer **Shopify Flow** for live decrements when the app lacks inventory scopes.

## Local test

```bash
cd extensions/brisa-kit-bundle
npm install
npm test
```

If GraphQL typegen fails with `concurrency ... got 0` (rare sandbox issue), run:

```bash
export NODE_OPTIONS="--require $PWD/extensions/brisa-kit-bundle/scripts/cpus-shim.cjs"
```

from `brisa-functions/`, then deploy again.

## Fix for “package.json does not exist” on deploy

That error means the extension was missing the `codegen` block / GraphQL codegen deps. Those are now in `extensions/brisa-kit-bundle/package.json`. From `brisa-functions/`:

```bash
cd extensions/brisa-kit-bundle && npm install && cd ../..
npx shopify app deploy
```

## Notes

- `blockOnFailure: false` — if the function errors, checkout still proceeds (kit line without expand).
- Parent kits should eventually use `requiresComponents: true` via Admin API if they must not sell without expand.
- If another app already owns the shop’s cart transform, deactivate it before activating this one.
