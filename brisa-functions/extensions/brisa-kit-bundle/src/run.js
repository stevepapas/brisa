// @ts-check

/**
 * Expands Brisa kit parent lines into pack + coloured device components.
 *
 * Theme ATC writes:
 *   _device_1_variant_id  (required for expand)
 *   _device_2_variant_id  (mates pack only)
 *   _kit_key / Kit / Your colour / Mate's colour
 *
 * Pricing (Option A): pack parent keeps the full kit price; device
 * colour variants expand at $0 so inventory tracks without double-charging.
 */

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 * @typedef {import("../generated/api").Operation} Operation
 */

/** @type {CartTransformRunResult} */
const NO_CHANGES = { operations: [] };

const KIT_TITLES = {
  try: 'Try Brisa First',
  commitment: 'The Commitment Kit',
  mates: 'Mates Pack',
};

/**
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
function toVariantGid(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value) return null;
  if (value.startsWith('gid://shopify/ProductVariant/')) return value;
  if (/^\d+$/.test(value)) return `gid://shopify/ProductVariant/${value}`;
  return null;
}

/**
 * @param {string | number} amount
 * @returns {string}
 */
function moneyAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

/**
 * @param {RunInput} input
 * @returns {CartTransformRunResult}
 */
export function cartTransformRun(input) {
  const operations = input.cart.lines.reduce(
    /** @param {Operation[]} acc */
    (acc, cartLine) => {
      const expandOperation = buildExpandOperation(cartLine);
      if (expandOperation) {
        acc.push({ lineExpand: expandOperation });
      }
      return acc;
    },
    /** @type {Operation[]} */ ([])
  );

  return operations.length > 0 ? { operations } : NO_CHANGES;
}

/** @deprecated Prefer cartTransformRun for API 2026-07+ */
export function run(input) {
  return cartTransformRun(input);
}

/**
 * @param {RunInput['cart']['lines'][number]} cartLine
 */
function buildExpandOperation(cartLine) {
  const { id: cartLineId, merchandise, quantity, cost } = cartLine;
  if (merchandise.__typename !== 'ProductVariant') return null;

  const device1Id = toVariantGid(cartLine.device1?.value);
  if (!device1Id) return null;

  const device2Id = toVariantGid(cartLine.device2?.value);
  const kitKey = cartLine.kitKey?.value || '';
  const packTitle =
    cartLine.kitLabel?.value ||
    KIT_TITLES[kitKey] ||
    merchandise.product?.title ||
    merchandise.title ||
    'Brisa Kit';

  const packAmount = moneyAmount(cost.amountPerQuantity.amount);
  /** @type {Array<Record<string, unknown>>} */
  const expandedCartItems = [];

  // Parent pack keeps the charged price (Option A).
  expandedCartItems.push({
    merchandiseId: merchandise.id,
    quantity,
    price: {
      adjustment: {
        fixedPricePerUnit: { amount: packAmount },
      },
    },
    attributes: [
      { key: '_brisa_component', value: 'pack' },
      ...(kitKey ? [{ key: '_kit_key', value: kitKey }] : []),
    ],
  });

  const yourColour = cartLine.yourColour?.value || '';
  expandedCartItems.push({
    merchandiseId: device1Id,
    quantity,
    price: {
      adjustment: {
        fixedPricePerUnit: { amount: '0.00' },
      },
    },
    attributes: [
      { key: '_brisa_component', value: 'device_1' },
      { key: 'Role', value: device2Id ? 'Your device' : 'Device' },
      ...(yourColour ? [{ key: 'Colour', value: yourColour }] : []),
    ],
  });

  if (device2Id) {
    const matesColour = cartLine.matesColour?.value || '';
    expandedCartItems.push({
      merchandiseId: device2Id,
      quantity,
      price: {
        adjustment: {
          fixedPricePerUnit: { amount: '0.00' },
        },
      },
      attributes: [
        { key: '_brisa_component', value: 'device_2' },
        { key: 'Role', value: "Mate's device" },
        ...(matesColour ? [{ key: 'Colour', value: matesColour }] : []),
      ],
    });
  }

  return {
    cartLineId,
    title: packTitle,
    expandedCartItems,
  };
}
