import { describe, expect, it } from 'vitest';
import { cartTransformRun } from './run';

describe('brisa kit cart transform', () => {
  it('returns no changes without device colour properties', () => {
    const result = cartTransformRun({
      presentmentCurrencyRate: 1,
      cart: {
        lines: [
          {
            id: 'gid://shopify/CartLine/1',
            quantity: 1,
            cost: { amountPerQuantity: { amount: '130.0', currencyCode: 'AUD' } },
            device1: null,
            device2: null,
            kitKey: null,
            yourColour: null,
            matesColour: null,
            kitLabel: null,
            merchandise: {
              __typename: 'ProductVariant',
              id: 'gid://shopify/ProductVariant/100',
              title: 'Default',
              product: { title: 'Starter Kit' },
            },
          },
        ],
      },
    });

    expect(result.operations).toHaveLength(0);
  });

  it('expands a single-device kit with colour', () => {
    const result = cartTransformRun({
      presentmentCurrencyRate: 1,
      cart: {
        lines: [
          {
            id: 'gid://shopify/CartLine/1',
            quantity: 1,
            cost: { amountPerQuantity: { amount: '130.0', currencyCode: 'AUD' } },
            device1: { value: '201' },
            device2: null,
            kitKey: { value: 'try' },
            yourColour: { value: 'Ocean' },
            matesColour: null,
            kitLabel: { value: 'Try Brisa First' },
            merchandise: {
              __typename: 'ProductVariant',
              id: 'gid://shopify/ProductVariant/100',
              title: 'Default',
              product: { title: 'Starter Kit' },
            },
          },
        ],
      },
    });

    expect(result.operations).toHaveLength(1);
    const expand = result.operations[0].lineExpand;
    expect(expand.title).toBe('Try Brisa First');
    expect(expand.expandedCartItems).toHaveLength(2);
    expect(expand.expandedCartItems[0].merchandiseId).toBe(
      'gid://shopify/ProductVariant/100'
    );
    expect(expand.expandedCartItems[0].price.adjustment.fixedPricePerUnit.amount).toBe(
      '130.00'
    );
    expect(expand.expandedCartItems[1].merchandiseId).toBe(
      'gid://shopify/ProductVariant/201'
    );
    expect(expand.expandedCartItems[1].price.adjustment.fixedPricePerUnit.amount).toBe(
      '0.00'
    );
  });

  it('expands mates pack with two device colours', () => {
    const result = cartTransformRun({
      presentmentCurrencyRate: 1,
      cart: {
        lines: [
          {
            id: 'gid://shopify/CartLine/9',
            quantity: 1,
            cost: { amountPerQuantity: { amount: '220.0', currencyCode: 'AUD' } },
            device1: { value: 'gid://shopify/ProductVariant/301' },
            device2: { value: '302' },
            kitKey: { value: 'mates' },
            yourColour: { value: 'Black' },
            matesColour: { value: 'Rose' },
            kitLabel: { value: 'Mates pack' },
            merchandise: {
              __typename: 'ProductVariant',
              id: 'gid://shopify/ProductVariant/200',
              title: 'Default',
              product: { title: 'Mates Pack' },
            },
          },
        ],
      },
    });

    const expand = result.operations[0].lineExpand;
    expect(expand.expandedCartItems).toHaveLength(3);
    expect(expand.expandedCartItems[1].merchandiseId).toBe(
      'gid://shopify/ProductVariant/301'
    );
    expect(expand.expandedCartItems[2].merchandiseId).toBe(
      'gid://shopify/ProductVariant/302'
    );
    expect(expand.expandedCartItems[2].attributes).toEqual(
      expect.arrayContaining([
        { key: 'Role', value: "Mate's device" },
        { key: 'Colour', value: 'Rose' },
      ])
    );
  });
});
