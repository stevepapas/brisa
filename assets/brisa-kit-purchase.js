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
      this.colourRoot = this.querySelector('[data-bkp-colours]');
      this.yoursName = this.querySelector('[data-bkp-colour-name="yours"]');
      this.matesName = this.querySelector('[data-bkp-colour-name="mates"]');

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
          if (btn.disabled || btn.classList.contains('is-sold-out')) {
            event.preventDefault();
            return;
          }
          this.selectColour(btn);
        });
      });

      this.querySelector('[data-bkp-addon-toggle]')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (!this.isAddonAvailable() || !this.addonCheck || this.addonCheck.disabled) return;
        this.addonCheck.checked = !this.addonCheck.checked;
        this.syncAddonUi();
        this.updatePrice();
      });

      this.addonCheck?.addEventListener('change', () => {
        if (!this.isAddonAvailable()) {
          this.addonCheck.checked = false;
        }
        this.syncAddonUi();
        this.updatePrice();
      });
      this.syncAddonUi();
      this.atc?.addEventListener('click', (e) => {
        e.preventDefault();
        this.addToCart();
      });

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
      this.querySelectorAll(`[data-bkp-swatch][data-role="${role}"]`).forEach((el) => {
        el.classList.toggle('is-selected', el === btn);
      });
      const nameEl = role === 'mates' ? this.matesName : this.yoursName;
      if (nameEl) nameEl.textContent = btn.dataset.label || '';
      this.updatePrice();
      this.clearError();
    }

    selectedSwatch(role) {
      return this.querySelector(`[data-bkp-swatch][data-role="${role}"].is-selected:not(.is-sold-out)`);
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
        action.textContent = available ? (on ? 'ADDED' : action.dataset.defaultLabel) : 'Sold out';
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

      document.querySelectorAll('[data-bkp-sync-atc-label]').forEach((el) => {
        el.textContent = label;
      });
      document.querySelectorAll('[data-bkp-sync-atc]').forEach((btn) => {
        btn.disabled = disabled;
      });
    }

    bindSyncAtc() {
      if (this._syncBound) return;
      this._syncBound = true;

      this.mirrorTrustIcons();
      document.addEventListener('DOMContentLoaded', () => this.mirrorTrustIcons());
      window.addEventListener('load', () => this.mirrorTrustIcons());

      document.querySelectorAll('[data-bkp-sync-atc]').forEach((btn) => {
        if (btn.dataset.bkpSyncBound) return;
        btn.dataset.bkpSyncBound = '1';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.scrollToAtc();
        });
      });
    }

    mirrorTrustIcons() {
      const source =
        this.querySelector('[data-bkp-trust-source]') ||
        document.querySelector('brisa-kit-purchase [data-bkp-trust-source], brisa-kit-purchase .bkp__trust');
      if (!source) return;

      document.querySelectorAll('[data-bkp-mirror-trust]').forEach((host) => {
        const clone = source.cloneNode(true);
        clone.removeAttribute('data-bkp-trust-source');
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

    // Hard aliases for Starter Kit colour labels → variant IDs (Ocean is "Blue" in Shopify).
    static STARTER_COLOUR_VARIANTS = {
      black: '54693535777140',
      blue: '54693535809908',
      ocean: '54693535809908',
      rose: '54693535842676',
    };

    resolveColourVariantId(kit, swatch) {
      if (!swatch) return '';
      // Only Starter Kit (`try`) uses colour variants on the kit product itself.
      // Commitment / Mates always add the pack parent; colour is property text.
      if (kit?.dataset?.kitKey !== 'try') return '';

      // Prefer kit colour variant baked onto the swatch (Ocean → Blue on Starter Kit).
      if (swatch.dataset.kitVariantId && /^\d+$/.test(swatch.dataset.kitVariantId)) {
        return swatch.dataset.kitVariantId;
      }
      const entry = this.colourEntry(this.colourVariantMap(kit), swatch.dataset.label);
      const fromMap = this.colourEntryId(entry);
      if (fromMap && /^\d+$/.test(fromMap)) return fromMap;

      const label = String(swatch.dataset.label || '').trim().toLowerCase();
      if (BrisaKitPurchase.STARTER_COLOUR_VARIANTS[label]) {
        return BrisaKitPurchase.STARTER_COLOUR_VARIANTS[label];
      }
      return '';
    }

    syncColourAvailability() {
      const kit = this.selectedKit();
      const map = this.colourVariantMap(kit);
      const swatches = Array.from(this.querySelectorAll('[data-bkp-swatch]'));
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
            roleSwatches.forEach((swatch) => swatch.classList.toggle('is-selected', swatch === selected));
            const nameEl = role === 'mates' ? this.matesName : this.yoursName;
            if (nameEl) nameEl.textContent = selected.dataset.label || '';
          }
        }
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
      // Match Prestige product-form behaviour: refresh cart + show success toast.
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

      // Starter Kit: line item IS the colour variant (Black/Ocean/Rose).
      // Commitment / Mates: line item is the pack product; colour is property text only.
      const kitKey = kit.dataset.kitKey || '';
      const isStarterKit = kitKey === 'try';
      const colourMappedId = isStarterKit ? this.resolveColourVariantId(kit, yours) : '';
      const variantId = String(
        (isStarterKit ? colourMappedId : '') || kit.dataset.variantId || ''
      ).trim();
      if (!variantId || !/^\d+$/.test(variantId)) {
        this.setError('This colour isn’t available yet. Please choose another.');
        console.warn('[brisa-kit] missing/invalid variant id', {
          kitKey,
          colourMappedId,
          kitVariantId: yours.dataset.kitVariantId,
          kitDefault: kit.dataset.variantId,
          label: yours.dataset.label,
        });
        return;
      }

      // Cart Transform Option A: only when swatches link SEPARATE device products
      // (data-variant-id from colour block device_product), not starter kit colours.
      const device1Id = String(yours.dataset.variantId || '').trim();
      const device2Id = devices > 1 ? String(mates.dataset.variantId || '').trim() : '';
      const canExpand =
        !isStarterKit &&
        device1Id &&
        /^\d+$/.test(device1Id) &&
        device1Id !== variantId;

      const properties = {
        _bundle: 'brisa-kit',
        _kit_key: kitKey,
        Kit: kit.dataset.title || '',
        'Your colour': yours.dataset.label || '',
      };

      if (canExpand) {
        properties._device_1_variant_id = device1Id;
      }

      if (devices > 1) {
        properties["Mate's colour"] = mates.dataset.label || '';
        if (
          canExpand &&
          device2Id &&
          /^\d+$/.test(device2Id) &&
          device2Id !== variantId &&
          device2Id !== device1Id
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

        const sellingPlanId = String(this.dataset.addonSellingPlanId || '').trim();
        items.push({
          id: String(this.dataset.addonVariantId),
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
