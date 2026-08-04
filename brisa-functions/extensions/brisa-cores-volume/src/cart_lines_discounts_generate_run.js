// @ts-check

/**
 * Cross-flavour volume discount for one-time Brisa Cores (3-pack units).
 *
 * Eligible lines (product handle `brisa-cores`, incl. Variety) share one qty pool.
 * Odd quantities floor to the lower tier (4–5 → list; 7–8 → 6-pack; ≥9 → top).
 *
 * List $15 → mid $12.50 → top $10 per 3-pack unit (scaled if list ≠ $15).
 */

import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
} from '../generated/api';

/**
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

/** @type {CartLinesDiscountsGenerateRunResult} */
const NO_DISCOUNT = { operations: [] };

const CORES_HANDLE = 'brisa-cores';
/** Fallback if handle ever changes — live Admin product id. */
const CORES_PRODUCT_ID = 'gid://shopify/Product/15080732131700';

/** Reference list price used to derive mid/top unit targets. */
const LIST_REF = 15;
const MID_UNIT = 12.5;
const TOP_UNIT = 10;

const DISCOUNT_MESSAGE = 'Cores volume save';

/**
 * @param {string | number} amount
 * @returns {number}
 */
function toMoneyNumber(amount) {
  const n = Number(amount);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {number} n
 * @returns {string}
 */
function moneyString(n) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/**
 * Floor-to-lower-tier mapping of pool qty → target unit price (at $15 list).
 * @param {number} totalQty
 * @returns {number | null} target unit price, or null when no discount
 */
export function targetUnitPrice(totalQty) {
  if (totalQty >= 9) return TOP_UNIT;
  if (totalQty >= 6) return MID_UNIT;
  return null;
}

/**
 * Cents-off per unit so effective price matches the tier (scaled to line list).
 * @param {number} listPrice
 * @param {number} totalQty
 * @returns {number}
 */
export function discountPerUnit(listPrice, totalQty) {
  const targetAtRef = targetUnitPrice(totalQty);
  if (targetAtRef == null || listPrice <= 0) return 0;
  const scaledTarget = listPrice * (targetAtRef / LIST_REF);
  const off = listPrice - scaledTarget;
  return off > 0 ? Math.round(off * 100) / 100 : 0;
}

/**
 * @param {RunInput['cart']['lines'][number]} line
 * @returns {boolean}
 */
export function isEligibleCoresLine(line) {
  if (!line || line.merchandise?.__typename !== 'ProductVariant') return false;
  if (line.sellingPlanAllocation?.sellingPlan?.id) return false;
  if (line.kitKey?.value || line.device1?.value || line.brisaComponent?.value) {
    return false;
  }

  const product = line.merchandise.product;
  if (!product) return false;
  if (product.handle === CORES_HANDLE) return true;
  if (product.id === CORES_PRODUCT_ID) return true;
  return false;
}

/**
 * @param {RunInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  const hasProductDiscountClass = input.discount?.discountClasses?.includes(
    DiscountClass.Product
  );
  if (!hasProductDiscountClass) {
    return NO_DISCOUNT;
  }

  const lines = input.cart?.lines || [];
  const eligible = lines.filter(isEligibleCoresLine);
  if (eligible.length === 0) {
    return NO_DISCOUNT;
  }

  const totalQty = eligible.reduce((sum, line) => sum + (line.quantity || 0), 0);
  if (targetUnitPrice(totalQty) == null) {
    return NO_DISCOUNT;
  }

  /** @type {Array<Record<string, unknown>>} */
  const candidates = [];

  for (const line of eligible) {
    const listPrice = toMoneyNumber(line.cost?.amountPerQuantity?.amount);
    const perUnit = discountPerUnit(listPrice, totalQty);
    if (perUnit <= 0) continue;

    candidates.push({
      message: DISCOUNT_MESSAGE,
      targets: [{ cartLine: { id: line.id } }],
      value: {
        fixedAmount: {
          amount: moneyString(perUnit),
          appliesToEachItem: true,
        },
      },
    });
  }

  if (candidates.length === 0) {
    return NO_DISCOUNT;
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: ProductDiscountSelectionStrategy.All,
        },
      },
    ],
  };
}
