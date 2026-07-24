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
      if (swatch.dataset.variantId) return swatch.dataset.variantId;
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
          const soldOut = hasMappedColours && entry != null && !this.colourEntryAvailable(entry);
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

    friendlyCartError(detail) {
      const text = String(detail || '').trim();
      if (/sold out|not available|insufficient/i.test(text)) {
        return 'This option is sold out. Please choose another kit or colour.';
      }
      if (text && text.length < 140 && !/^[A-Z_]+$/.test(text)) {
        return text;
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

      // Prefer the kit colour variant that matches the selected swatch (Starter Kit
      // is a Color product). Fall back to the kit card's default variant id.
      const colourMappedId = this.resolveColourVariantId(kit, yours);
      const variantId = colourMappedId || kit.dataset.variantId;
      if (!variantId) {
        this.setError('This kit is not available yet.');
        return;
      }

      const properties = {
        _bundle: 'brisa-kit',
        _kit_key: kit.dataset.kitKey || '',
        Kit: kit.dataset.title || '',
        'Your colour': yours.dataset.label || '',
        _device_1_variant_id: yours.dataset.variantId || colourMappedId || '',
      };

      if (devices > 1) {
        properties["Mate's colour"] = mates.dataset.label || '';
        properties._device_2_variant_id =
          mates.dataset.variantId || this.resolveColourVariantId(kit, mates) || '';
        properties._mates_pack = uid();
      }

      const items = [
        {
          id: Number(variantId),
          quantity: 1,
          properties,
        },
      ];

      if (this.addonCheck?.checked && this.dataset.addonVariantId) {
        const sellingPlanId = Number(this.dataset.addonSellingPlanId || 0);
        if (!sellingPlanId) {
          this.setError('Monthly Better Box is not available right now. Please try again later.');
          return;
        }

        items.push({
          id: Number(this.dataset.addonVariantId),
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
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ items }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(this.friendlyCartError(err.description || err.message));
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
