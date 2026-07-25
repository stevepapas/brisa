/**
 * Monthly Better Box → Brisa Cores BOM.
 * Each cores variant is a 3-pack; qty 1 of each = 9 cores per box.
 */
export const BETTER_BOX_HANDLE = 'monthly-better-box';
export const BETTER_BOX_PRODUCT_ID = '15171159949684';
export const BETTER_BOX_VARIANT_ID = '55004269412724';

export const BETTER_BOX_BOM = [
  {
    flavour: 'Mint Ice',
    variantId: 'gid://shopify/ProductVariant/54682411991412',
    inventoryItemId: 'gid://shopify/InventoryItem/55551578177908',
    quantityPerBox: 1,
  },
  {
    flavour: 'Raspberry Lime',
    variantId: 'gid://shopify/ProductVariant/55011889873268',
    inventoryItemId: 'gid://shopify/InventoryItem/55888831676788',
    quantityPerBox: 1,
  },
  {
    flavour: 'Cherry Pomegranate',
    variantId: 'gid://shopify/ProductVariant/55011889840500',
    inventoryItemId: 'gid://shopify/InventoryItem/55888831644020',
    quantityPerBox: 1,
  },
];

export function isBetterBoxLine(line) {
  const productId = String(
    line?.product_id || line?.productId || line?.merchandise?.product?.id || ''
  );
  const variantId = String(
    line?.variant_id || line?.variantId || line?.merchandise?.id || ''
  );
  const handle = String(
    line?.handle || line?.product_handle || line?.merchandise?.product?.handle || ''
  ).toLowerCase();
  const title = String(line?.title || line?.name || line?.merchandise?.product?.title || '')
    .toLowerCase();

  if (productId.includes(BETTER_BOX_PRODUCT_ID)) return true;
  if (variantId.includes(BETTER_BOX_VARIANT_ID)) return true;
  if (handle === BETTER_BOX_HANDLE) return true;
  if (title.includes('monthly better box')) return true;
  return false;
}

export function countBetterBoxes(lines = []) {
  return lines.reduce((sum, line) => {
    if (!isBetterBoxLine(line)) return sum;
    const qty = Number(line.quantity || line.currentQuantity || 0);
    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);
}
