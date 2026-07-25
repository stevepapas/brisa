/**
 * Variety pack → Brisa Cores BOM.
 *
 * Product structure: each single-flavour SKU is a $15 **3-pack**.
 * Variety is also a $15 3-pack, equal parts of the three flavours:
 *   1 Variety unit = 1 Mint + 1 Cherry Pom + 1 Raspberry Lime **core**
 *                 = ⅓ of each flavour's 3-pack SKU
 *
 * Shopify inventory is integer-only at the 3-pack SKU level, so Flow /
 * Admin adjusts flavour packs by:
 *   packsEach = varietyQty / 3
 *
 * The cores PDP pack cards always sell qty 3 / 6 / 9 (9 / 18 / 27 cores),
 * so packsEach is always a whole number in normal storefront flows:
 *   9 cores (qty 3)  → −1 of each flavour pack
 *   18 cores (qty 6) → −2 of each flavour pack
 *   27 cores (qty 9) → −3 of each flavour pack
 *
 * Availability (theme): min(mint, cherry, raspberry) flavour packs ≥ 1
 * Max Variety units sellable: 3 × min(flavour packs)
 */
import { BETTER_BOX_BOM } from './better-box-bom.mjs';

export const CORES_HANDLE = 'brisa-cores';
export const CORES_PRODUCT_ID = '15080732131700';
export const FLAVOUR_PACK_SIZE = 3;

/** Same three flavour inventory items as Better Box. */
export const VARIETY_BOM = BETTER_BOX_BOM.map((row) => ({
  flavour: row.flavour,
  variantId: row.variantId,
  inventoryItemId: row.inventoryItemId,
  /** Cores of this flavour consumed per 1 Variety unit (3-pack). */
  coresPerVarietyUnit: 1,
}));

export function isVarietyLine(line) {
  const handle = String(
    line?.handle || line?.product_handle || line?.merchandise?.product?.handle || ''
  ).toLowerCase();
  const productId = String(
    line?.product_id || line?.productId || line?.merchandise?.product?.id || ''
  );
  const title = String(
    line?.title || line?.name || line?.variant_title || line?.merchandise?.title || ''
  ).toLowerCase();
  const variantTitle = String(
    line?.variant_title || line?.merchandise?.title || ''
  ).toLowerCase();

  const onCores =
    handle === CORES_HANDLE ||
    productId.includes(CORES_PRODUCT_ID) ||
    title.includes('brisa cores');

  if (!onCores) return false;
  return variantTitle.includes('variety') || title.includes('variety');
}

/**
 * Count Variety **units** (each unit = one mixed 3-pack) on order lines.
 */
export function countVarietyUnits(lines = []) {
  return lines.reduce((sum, line) => {
    if (!isVarietyLine(line)) return sum;
    const qty = Number(line.quantity || line.currentQuantity || 0);
    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);
}

/**
 * How many whole flavour 3-packs to decrement for a Variety unit qty.
 * Returns { packsEach, remainderUnits }.
 * remainderUnits > 0 means stock was sold in a non-multiple of 3 — ops must
 * reconcile (prefer selling only via 9/18/27 pack cards).
 */
export function flavourPacksForVarietyUnits(varietyUnits) {
  const units = Number(varietyUnits) || 0;
  if (units <= 0) return { packsEach: 0, remainderUnits: 0 };
  return {
    packsEach: Math.floor(units / FLAVOUR_PACK_SIZE),
    remainderUnits: units % FLAVOUR_PACK_SIZE,
  };
}

/**
 * Max Variety units that can be sold given flavour pack inventories.
 * availableVarietyUnits = 3 × min(mint, cherry, raspberry)
 */
export function maxVarietyUnitsFromFlavourPacks(packQtys = {}) {
  const values = VARIETY_BOM.map((row) => {
    const key = row.flavour;
    const n = Number(
      packQtys[key] ??
        packQtys[key.toLowerCase()] ??
        packQtys[row.variantId] ??
        0
    );
    return Number.isFinite(n) ? n : 0;
  });
  if (values.length === 0) return 0;
  return FLAVOUR_PACK_SIZE * Math.min(...values);
}
