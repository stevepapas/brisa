import { describe, expect, it } from 'vitest';
import {
  cartLinesDiscountsGenerateRun,
  discountPerUnit,
  isEligibleCoresLine,
  targetUnitPrice,
} from './cart_lines_discounts_generate_run';
import { DiscountClass } from '../generated/api';

function coresLine({
  id = 'gid://shopify/CartLine/1',
  quantity = 1,
  amount = '15.0',
  handle = 'brisa-cores',
  productId = 'gid://shopify/Product/15080732131700',
  sellingPlanId = null,
  kitKey = null,
  device1 = null,
  brisaComponent = null,
  title = 'Mint Ice',
} = {}) {
  return {
    id,
    quantity,
    cost: { amountPerQuantity: { amount } },
    sellingPlanAllocation: sellingPlanId
      ? { sellingPlan: { id: sellingPlanId } }
      : null,
    kitKey: kitKey ? { value: kitKey } : null,
    device1: device1 ? { value: device1 } : null,
    brisaComponent: brisaComponent ? { value: brisaComponent } : null,
    merchandise: {
      __typename: 'ProductVariant',
      id: 'gid://shopify/ProductVariant/1',
      product: { id: productId, handle },
    },
    _title: title,
  };
}

describe('tier math', () => {
  it('floors odd quantities to the lower tier', () => {
    expect(targetUnitPrice(1)).toBeNull();
    expect(targetUnitPrice(5)).toBeNull();
    expect(targetUnitPrice(6)).toBe(12.5);
    expect(targetUnitPrice(8)).toBe(12.5);
    expect(targetUnitPrice(9)).toBe(10);
    expect(targetUnitPrice(12)).toBe(10);
  });

  it('matches $15 → $12.50 → $10 with fixed cents off', () => {
    expect(discountPerUnit(15, 5)).toBe(0);
    expect(discountPerUnit(15, 6)).toBe(2.5);
    expect(discountPerUnit(15, 8)).toBe(2.5);
    expect(discountPerUnit(15, 9)).toBe(5);
  });
});

describe('eligibility', () => {
  it('includes Variety and flavour one-time cores', () => {
    expect(isEligibleCoresLine(coresLine({ title: 'Variety' }))).toBe(true);
    expect(isEligibleCoresLine(coresLine({ title: 'Mint Ice' }))).toBe(true);
  });

  it('excludes selling plans, kits, and other products', () => {
    expect(
      isEligibleCoresLine(coresLine({ sellingPlanId: 'gid://shopify/SellingPlan/1' }))
    ).toBe(false);
    expect(isEligibleCoresLine(coresLine({ kitKey: 'try' }))).toBe(false);
    expect(isEligibleCoresLine(coresLine({ device1: '123' }))).toBe(false);
    expect(
      isEligibleCoresLine(coresLine({ handle: 'monthly-better-box', productId: 'x' }))
    ).toBe(false);
  });
});

describe('cartLinesDiscountsGenerateRun', () => {
  it('returns no ops without PRODUCT discount class', () => {
    const result = cartLinesDiscountsGenerateRun({
      cart: { lines: [coresLine({ quantity: 9 })] },
      discount: { discountClasses: [] },
    });
    expect(result.operations).toHaveLength(0);
  });

  it('returns no ops below 6 units', () => {
    const result = cartLinesDiscountsGenerateRun({
      cart: {
        lines: [
          coresLine({ id: 'a', quantity: 3 }),
          coresLine({ id: 'b', quantity: 2 }),
        ],
      },
      discount: { discountClasses: [DiscountClass.Product] },
    });
    expect(result.operations).toHaveLength(0);
  });

  it('applies mid tier across flavours (qty 6–8)', () => {
    const result = cartLinesDiscountsGenerateRun({
      cart: {
        lines: [
          coresLine({ id: 'mint', quantity: 4 }),
          coresLine({ id: 'cherry', quantity: 3 }),
        ],
      },
      discount: { discountClasses: [DiscountClass.Product] },
    });

    const candidates = result.operations[0].productDiscountsAdd.candidates;
    expect(candidates).toHaveLength(2);
    expect(candidates[0].value.fixedAmount).toEqual({
      amount: '2.50',
      appliesToEachItem: true,
    });
  });

  it('Mint 6 + Cherry 3 → top tier ($5 off/unit → $90 total)', () => {
    const result = cartLinesDiscountsGenerateRun({
      cart: {
        lines: [
          coresLine({ id: 'mint', quantity: 6 }),
          coresLine({ id: 'cherry', quantity: 3 }),
        ],
      },
      discount: { discountClasses: [DiscountClass.Product] },
    });

    const candidates = result.operations[0].productDiscountsAdd.candidates;
    expect(candidates).toHaveLength(2);
    for (const c of candidates) {
      expect(c.value.fixedAmount.amount).toBe('5.00');
      expect(c.value.fixedAmount.appliesToEachItem).toBe(true);
    }

    // 9 × $15 − 9 × $5 = $90
    const totalOff =
      6 * Number(candidates[0].value.fixedAmount.amount) +
      3 * Number(candidates[1].value.fixedAmount.amount);
    expect(9 * 15 - totalOff).toBe(90);
  });

  it('ignores Better Box / subscription lines in the pool', () => {
    const result = cartLinesDiscountsGenerateRun({
      cart: {
        lines: [
          coresLine({ id: 'mint', quantity: 5 }),
          coresLine({
            id: 'sub',
            quantity: 4,
            sellingPlanId: 'gid://shopify/SellingPlan/1',
          }),
        ],
      },
      discount: { discountClasses: [DiscountClass.Product] },
    });
    // Only 5 eligible → list tier
    expect(result.operations).toHaveLength(0);
  });
});
