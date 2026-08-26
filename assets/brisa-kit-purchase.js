(() => {
  const FALLBACK_ATC_ERROR = "Sorry, we couldn't add that to your bag. Please try again in a moment.";

  function formatMoney(cents) {
    const value = Number(cents) / 100;
    const whole = Number.isInteger(value) ? String(value) : value.toFixed(2);
    return `$${whole}`;
  }

  function uid() {
    return `mates-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  class BrisaKitPurchase extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      this._ready = true;

      this.kits = Array.from(this.querySelectorAll('[data-bkp-kit]'));
      this.atc = this.querySelector('[data-bkp-atc]');
      this.atcLabel = this.querySelector('[data-bkp-atc-label]');
      this.errorEl = this.querySelector('[data-bkp-error]');
      this.addonCheck = this.querySelector('[data-bkp-addon-check]');
      this.express = this.querySelector('[data-bkp-express]');
      this.expressOptions = Array.from(
        this.express?.querySelectorAll('[data-bkp-express-option]') || []
      );
      this.expressMessage = this.express?.querySelector('[data-bkp-express-message]');

      this.kits.forEach((kit) => {
        kit.addEventListener('click', (event) => {
          if (!this.isKitAvailable(kit)) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          this.selectKit(kit.dataset.kitKey);
        });
        const radio = kit.querySelector('input[type="radio"]');
        radio?.addEventListener('change', () => {
          if (radio.checked) this.selectKit(kit.dataset.kitKey);
        });
      });

      this.querySelectorAll('[data-bkp-swatch]').forEach((btn) => {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (btn.disabled || btn.classList.contains('is-sold-out')) {
            return;
          }
          this.selectColour(btn);
        });
      });

      this.querySelector('[data-bkp-addon-toggle]')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (!this.isAddonAvailable() || !this.addonCheck || this.addonCheck.disabled) return;
        this.addonCheck.checked = !this.addonCheck.checked;
        this.clearError();
        this.syncAddonUi();
        this.updatePrice();
      });

      this.addonCheck?.addEventListener('change', () => {
        if (!this.isAddonAvailable()) {
          this.addonCheck.checked = false;
        }
        this.clearError();
        this.syncAddonUi();
        this.updatePrice();
      });
      this.syncAddonUi();
      this.expressOptions.forEach((option) => {
        option.querySelector('form')?.addEventListener('submit', (event) => {
          this.syncExpressCheckout();
          if (this.express?.classList.contains('is-unavailable') || option.hidden) {
            event.preventDefault();
          }
        });
      });
      this.atc?.addEventListener('click', (e) => {
        e.preventDefault();
        this.addToCart();
      });

      this.applyUrlColour();

      const preferred =
        this.kits.find((k) => k.classList.contains('is-selected') && this.isKitAvailable(k)) ||
        this.kits.find((k) => this.isKitAvailable(k));
      if (preferred) {
        this.selectKit(preferred.dataset.kitKey);
      } else {
        this.syncColourAvailability();
        this.updatePrice();
      }
      this.bindSyncAtc();
    }

    isKitAvailable(kit) {
      return Boolean(kit) && kit.dataset.available !== 'false';
    }

    selectedKit() {
      return this.kits.find((k) => k.classList.contains('is-selected'));
    }

    selectKit(key) {
      const next = this.kits.find((kit) => kit.dataset.kitKey === key);
      if (!this.isKitAvailable(next)) return;

      this.kits.forEach((kit) => {
        const on = kit.dataset.kitKey === key;
        kit.classList.toggle('is-selected', on);
        const radio = kit.querySelector('input[type="radio"]');
        if (radio && !radio.disabled) radio.checked = on;
      });

      const kit = this.selectedKit();
      const devices = Number(kit?.dataset.devices || 1);
      this.dataset.devices = String(devices);
      this.syncColourAvailability();
      this.updatePrice();
      this.clearError();
    }

    selectColour(btn) {
      if (btn.disabled || btn.classList.contains('is-sold-out')) return;

      const role = btn.dataset.role || 'yours';
      const kit = btn.closest('[data-bkp-kit]') || this.selectedKit();
      kit?.querySelectorAll(`[data-bkp-swatch][data-role="${role}"]`).forEach((el) => {
        el.classList.toggle('is-selected', el === btn);
        el.setAttribute('aria-selected', el === btn ? 'true' : 'false');
      });
      this.updateColourPreview(role, btn);
      this.updatePrice();
      this.clearError();
    }

    updateColourPreview(role, swatch) {
      const kit = swatch?.closest('[data-bkp-kit]') || this.selectedKit();
      const img = kit?.querySelector(`[data-bkp-colour-preview-img="${role}"]`);
      const host = kit?.querySelector(`[data-bkp-colour-preview="${role}"]`);
      const src = String(swatch?.dataset?.image || '').trim();
      if (!img) return;

      if (!src) {
        img.removeAttribute('src');
        img.hidden = true;
        if (host) host.hidden = true;
        return;
      }

      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      img.alt = swatch?.dataset?.label || img.alt || '';
      img.hidden = false;
      if (host) host.hidden = false;
    }

    // Landing from a colour swatch elsewhere on the site (?variant= / ?colour=)
    // should open on that colour instead of the first block.
    requestedColour() {
      let params;
      try {
        params = new URLSearchParams(window.location.search);
      } catch (err) {
        return null;
      }

      const label = (params.get('colour') || params.get('color') || '').trim().toLowerCase();
      const variantId = (params.get('variant') || '').trim();
      if (!label && !variantId) return null;
      return { label, variantId };
    }

    swatchMatchesColour(swatch, request) {
      if (request.variantId) {
        if (swatch.dataset.kitVariantId === request.variantId) return true;
        if (swatch.dataset.variantId === request.variantId) return true;
      }
      if (!request.label) return false;

      const label = String(swatch.dataset.label || '').trim().toLowerCase();
      if (label === request.label) return true;
      if (label === 'ocean' && request.label === 'blue') return true;
      if (label === 'blue' && request.label === 'ocean') return true;
      return false;
    }

    applyUrlColour() {
      const request = this.requestedColour();
      if (!request) return;

      const kit = this.selectedKit();
      const swatches = Array.from(kit?.querySelectorAll('[data-bkp-swatch][data-role="yours"]') || []);
      const match = swatches.find((swatch) => this.swatchMatchesColour(swatch, request));
      if (!match || match.classList.contains('is-sold-out')) return;

      swatches.forEach((swatch) => {
        swatch.classList.toggle('is-selected', swatch === match);
        swatch.setAttribute('aria-selected', swatch === match ? 'true' : 'false');
      });
      this.updateColourPreview('yours', match);
    }

    selectedSwatch(role) {
      return this.selectedKit()?.querySelector(
        `[data-bkp-swatch][data-role="${role}"].is-selected:not(.is-sold-out)`
      );
    }

    isAddonAvailable() {
      const addon = this.querySelector('[data-bkp-addon]');
      if (addon?.dataset.available === 'false') return false;
      if (this.dataset.addonAvailable === 'false') return false;
      return Boolean(this.dataset.addonVariantId && this.dataset.addonSellingPlanId);
    }

    syncAddonUi() {
      const addon = this.querySelector('[data-bkp-addon]');
      const action = this.querySelector('[data-bkp-addon-toggle]');
      const available = this.isAddonAvailable();

      if (!available && this.addonCheck) {
        this.addonCheck.checked = false;
        this.addonCheck.disabled = true;
      }

      const on = available && Boolean(this.addonCheck?.checked);
      if (addon) {
        addon.classList.toggle('is-selected', on);
        addon.classList.toggle('is-sold-out', !available);
        addon.setAttribute('aria-disabled', available ? 'false' : 'true');
      }
      if (action) {
        if (!action.dataset.defaultLabel) {
          action.dataset.defaultLabel = available
            ? action.textContent.trim() || 'ADD'
            : 'ADD';
        }
        action.disabled = !available;
        action.classList.toggle('is-sold-out', !available);
        action.setAttribute('aria-disabled', available ? 'false' : 'true');
        action.textContent = available ? (on ? 'ADDED' : action.dataset.defaultLabel) : 'SOLD OUT';
      }
    }

    updatePrice() {
      const kit = this.selectedKit();
      const available = this.isKitAvailable(kit);
      const yours = this.selectedSwatch('yours');
      const devices = Number(kit?.dataset.devices || 1);
      const matesOk = devices <= 1 || Boolean(this.selectedSwatch('mates'));
      const colourOk = Boolean(yours) && matesOk;

      let cents = Number(kit?.dataset.priceCents || 0);
      if (this.addonCheck?.checked && this.isAddonAvailable()) {
        cents += Number(this.dataset.addonPriceCents || 0);
      }

      let label = `ADD TO CART - ${formatMoney(cents)}`;
      if (!available) label = 'SOLD OUT';
      else if (!colourOk) label = 'CHOOSE A COLOUR';

      const disabled = !available || !colourOk || !kit?.dataset.variantId;

      if (this.atcLabel) this.atcLabel.textContent = label;
      if (this.atc) this.atc.disabled = disabled;

      // Scope to bottom CTA sections only — never overwrite the main kit ATC label.
      document.querySelectorAll('[data-bkp-bottom] [data-bkp-sync-atc-label]').forEach((el) => {
        el.textContent = label;
      });
      document.querySelectorAll('[data-bkp-bottom] [data-bkp-sync-atc]').forEach((btn) => {
        btn.disabled = disabled;
      });

      this.syncExpressCheckout();
    }

    bindSyncAtc() {
      if (this._syncBound) return;
      this._syncBound = true;

      this.mirrorTrustIcons();
      document.addEventListener('DOMContentLoaded', () => this.mirrorTrustIcons());
      window.addEventListener('load', () => this.mirrorTrustIcons());

      // Theme Editor re-renders the bottom CTA when trust toggles; re-mirror + re-price.
      document.addEventListener('shopify:section:load', (event) => {
        const root = event.target;
        if (!(root instanceof Element)) return;
        if (!root.querySelector('[data-bkp-bottom], [data-bkp-mirror-trust]') && !root.matches?.('[data-bkp-bottom]')) {
          return;
        }
        this.mirrorTrustIcons();
        this.updatePrice();
      });

      // Event delegation so newly rendered bottom ATC buttons keep working.
      document.addEventListener('click', (e) => {
        const btn = e.target instanceof Element ? e.target.closest('[data-bkp-sync-atc]') : null;
        if (!btn || !btn.closest('[data-bkp-bottom]')) return;
        e.preventDefault();
        this.scrollToAtc();
      });
    }

    mirrorTrustIcons() {
      const source =
        this.querySelector('[data-bkp-trust-source]') ||
        document.querySelector('brisa-kit-purchase [data-bkp-trust-source], brisa-kit-purchase .bkp__trust');
      if (!source) return;

      document.querySelectorAll('[data-bkp-bottom] [data-bkp-mirror-trust]').forEach((host) => {
        // Trust host only — never touch the ATC button / price label siblings.
        if (!(host instanceof Element) || !host.matches('[data-bkp-mirror-trust]')) return;

        const section = host.closest('[data-bkp-bottom]');
        if (section && section.dataset.showTrust !== 'true') {
          host.replaceChildren();
          return;
        }

        const clone = source.cloneNode(true);
        clone.removeAttribute('data-bkp-trust-source');

        if (section) {
          clone.querySelectorAll('[data-bkp-trust-index]').forEach((item) => {
            const index = item.getAttribute('data-bkp-trust-index');
            // data-show-trust-1 maps to dataset['showTrust-1'], not showTrust1
            if (section.getAttribute(`data-show-trust-${index}`) !== 'true') item.remove();
          });
        }

        if (!clone.querySelector('.bkp__trust-item, [data-bkp-trust-index]')) {
          host.replaceChildren();
          return;
        }

        host.replaceChildren(clone);
      });
    }

    scrollToAtc() {
      const target = this.atc || this;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => {
        try {
          target.focus({ preventScroll: true });
        } catch (err) {
          /* ignore */
        }
      }, 400);
    }

    clearError() {
      if (this.errorEl) this.errorEl.textContent = '';
    }

    setError(msg) {
      if (this.errorEl) this.errorEl.textContent = msg;
    }

    colourVariantMap(kit) {
      try {
        return JSON.parse(kit?.dataset?.colourVariants || '{}');
      } catch (err) {
        return {};
      }
    }

    colourEntry(map, label) {
      if (!label) return null;
      const key = String(label).trim().toLowerCase();
      if (map[key] != null) return map[key];
      if (key === 'ocean' && map.blue != null) return map.blue;
      if (key === 'blue' && map.ocean != null) return map.ocean;
      return null;
    }

    colourEntryId(entry) {
      if (entry == null) return '';
      if (typeof entry === 'object') return entry.id != null ? String(entry.id) : '';
      return String(entry);
    }

    colourEntryAvailable(entry) {
      if (entry == null) return true;
      if (typeof entry === 'object') return entry.available !== false;
      return true;
    }

    deviceVariantId(swatch) {
      const linked = String(swatch?.dataset?.variantId || '').trim();
      if (/^\d+$/.test(linked)) return linked;
      const colour = this.normalizeColourLabel(swatch?.dataset?.label);
      return BrisaKitPurchase.STARTER_COLOUR_VARIANTS[colour] || '';
    }

    // Hard aliases when Liquid map is stale (Ocean is "Blue" in Shopify).
    static STARTER_COLOUR_VARIANTS = {
      black: '54693535777140',
      blue: '54693535809908',
      ocean: '54693535809908',
      rose: '54693535842676',
    };

    static COMMITMENT_COLOUR_VARIANTS = {
      black: '55093166571892',
      blue: '55093166604660',
      ocean: '55093166604660',
      rose: '55093166637428',
    };

    static MATES_PAIR_VARIANTS = {
      'black / black': '55093166670196',
      'black / blue': '55093166702964',
      'black / rose': '55093166735732',
      'blue / black': '55093166768500',
      'blue / blue': '55093166801268',
      'blue / rose': '55093166834036',
      'rose / black': '55093166866804',
      'rose / blue': '55093166899572',
      'rose / rose': '55093166932340',
      // Ocean aliases (UI may say Ocean; Shopify option is Blue)
      'black / ocean': '55093166702964',
      'ocean / black': '55093166768500',
      'ocean / ocean': '55093166801268',
      'ocean / blue': '55093166801268',
      'blue / ocean': '55093166801268',
      'ocean / rose': '55093166834036',
      'rose / ocean': '55093166899572',
    };

    normalizeColourLabel(label) {
      const key = String(label || '')
        .trim()
        .toLowerCase();
      if (key === 'ocean') return 'blue';
      return key;
    }

    resolveColourVariantId(kit, swatch) {
      if (!swatch) return '';
      const kitKey = kit?.dataset?.kitKey || '';
      // Single-colour kits: Starter + Commitment use colour variants on the pack product.
      if (kitKey !== 'try' && kitKey !== 'commitment') return '';

      // Starter swatches bake Ocean→Blue kit variant IDs; only trust those for `try`.
      if (
        kitKey === 'try' &&
        swatch.dataset.kitVariantId &&
        /^\d+$/.test(swatch.dataset.kitVariantId)
      ) {
        return swatch.dataset.kitVariantId;
      }
      const entry = this.colourEntry(this.colourVariantMap(kit), swatch.dataset.label);
      const fromMap = this.colourEntryId(entry);
      if (fromMap && /^\d+$/.test(fromMap)) return fromMap;

      const label = this.normalizeColourLabel(swatch.dataset.label);
      const fallback =
        kitKey === 'commitment'
          ? BrisaKitPurchase.COMMITMENT_COLOUR_VARIANTS[label]
          : BrisaKitPurchase.STARTER_COLOUR_VARIANTS[label];
      return fallback || '';
    }

    resolveMatesPairVariantId(kit, yoursSwatch, matesSwatch) {
      if (!yoursSwatch || !matesSwatch) return '';
      const yours = this.normalizeColourLabel(yoursSwatch.dataset.label);
      const mates = this.normalizeColourLabel(matesSwatch.dataset.label);
      if (!yours || !mates) return '';

      const pairKey = `${yours} / ${mates}`;
      const map = this.colourVariantMap(kit);
      const entry = map[pairKey] != null ? map[pairKey] : map[`${yoursSwatch.dataset.label} / ${matesSwatch.dataset.label}`.toLowerCase()];
      const fromMap = this.colourEntryId(entry);
      if (fromMap && /^\d+$/.test(fromMap)) return fromMap;

      return BrisaKitPurchase.MATES_PAIR_VARIANTS[pairKey] || '';
    }

    syncColourAvailability() {
      const kit = this.selectedKit();
      if (!kit) return;
      const map = this.colourVariantMap(kit);
      const swatches = Array.from(kit.querySelectorAll('[data-bkp-swatch]'));
      const hasMappedColours = swatches.some((swatch) => this.colourEntry(map, swatch.dataset.label) != null);

      ['yours', 'mates'].forEach((role) => {
        const roleSwatches = swatches.filter((swatch) => (swatch.dataset.role || 'yours') === role);

        roleSwatches.forEach((swatch) => {
          const entry = this.colourEntry(map, swatch.dataset.label);
          const soldOutFromMap = hasMappedColours && entry != null && !this.colourEntryAvailable(entry);
          const soldOutFromAttr = swatch.dataset.available === 'false';
          const soldOut = soldOutFromAttr || soldOutFromMap;
          swatch.classList.toggle('is-sold-out', soldOut);
          swatch.disabled = soldOut;
          swatch.setAttribute('aria-disabled', soldOut ? 'true' : 'false');
          if (soldOut) {
            swatch.title = 'Sold out';
            swatch.classList.remove('is-selected');
            swatch.setAttribute('aria-selected', 'false');
          } else {
            swatch.removeAttribute('title');
          }
        });

        let selected = roleSwatches.find(
          (swatch) => swatch.classList.contains('is-selected') && !swatch.classList.contains('is-sold-out')
        );
        if (!selected) {
          selected = roleSwatches.find((swatch) => !swatch.classList.contains('is-sold-out'));
          if (selected) {
            roleSwatches.forEach((swatch) => {
              swatch.classList.toggle('is-selected', swatch === selected);
              swatch.setAttribute('aria-selected', swatch === selected ? 'true' : 'false');
            });
          }
        }
        if (selected) {
          this.updateColourPreview(role, selected);
        }
      });
    }

    expressSelection() {
      const kit = this.selectedKit();
      if (!kit || !this.isKitAvailable(kit)) return null;

      const devices = Number(kit.dataset.devices || 1);
      const yours = this.selectedSwatch('yours');
      const mates = this.selectedSwatch('mates');
      if (!yours || (devices > 1 && !mates)) return null;

      const kitKey = kit.dataset.kitKey || '';
      const isStarterKit = kitKey === 'try';
      const isCommitmentKit = kitKey === 'commitment';
      const isMatesKit = kitKey === 'mates';
      const colourMappedId = isMatesKit
        ? this.resolveMatesPairVariantId(kit, yours, mates)
        : isStarterKit || isCommitmentKit
          ? this.resolveColourVariantId(kit, yours)
          : '';
      const variantId = String(colourMappedId || kit.dataset.variantId || '').trim();
      if (!/^\d+$/.test(variantId)) return null;

      const yourColourLabel = String(yours.dataset.label || '').trim();
      const matesColourLabel = devices > 1 ? String(mates?.dataset?.label || '').trim() : '';
      const colourSummary = [yourColourLabel, matesColourLabel].filter(Boolean).join(' / ');
      const kitLabel = String(kit.dataset.title || '').trim();
      const kitDescription = String(kit.dataset.cartDescription || '').trim();
      const kitImageUrl = String(kit.dataset.cartImageUrl || '').trim();
      const device1Id = this.deviceVariantId(yours);
      const device2Id = devices > 1 ? this.deviceVariantId(mates) : '';
      const canExpand =
        !isStarterKit && device1Id && /^\d+$/.test(device1Id) && device1Id !== variantId;
      const rolloutMarker = String(this.dataset.bundleRollout || '').trim();
      const rolloutReady =
        rolloutMarker &&
        /^\d+$/.test(device1Id) &&
        (devices <= 1 || /^\d+$/.test(device2Id));

      const properties = {
        _bundle: 'brisa-kit',
        _kit_key: kitKey,
        Kit: colourSummary ? `${kitLabel} — ${colourSummary}` : kitLabel,
        'Your colour': yourColourLabel,
        'Device Colour': yourColourLabel,
        Colours: colourSummary,
      };

      if (kitDescription) properties._kit_description = kitDescription;
      if (kitImageUrl) properties._kit_image_url = kitImageUrl;

      if (rolloutReady) {
        properties._bundle_rollout = rolloutMarker;
        properties._bundle_selection_1_variant_id = device1Id;
        properties._bundle_selection_1_label = yourColourLabel;
        if (devices > 1) {
          properties._bundle_selection_2_variant_id = device2Id;
          properties._bundle_selection_2_label = matesColourLabel;
        }
      }

      if (canExpand) properties._device_1_variant_id = device1Id;

      if (devices > 1) {
        properties["Mate's colour"] = matesColourLabel;
        properties['Mate Colour'] = matesColourLabel;
        if (
          canExpand &&
          device2Id &&
          /^\d+$/.test(device2Id) &&
          device2Id !== variantId
        ) {
          properties._device_2_variant_id = device2Id;
        }
        this._expressMatesId ||= uid();
        properties._mates_pack = this._expressMatesId;
      }

      return { variantId, properties };
    }

    syncExpressCheckout() {
      if (!this.express) return;

      const addonSelected = Boolean(this.addonCheck?.checked);
      const selection = this.expressSelection();
      const unavailable = !selection || addonSelected;
      this.express.classList.toggle('is-unavailable', unavailable);

      if (this.expressMessage) {
        this.expressMessage.hidden = !addonSelected;
      }
      const selectedKey = this.selectedKit()?.dataset?.kitKey || '';
      let activeOption = null;
      this.expressOptions.forEach((option) => {
        const active = !unavailable && option.dataset.kitKey === selectedKey;
        option.hidden = !active;
        if (active) activeOption = option;
      });
      if (!selection || !activeOption) return;

      const expressVariant = activeOption.querySelector('[data-bkp-express-variant]');
      const expressProperties = activeOption.querySelector('[data-bkp-express-properties]');
      if (!expressVariant || !expressProperties) return;

      expressVariant.value = selection.variantId;
      expressProperties.replaceChildren();
      Object.entries(selection.properties).forEach(([name, value]) => {
        if (value == null || value === '') return;
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = `properties[${name}]`;
        input.value = String(value);
        expressProperties.appendChild(input);
      });
    }

    extractCartErrorMessage(payload, raw) {
      const normalizeCandidate = (candidate) => {
        if (typeof candidate === 'string') {
          const text = candidate.trim();
          if (!text) return '';
          if (/^cart error$/i.test(text)) return '';
          return text;
        }
        if (candidate && typeof candidate === 'object') {
          const parts = Object.values(candidate)
            .flat()
            .map((v) => String(v || '').trim())
            .filter(Boolean);
          return parts.join(' ');
        }
        return '';
      };

      if (payload && typeof payload === 'object') {
        for (const key of ['description', 'errors', 'message']) {
          const text = normalizeCandidate(payload[key]);
          if (text) return text;
        }
      }

      const rawText = String(raw || '').trim();
      if (!rawText) return '';
      if (rawText.startsWith('{') || rawText.startsWith('[')) {
        try {
          return this.extractCartErrorMessage(JSON.parse(rawText), '');
        } catch (err) {
          return '';
        }
      }
      return rawText;
    }

    friendlyCartError(detail, status) {
      let text = String(detail || '').trim();
      if (text.startsWith('{') || text.startsWith('[')) {
        text = this.extractCartErrorMessage(null, text) || '';
      }

      if (/password|verify|connection needs/i.test(text) || status === 401 || status === 403) {
        return 'Your session expired. Refresh the page, enter the store password if asked, then try again.';
      }
      if (/sold out|not available|cannot be added/i.test(text)) {
        if (/monthly better box/i.test(text)) {
          return 'Monthly Better Box can’t be added right now. Please uncheck it and try again, or refresh the page.';
        }
        return text.length < 180 ? text : 'That item is sold out. Please remove it or choose another option.';
      }
      if (/insufficient/i.test(text)) {
        return 'There isn’t enough stock for that colour. Please choose another.';
      }
      // Prefer Shopify's real message so we don't mislabel transform/channel errors as sold out.
      if (
        text &&
        text.length < 180 &&
        !/^[A-Z_]+$/.test(text) &&
        !/^</.test(text) &&
        !/^[{[]/.test(text)
      ) {
        return text;
      }
      if (status) {
        return `Sorry, we couldn't add that to your bag (error ${status}). Please clear your cart, refresh, and try again.`;
      }
      return FALLBACK_ATC_ERROR;
    }

    async notifyCartAdded() {
      // Match Prestige product-form: page cart type goes straight to /cart.
      if (
        window.themeVariables?.settings?.cartType === 'page' ||
        window.themeVariables?.settings?.pageType === 'cart'
      ) {
        window.location.href = `${window.Shopify?.routes?.root || '/'}cart`;
        return;
      }

      // Otherwise refresh cart + show success toast / drawer.
      try {
        const cartRes = await fetch(`${window.themeVariables?.routes?.cartUrl || '/cart'}.js`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        const cartContent = cartRes.ok ? await cartRes.json() : null;

        if (cartContent) {
          document.documentElement.dispatchEvent(
            new CustomEvent('cart:updated', {
              bubbles: true,
              detail: { cart: cartContent },
            })
          );
          document.documentElement.dispatchEvent(
            new CustomEvent('cart:refresh', {
              bubbles: true,
              detail: {
                cart: cartContent,
                openMiniCart: window.themeVariables?.settings?.cartType === 'drawer',
              },
            })
          );
        } else {
          document.documentElement.dispatchEvent(
            new CustomEvent('cart:refresh', { bubbles: true })
          );
          document.documentElement.dispatchEvent(
            new CustomEvent('cart:updated', { bubbles: true })
          );
        }
      } catch (err) {
        document.documentElement.dispatchEvent(
          new CustomEvent('cart:refresh', { bubbles: true })
        );
        document.documentElement.dispatchEvent(
          new CustomEvent('cart:updated', { bubbles: true })
        );
      }

      document.documentElement.dispatchEvent(
        new CustomEvent('cart-notification:show', {
          bubbles: true,
          cancelable: true,
          detail: { status: 'success', error: '' },
        })
      );
    }

    async addToCart() {
      const kit = this.selectedKit();
      if (!kit) return;

      if (!this.isKitAvailable(kit)) {
        this.setError('This kit is sold out. Please choose another option.');
        return;
      }

      const devices = Number(kit.dataset.devices || 1);
      const yours = this.selectedSwatch('yours');
      const mates = this.selectedSwatch('mates');

      if (!yours) {
        this.setError('Please choose a device colour.');
        return;
      }
      if (devices > 1 && !mates) {
        this.setError("Please choose your mate's device colour.");
        return;
      }

      // Packing-slip path: line item IS the colour (or colour-pair) variant so
      // Australia Post EZ Label / Shopify slips show colour in variant title.
      // Starter + Commitment: Black/Blue/Rose. Mates: "Blue / Rose" pairs.
      const kitKey = kit.dataset.kitKey || '';
      const isStarterKit = kitKey === 'try';
      const isCommitmentKit = kitKey === 'commitment';
      const isMatesKit = kitKey === 'mates';
      const colourMappedId = isMatesKit
        ? this.resolveMatesPairVariantId(kit, yours, mates)
        : isStarterKit || isCommitmentKit
          ? this.resolveColourVariantId(kit, yours)
          : '';
      const variantId = String(colourMappedId || kit.dataset.variantId || '').trim();
      if (!variantId || !/^\d+$/.test(variantId)) {
        this.setError('This colour isn’t available yet. Please choose another.');
        console.warn('[brisa-kit] missing/invalid variant id', {
          kitKey,
          colourMappedId,
          kitVariantId: yours.dataset.kitVariantId,
          kitDefault: kit.dataset.variantId,
          label: yours.dataset.label,
          matesLabel: mates?.dataset?.label,
        });
        return;
      }

      // Cart Transform Option A: only when swatches link SEPARATE device products
      // (data-variant-id from colour block device_product), not pack colour variants.
      const device1Id = this.deviceVariantId(yours);
      const device2Id = devices > 1 ? this.deviceVariantId(mates) : '';
      const canExpand =
        !isStarterKit &&
        device1Id &&
        /^\d+$/.test(device1Id) &&
        device1Id !== variantId;
      const rolloutMarker = String(this.dataset.bundleRollout || '').trim();
      const rolloutReady =
        rolloutMarker &&
        /^\d+$/.test(device1Id) &&
        (devices <= 1 || /^\d+$/.test(device2Id));

      const yourColourLabel = String(yours.dataset.label || '').trim();
      const matesColourLabel =
        devices > 1 ? String(mates?.dataset?.label || '').trim() : '';
      const colourSummary = [yourColourLabel, matesColourLabel].filter(Boolean).join(' / ');
      const kitLabel = String(kit.dataset.title || '').trim();
      const kitDescription = String(kit.dataset.cartDescription || '').trim();
      const kitImageUrl = String(kit.dataset.cartImageUrl || '').trim();

      const properties = {
        _bundle: 'brisa-kit',
        _kit_key: kitKey,
        // Include colours in Kit so warehouse/packing systems that print
        // properties (or only skim Kit) still see the selection.
        Kit: colourSummary ? `${kitLabel} — ${colourSummary}` : kitLabel,
        'Your colour': yourColourLabel,
        'Device Colour': yourColourLabel,
        Colours: colourSummary,
      };

      if (kitDescription) properties._kit_description = kitDescription;
      if (kitImageUrl) properties._kit_image_url = kitImageUrl;

      if (rolloutReady) {
        properties._bundle_rollout = rolloutMarker;
        properties._bundle_selection_1_variant_id = device1Id;
        properties._bundle_selection_1_label = yourColourLabel;
        if (devices > 1) {
          properties._bundle_selection_2_variant_id = device2Id;
          properties._bundle_selection_2_label = matesColourLabel;
        }
      }

      if (canExpand) {
        properties._device_1_variant_id = device1Id;
      }

      if (devices > 1) {
        properties["Mate's colour"] = matesColourLabel;
        properties['Mate Colour'] = matesColourLabel;
        if (
          canExpand &&
          device2Id &&
          /^\d+$/.test(device2Id) &&
          device2Id !== variantId
        ) {
          properties._device_2_variant_id = device2Id;
        }
        properties._mates_pack = uid();
      }

      const items = [
        {
          id: variantId,
          quantity: 1,
          properties,
        },
      ];

      if (this.addonCheck?.checked) {
        if (!this.isAddonAvailable()) {
          this.addonCheck.checked = false;
          this.syncAddonUi();
          this.updatePrice();
          this.setError('Monthly Better Box is sold out right now.');
          return;
        }

        const addonVariantId = Number(this.dataset.addonVariantId);
        const sellingPlanId = Number(this.dataset.addonSellingPlanId);
        if (!Number.isFinite(addonVariantId) || !Number.isFinite(sellingPlanId)) {
          this.setError('Monthly Better Box is unavailable right now.');
          return;
        }
        items.push({
          id: addonVariantId,
          quantity: 1,
          selling_plan: sellingPlanId,
          properties: {
            _bundle: 'brisa-kit-addon',
            _parent_kit: properties._mates_pack || properties._kit_key || kitKey,
          },
        });
      }

      this.atc.disabled = true;
      this.clearError();

      try {
        const res = await fetch(window.themeVariables?.routes?.cartAddUrl || '/cart/add.js', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ items }),
        });

        const raw = await res.text();
        let payload = {};
        try {
          payload = raw ? JSON.parse(raw) : {};
        } catch (err) {
          payload = { message: raw.slice(0, 180) };
        }

        if (!res.ok) {
          console.warn('[brisa-kit] cart/add failed', res.status, raw.slice(0, 500), {
            variantId,
            colourMappedId,
            kitKey,
            label: yours.dataset.label,
            items,
          });
          // Starter only: retry bare once to bypass transform/app hooks on colour variants.
          if (isStarterKit && items.length === 1) {
            const retry = await fetch(window.themeVariables?.routes?.cartAddUrl || '/cart/add.js', {
              method: 'POST',
              credentials: 'same-origin',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({
                items: [
                  {
                    id: variantId,
                    quantity: 1,
                    properties: {
                      Kit: kit.dataset.title || '',
                      'Your colour': yours.dataset.label || '',
                    },
                  },
                ],
              }),
            });
            const retryRaw = await retry.text();
            if (retry.ok) {
              await this.notifyCartAdded();
              return;
            }
            console.warn('[brisa-kit] starter retry failed', retry.status, retryRaw.slice(0, 300));
            let retryPayload = {};
            try {
              retryPayload = retryRaw ? JSON.parse(retryRaw) : {};
            } catch (e) {
              retryPayload = {};
            }
            throw new Error(
              this.friendlyCartError(
                this.extractCartErrorMessage(retryPayload, retryRaw) ||
                  this.extractCartErrorMessage(payload, raw),
                retry.status || res.status
              )
            );
          }

          throw new Error(
            this.friendlyCartError(this.extractCartErrorMessage(payload, raw), res.status)
          );
        }

        await this.notifyCartAdded();
      } catch (err) {
        this.setError(this.friendlyCartError(err?.message || err));
      } finally {
        this.updatePrice();
      }
    }
  }

  if (!customElements.get('brisa-kit-purchase')) {
    customElements.define('brisa-kit-purchase', BrisaKitPurchase);
  }
})();
