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
        if (!this.addonCheck) return;
        this.addonCheck.checked = !this.addonCheck.checked;
        this.syncAddonUi();
        this.updatePrice();
      });

      this.addonCheck?.addEventListener('change', () => {
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

    syncAddonUi() {
      const addon = this.querySelector('[data-bkp-addon]');
      const action = this.querySelector('[data-bkp-addon-toggle]');
      const on = Boolean(this.addonCheck?.checked);
      if (addon) addon.classList.toggle('is-selected', on);
      if (action) {
        if (!action.dataset.defaultLabel) {
          action.dataset.defaultLabel = action.textContent.trim() || 'ADD';
        }
        action.textContent = on ? 'ADDED' : action.dataset.defaultLabel;
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
      if (this.addonCheck?.checked) {
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

    resolveColourVariantId(kit, swatch) {
      if (!swatch) return '';
      // Prefer kit colour variant baked onto the swatch (Ocean → Blue on Starter Kit).
      if (swatch.dataset.kitVariantId) return swatch.dataset.kitVariantId;
      const entry = this.colourEntry(this.colourVariantMap(kit), swatch.dataset.label);
      return this.colourEntryId(entry);
    }

    syncColourAvailability() {
      const kit = this.selectedKit();
      const map = this.colourVariantMap(kit);
      const swatches = Array.from(this.querySelectorAll('[data-bkp-swatch]'));
      const hasMappedColours = swatches.some((swatch) => this.colourEntry(map, swatch.dataset.label) != null);

      ['yours', 'mates'].forEach((role) => {
        const roleSwatches = swatches.filter((swatch) => (swatch.dataset.role || 'yours') === role);
        let selected = roleSwatches.find((swatch) => swatch.classList.contains('is-selected'));

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

        selected = roleSwatches.find((swatch) => swatch.classList.contains('is-selected') && !swatch.classList.contains('is-sold-out'));
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

    friendlyCartError(detail, status) {
      const text = String(detail || '').trim();
      if (/password|verify|connection needs/i.test(text) || status === 401 || status === 403) {
        return 'Your session expired. Refresh the page, enter the store password if asked, then try again.';
      }
      if (/sold out/i.test(text)) {
        return 'This option is sold out. Please choose another kit or colour.';
      }
      if (/insufficient/i.test(text)) {
        return 'There isn’t enough stock for that colour. Please choose another.';
      }
      if (/bundle|selling.plan|cannot be added|not available/i.test(text)) {
        return text.length < 180
          ? text
          : 'That item couldn’t be added to your bag. Clear your cart, refresh, and try again.';
      }
      if (text && text.length < 160 && !/^[A-Z_]+$/.test(text) && !/^</.test(text)) {
        return text;
      }
      if (status) {
        return `Sorry, we couldn't add that to your bag (error ${status}). Please clear your cart, refresh, and try again.`;
      }
      return FALLBACK_ATC_ERROR;
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

      // Starter Kit colour variants live on the kit product (Black/Ocean/Rose).
      const colourMappedId = this.resolveColourVariantId(kit, yours);
      const variantId = String(colourMappedId || kit.dataset.variantId || '').trim();
      if (!variantId || !/^\d+$/.test(variantId)) {
        this.setError('This colour isn’t available yet. Please choose another.');
        console.warn('[brisa-kit] missing/invalid variant id', {
          colourMappedId,
          kitVariantId: yours.dataset.kitVariantId,
          kitDefault: kit.dataset.variantId,
          label: yours.dataset.label,
        });
        return;
      }

      // Cart Transform Option A only: separate $0 device products on the swatch.
      // Never send the kit colour variant as _device_* — that expands the line into
      // the same variant twice and Shopify rejects the add.
      const device1Id = String(yours.dataset.variantId || '').trim();
      const device2Id = devices > 1 ? String(mates.dataset.variantId || '').trim() : '';

      const properties = {
        _bundle: 'brisa-kit',
        _kit_key: kit.dataset.kitKey || '',
        Kit: kit.dataset.title || '',
        'Your colour': yours.dataset.label || '',
      };
      if (device1Id && /^\d+$/.test(device1Id) && device1Id !== variantId) {
        properties._device_1_variant_id = device1Id;
      }

      if (devices > 1) {
        properties["Mate's colour"] = mates.dataset.label || '';
        if (device2Id && /^\d+$/.test(device2Id) && device2Id !== variantId && device2Id !== device1Id) {
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

      if (this.addonCheck?.checked && this.dataset.addonVariantId) {
        const sellingPlanId = String(this.dataset.addonSellingPlanId || '').trim();
        if (!sellingPlanId) {
          this.setError('Monthly Better Box is not available right now. Please try again later.');
          return;
        }

        items.push({
          id: String(this.dataset.addonVariantId),
          quantity: 1,
          selling_plan: sellingPlanId,
          properties: {
            _bundle: 'brisa-kit-addon',
            _parent_kit: properties._mates_pack || properties._kit_key,
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
            label: yours.dataset.label,
            items,
          });
          throw new Error(
            this.friendlyCartError(payload.description || payload.message || raw, res.status)
          );
        }

        document.documentElement.dispatchEvent(
          new CustomEvent('cart:refresh', {
            bubbles: true,
            detail: { open: true },
          })
        );
        document.documentElement.dispatchEvent(
          new CustomEvent('cart:updated', { bubbles: true })
        );
      } catch (err) {
        this.setError(this.friendlyCartError(err.message));
      } finally {
        this.updatePrice();
      }
    }
  }

  if (!customElements.get('brisa-kit-purchase')) {
    customElements.define('brisa-kit-purchase', BrisaKitPurchase);
  }
})();
