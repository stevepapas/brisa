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
