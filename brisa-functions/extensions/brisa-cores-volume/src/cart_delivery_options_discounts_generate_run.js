// @ts-check

/**
 * Shipping discounts are not part of cores volume pricing.
 * Kept as an empty target so the Discount Function schema stays valid.
 */

/**
 * @typedef {import("../generated/api").DeliveryInput} RunInput
 * @typedef {import("../generated/api").CartDeliveryOptionsDiscountsGenerateRunResult} CartDeliveryOptionsDiscountsGenerateRunResult
 */

/**
 * @param {RunInput} _input
 * @returns {CartDeliveryOptionsDiscountsGenerateRunResult}
 */
export function cartDeliveryOptionsDiscountsGenerateRun(_input) {
  return { operations: [] };
}
