# Brisa Premium Cart - Testing Guide

## 🎯 Overview

This guide explains how to safely test the new premium cart experience before going live.

## 🔒 Safety First

**Your changes are completely isolated:**
- Working on branch: `cursor/cart-upgrade-staging-cc08`
- NOT affecting the live site (`main` branch)
- Pull Request #3 is in DRAFT mode
- Changes only deploy when you explicitly publish

## ⚙️ Critical: Configure Free Gift Variant ID

**BEFORE TESTING**, you MUST configure the free gift product:

1. **Find the Variant ID:**
   - Go to Shopify Admin → Products
   - Find "Watermelon Core 3-pack" (or your free gift product)
   - Open the product
   - Click on the variant
   - Look at the URL: `admin.shopify.com/.../variants/[VARIANT_ID]`
   - Copy the variant ID number

2. **Update the Code:**
   - Go to: `assets/custom.js`
   - Find line ~631: `const FREE_GIFT_VARIANT_ID = 'REPLACE_ME';`
   - Replace `'REPLACE_ME'` with your variant ID
   - Example: `const FREE_GIFT_VARIANT_ID = '44567890123456';`
   - Save and commit the change

## 🧪 Testing Methods

### Method 1: Shopify Theme Preview (Safest & Easiest)

This is the **recommended** method as it doesn't affect live customers:

1. **Access Theme Settings:**
   ```
   Shopify Admin → Online Store → Themes
   ```

2. **Find Your Development Theme:**
   - Look for a theme connected to this branch
   - Or upload the code as a new unpublished theme

3. **Preview Without Publishing:**
   - Click on the theme → **"Actions" → "Preview"**
   - This opens the site in preview mode (not live)
   - Or click **"Customize"** to use the theme editor

4. **Test the Cart:**
   - Add products to cart
   - Open the mini cart (click cart icon)
   - Verify all features work

### Method 2: Development Store

If you have a Shopify development/staging store:

1. Push this theme to the dev store
2. Test thoroughly there
3. Once confirmed working, deploy to production

### Method 3: GitHub Desktop (for local inspection)

You can review the code changes locally:

1. Open GitHub Desktop
2. Switch to branch: `cursor/cart-upgrade-staging-cc08`
3. Review changed files
4. See exactly what was modified

## ✅ Complete Testing Checklist

### Initial Setup
- [ ] Configure `FREE_GIFT_VARIANT_ID` in `custom.js`
- [ ] Commit and push the configuration
- [ ] Open theme in preview mode

### Free Gift Functionality
- [ ] Add a **Starter Kit** to cart
- [ ] Verify free gift card appears automatically
- [ ] Check free gift shows: "FREE Watermelon Core 3-pack — $15 value"
- [ ] Remove Starter Kit from cart
- [ ] Verify free gift is automatically removed
- [ ] Re-add Starter Kit
- [ ] Verify free gift is re-added (no duplicates)

### Progress Bar & Threshold
- [ ] Start with empty cart
- [ ] Add items totaling < $220
- [ ] Verify progress bar shows: "$X away from saving $40 with the Mates Pack 🤝"
- [ ] Progress bar should fill proportionally
- [ ] Add more items to reach ≥ $220
- [ ] Verify unlock message: "🎉 You've unlocked Mates Pack savings"
- [ ] Progress bar should be fully filled and change color

### Ajax Updates (No Page Reloads)
- [ ] Add multiple items to cart
- [ ] Change quantity using +/- buttons
- [ ] Verify page does NOT reload
- [ ] Verify totals update instantly
- [ ] Verify progress bar updates
- [ ] Click "Remove" on an item
- [ ] Verify page does NOT reload
- [ ] Verify item disappears smoothly

### Visual Design
- [ ] Urgency banner appears at top (if enabled)
- [ ] Progress bar displays correctly
- [ ] Free gift card has gold border & badge
- [ ] Bottom urgency message displays (if enabled)
- [ ] Checkout button is sticky and prominent
- [ ] Lock icon (🔒) shows on checkout button
- [ ] Total price updates dynamically
- [ ] Payment icons display at bottom
- [ ] Smooth animations on updates

### Mobile Testing
- [ ] Open cart on mobile device (or dev tools mobile view)
- [ ] All elements are readable and properly sized
- [ ] Touch targets are large enough
- [ ] Urgency banners don't overflow
- [ ] Progress bar is visible
- [ ] Free gift card displays correctly
- [ ] Checkout button is prominent

### Desktop Testing
- [ ] Open cart on desktop
- [ ] Verify larger sizing for text/images
- [ ] Progress bar scales appropriately
- [ ] All spacing looks premium

### Edge Cases
- [ ] Empty cart displays correctly
- [ ] Cart with only non-Starter Kit items (no free gift shows)
- [ ] Cart with 10+ items (scrolling works)
- [ ] Very long product names (text doesn't break layout)
- [ ] Special characters in product names
- [ ] Products with variants display correctly

### Existing Functionality
- [ ] Cart recommendations still appear
- [ ] Order note button still works
- [ ] Discount codes apply correctly
- [ ] Shipping estimates work (if enabled)
- [ ] Cross-sell products display
- [ ] Cart persists across page navigation

### Theme Settings
- [ ] Go to: Customize → Sections → Cart drawer
- [ ] Toggle "Show top urgency banner" on/off
- [ ] Change banner text, verify it updates
- [ ] Toggle "Show bottom urgency message" on/off
- [ ] Change bottom urgency text, verify it updates
- [ ] Toggle "Show payment icons" on/off

## 🐛 Debugging

If something doesn't work:

1. **Open Browser Console** (F12 or Right-click → Inspect)

2. **Look for errors** in the Console tab (red messages)

3. **Check configuration:**
   ```javascript
   // In browser console, type:
   console.log(window.BrisaCart);
   ```
   Should show cart functions

4. **Manually test functions:**
   ```javascript
   // Check current cart
   fetch('/cart.js').then(r => r.json()).then(console.log)
   
   // Manually sync free gift
   window.BrisaCart.syncFreeGift();
   
   // Manually update progress
   window.BrisaCart.updateCartProgress();
   
   // Force cart refresh
   window.BrisaCart.refreshCart();
   ```

5. **Common Issues:**

   **Free gift not adding:**
   - Check `FREE_GIFT_VARIANT_ID` is configured correctly
   - Verify variant ID exists in your store
   - Check product type is exactly `'Starter Kit'`

   **Progress not updating:**
   - Check browser console for JavaScript errors
   - Verify `custom.js` loaded correctly
   - Try refreshing the page

   **Styling looks wrong:**
   - Check `custom.css` loaded correctly
   - Clear browser cache (Ctrl+Shift+R)
   - Check for CSS conflicts with existing styles

## 📝 Customization

### Adjust Thresholds

Edit `assets/custom.js` (~line 629):

```javascript
const MATES_PACK_THRESHOLD = 22000;  // $220 in cents
const FREE_SHIPPING_THRESHOLD = 13000; // $130 in cents
```

### Change Messaging

Edit via Shopify theme customizer:
- **Online Store → Themes → Customize**
- **Sections → Cart drawer**
- Modify text fields

Or edit `sections/mini-cart.liquid` directly

### Adjust Styling

All cart styles in `assets/custom.css` use `.brisa-cart-` prefix:

```css
.brisa-cart__progress-bar { /* progress bar */ }
.brisa-cart__free-gift { /* free gift card */ }
.brisa-cart__checkout-button { /* checkout CTA */ }
/* etc. */
```

## 🚀 Going Live

Once testing is complete:

1. **Verify Everything Works:**
   - All checklist items passed ✅
   - No console errors
   - Mobile & desktop tested
   - Free gift variant ID configured

2. **Update PR Status:**
   - Go to PR #3: https://github.com/stevepapas/brisa/pull/3
   - Mark as "Ready for Review" (remove draft status)

3. **Merge to Main:**
   - Click "Merge pull request"
   - Confirm merge
   - Delete branch (optional)

4. **Publish Theme:**
   - Go to Shopify Admin → Themes
   - Find the updated theme
   - Click "Actions" → "Publish"
   
5. **Monitor Live Site:**
   - Test cart on live site
   - Monitor for any customer issues
   - Check analytics/conversion rates

## 📞 Support

If you encounter issues:

1. Check this testing guide
2. Review browser console for errors
3. Verify configuration steps completed
4. Check PR #3 for additional notes
5. Reach out for assistance

## 📊 Expected Results

### Cart < $220
![Progress showing distance to threshold]
- Shows: "$90 away from saving $40 with the Mates Pack 🤝"
- Progress bar partially filled

### Cart ≥ $220
![Progress complete]
- Shows: "🎉 You've unlocked Mates Pack savings"
- Progress bar fully filled (gold/yellow color)

### With Starter Kit
![Free gift card visible]
- Gold bordered card appears
- "FREE" badge displayed
- "$15 value" struck through

### Without Starter Kit
![No free gift]
- Free gift card hidden
- Only regular cart items shown

---

**Remember:** All changes are on branch `cursor/cart-upgrade-staging-cc08` and won't affect your live site until you explicitly publish the theme!

Last Updated: May 27, 2026
