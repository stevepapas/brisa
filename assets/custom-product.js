/** Product-only Brisa interactions. */

class BrisaProductTestimonials extends HTMLElement {
  constructor() {
    super();
    this.currentIndex = 0;
    this.autoplayInterval = null;
    this.touchStartX = 0;
    this.touchEndX = 0;
    this.handleResize = this.handleResize.bind(this);
  }

  connectedCallback() {
    this.track = this.querySelector('.brisa-product-testimonials__track');
    this.cards = Array.from(this.querySelectorAll('.brisa-product-testimonials__card'));
    this.prevButton = this.querySelector('.brisa-product-testimonials__nav--prev');
    this.nextButton = this.querySelector('.brisa-product-testimonials__nav--next');
    this.dotsContainer = this.querySelector('.brisa-product-testimonials__dots');
    this.autoplay = this.dataset.autoplay === 'true';
    this.autoplaySpeed = parseInt(this.dataset.autoplaySpeed, 10) || 5000;
    this.mobilePageSize = parseInt(this.dataset.mobilePageSize, 10) || 2;
    this.desktopPageSize = parseInt(this.dataset.desktopPageSize, 10) || 3;
    this.mobileQuery = window.matchMedia('(max-width: 749px)');

    if (!this.track || this.cards.length === 0) return;

    this.setupEventListeners();
    this.refresh();

    if (this.autoplay && this.totalSlides > 1) {
      this.startAutoplay();
    }
  }

  disconnectedCallback() {
    this.pauseAutoplay();
    window.removeEventListener('resize', this.handleResize);
  }

  setupEventListeners() {
    if (this.prevButton) {
      this.prevButton.addEventListener('click', () => this.goToPrev());
    }

    if (this.nextButton) {
      this.nextButton.addEventListener('click', () => this.goToNext());
    }

    this.addEventListener('mouseenter', () => this.pauseAutoplay());
    this.addEventListener('mouseleave', () => {
      if (this.autoplay && this.totalSlides > 1) this.startAutoplay();
    });

    this.track.addEventListener('touchstart', (event) => {
      this.touchStartX = event.changedTouches[0].screenX;
    }, { passive: true });

    this.track.addEventListener('touchend', (event) => {
      this.touchEndX = event.changedTouches[0].screenX;
      this.handleSwipe();
    }, { passive: true });

    window.addEventListener('resize', this.handleResize);
  }

  handleResize() {
    const previousPageSize = this.pageSize;
    this.refresh();

    if (previousPageSize !== this.pageSize) {
      this.goToSlide(0);
    }
  }

  refresh() {
    this.pageSize = this.mobileQuery.matches ? this.mobilePageSize : this.desktopPageSize;
    this.totalSlides = Math.ceil(this.cards.length / this.pageSize);
    this.currentIndex = Math.min(this.currentIndex, Math.max(this.totalSlides - 1, 0));
    this.renderDots();
    this.updateCarousel();
  }

  renderDots() {
    if (!this.dotsContainer) return;

    this.dotsContainer.innerHTML = '';

    for (let index = 0; index < this.totalSlides; index += 1) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'brisa-product-testimonials__dot';
      dot.dataset.index = index;
      dot.setAttribute('aria-label', `Go to testimonial group ${index + 1}`);
      dot.addEventListener('click', () => this.goToSlide(index));
      this.dotsContainer.appendChild(dot);
    }

    this.dots = Array.from(this.dotsContainer.querySelectorAll('.brisa-product-testimonials__dot'));
  }

  handleSwipe() {
    const diff = this.touchStartX - this.touchEndX;
    if (Math.abs(diff) < 50) return;
    diff > 0 ? this.goToNext() : this.goToPrev();
  }

  goToPrev() {
    this.goToSlide((this.currentIndex - 1 + this.totalSlides) % this.totalSlides);
  }

  goToNext() {
    this.goToSlide((this.currentIndex + 1) % this.totalSlides);
  }

  goToSlide(index) {
    if (Number.isNaN(index) || this.totalSlides <= 0) return;
    this.currentIndex = Math.max(0, Math.min(index, this.totalSlides - 1));
    this.updateCarousel();
    this.resetAutoplay();
  }

  updateCarousel() {
    const firstCardIndex = this.currentIndex * this.pageSize;
    const targetCard = this.cards[firstCardIndex];
    const offset = targetCard ? targetCard.offsetLeft : 0;

    this.track.style.transform = `translateX(${-offset}px)`;

    if (this.dots) {
      this.dots.forEach((dot, index) => {
        if (index === this.currentIndex) {
          dot.setAttribute('aria-current', 'true');
        } else {
          dot.removeAttribute('aria-current');
        }
      });
    }
  }

  startAutoplay() {
    this.pauseAutoplay();
    this.autoplayInterval = setInterval(() => this.goToNext(), this.autoplaySpeed);
  }

  pauseAutoplay() {
    if (!this.autoplayInterval) return;
    clearInterval(this.autoplayInterval);
    this.autoplayInterval = null;
  }

  resetAutoplay() {
    if (!this.autoplay || this.totalSlides <= 1) return;
    this.startAutoplay();
  }
}

if (!customElements.get('brisa-product-testimonials')) {
  customElements.define('brisa-product-testimonials', BrisaProductTestimonials);
}

function slideMatchesKitSet(element, kitSet) {
  const slideKit = element?.dataset?.kitSet || 'both';
  return kitSet === 'all' || slideKit === 'both' || slideKit === kitSet;
}

function withSlideshowBrisaSyncLock(section, fn) {
  if (!section) return;
  if (section._brisaSlideshowSyncing) return;
  section._brisaSlideshowSyncing = true;
  try {
    fn();
  } finally {
    // Release after the current stack so nested MutationObserver / select callbacks stay locked.
    queueMicrotask(() => {
      section._brisaSlideshowSyncing = false;
    });
  }
}

function applySlideshowBrisaKit(section, kitSet) {
  if (!section || !kitSet) return;

  const slideshow = section.querySelector('slide-show.slideshow-brisa');
  const pageDots = section.querySelector('page-dots.slideshow-brisa__dots');
  const navBar = section.querySelector('.slideshow-brisa__nav-bar');
  if (!slideshow) return;

  withSlideshowBrisaSyncLock(section, () => {
    section.dataset.activeKitSet = kitSet;

    const items = Array.from(slideshow.querySelectorAll('slide-show-item'));
    const thumbs = pageDots ? Array.from(pageDots.querySelectorAll('.slideshow-brisa__thumb')) : [];
    const visibleItems = items.filter((item) => slideMatchesKitSet(item, kitSet));
    const visibleThumbs = thumbs.filter((thumb) => slideMatchesKitSet(thumb, kitSet));
    const firstItem = visibleItems[0] || null;
    const firstThumb = visibleThumbs[0] || null;
    const firstItemIndex = firstItem ? items.indexOf(firstItem) : -1;
    const firstThumbIndex = firstThumb ? thumbs.indexOf(firstThumb) : -1;

    // Never blank the gallery: keep the first matching slide visible while hiding the rest.
    items.forEach((item) => {
      if (item === firstItem) {
        item.removeAttribute('hidden');
      } else {
        item.setAttribute('hidden', '');
      }
    });

    thumbs.forEach((thumb) => {
      const matches = slideMatchesKitSet(thumb, kitSet);
      thumb.hidden = !matches;
      thumb.setAttribute('aria-selected', 'false');
      thumb.removeAttribute('aria-current');
    });

    if (firstThumb) {
      firstThumb.setAttribute('aria-selected', 'true');
      firstThumb.setAttribute('aria-current', 'true');
    }

    if (navBar) {
      navBar.hidden = visibleItems.length <= 1;
    }

    const peekPrev = section.querySelector('[data-slideshow-brisa-peek-prev]');
    const peekNext = section.querySelector('[data-slideshow-brisa-peek-next]');
    const hidePeeks = visibleItems.length <= 1;
    if (peekPrev) {
      peekPrev.classList.toggle('is-empty', hidePeeks);
      peekPrev.hidden = false;
    }
    if (peekNext) {
      peekNext.classList.toggle('is-empty', hidePeeks);
      peekNext.hidden = false;
    }

    if (pageDots && firstThumbIndex >= 0 && pageDots.selectedIndex !== firstThumbIndex) {
      pageDots.selectedIndex = firstThumbIndex;
    }

    // Re-assert first slide through the Slideshow API after kit filtering.
    if (firstItemIndex >= 0 && typeof slideshow.select === 'function' && slideshow.selectedIndex !== firstItemIndex) {
      slideshow.select(firstItemIndex, false);
    }
  });
}

function initSlideshowBrisaSection(section) {
  if (section.dataset.slideshowBrisaInit === 'true') return;

  const slideshow = section.querySelector('slide-show.slideshow-brisa');
  const pageDots = section.querySelector('page-dots.slideshow-brisa__dots');
  if (!slideshow || !pageDots) return;

  section.dataset.slideshowBrisaInit = 'true';

  pageDots.addEventListener('page-dots:changed', (event) => {
    if (typeof slideshow.select === 'function') {
      slideshow.select(event.detail.index, true);
    }
  });

  const items = Array.from(slideshow.querySelectorAll('slide-show-item'));
  const peekPrev = section.querySelector('[data-slideshow-brisa-peek-prev]');
  const peekNext = section.querySelector('[data-slideshow-brisa-peek-next]');
  const peekPrevImage = section.querySelector('[data-slideshow-brisa-peek-prev-image]');
  const peekNextImage = section.querySelector('[data-slideshow-brisa-peek-next-image]');

  const setPeekImage = (peek, peekImage, slide) => {
    if (!peek || !peekImage) return;
    if (!slide) {
      peek.classList.add('is-empty');
      peek.setAttribute('aria-hidden', 'true');
      peek.tabIndex = -1;
      peek.hidden = false;
      return;
    }
    const img = slide.querySelector('.slideshow__image');
    const src = img?.currentSrc || img?.getAttribute('src') || '';
    if (src) {
      peekImage.src = src;
      peek.classList.remove('is-empty');
      peek.removeAttribute('aria-hidden');
      peek.tabIndex = 0;
      peek.hidden = false;
    } else {
      peek.classList.add('is-empty');
      peek.setAttribute('aria-hidden', 'true');
      peek.tabIndex = -1;
      peek.hidden = false;
    }
  };

  const syncPeek = () => {
    if (items.length < 2) {
      setPeekImage(peekPrev, peekPrevImage, null);
      setPeekImage(peekNext, peekNextImage, null);
      return;
    }

    const kitSet = section.dataset.activeKitSet || 'all';
    const kitItems = items.filter((item) => slideMatchesKitSet(item, kitSet));
    if (kitItems.length < 2) {
      setPeekImage(peekPrev, peekPrevImage, null);
      setPeekImage(peekNext, peekNextImage, null);
      return;
    }

    const index = kitItems.findIndex((item) => !item.hasAttribute('hidden'));
    if (index < 0) return;

    // No wrap at ends — empty slots stay as white gutters so the main slide does not shift.
    const prev = index > 0 ? kitItems[index - 1] : null;
    const next = index < kitItems.length - 1 ? kitItems[index + 1] : null;
    setPeekImage(peekPrev, peekPrevImage, prev);
    setPeekImage(peekNext, peekNextImage, next);
  };

  const syncDots = () => {
    // Guard against infinite loops: slideshow.select() toggles `hidden`, which
    // re-enters this observer and can freeze the page on load.
    if (section._brisaSlideshowSyncing) return;

    withSlideshowBrisaSyncLock(section, () => {
      const kitSet = section.dataset.activeKitSet || 'all';
      const thumbs = Array.from(pageDots.querySelectorAll('.slideshow-brisa__thumb'));
      const visibleIndex = items.findIndex((item) => !item.hasAttribute('hidden') && slideMatchesKitSet(item, kitSet));
      if (visibleIndex >= 0) {
        const activeItem = items[visibleIndex];
        const thumbIndex = thumbs.findIndex((thumb) => thumb.getAttribute('aria-controls') === activeItem.id);
        const selectedIndex = thumbIndex >= 0 ? thumbIndex : visibleIndex;
        if (pageDots.selectedIndex !== selectedIndex) {
          pageDots.selectedIndex = selectedIndex;
        }
      }
      syncPeek();
    });
  };

  items.forEach((item) => {
    new MutationObserver(syncDots).observe(item, {
      attributes: true,
      attributeFilter: ['hidden'],
    });
  });

  if (peekPrev) {
    peekPrev.addEventListener('click', () => {
      if (typeof slideshow.previous === 'function') slideshow.previous();
    });
  }

  if (peekNext) {
    peekNext.addEventListener('click', () => {
      if (typeof slideshow.next === 'function') slideshow.next();
    });
  }

  syncPeek();
}

function detectSlideshowBrisaKitFromUrl(section) {
  const match = window.location.pathname.match(/\/products\/([^/?#]+)/);
  if (!match) return null;

  const handle = match[1];
  const matesHandle = section.dataset.matesHandle || '';
  const starterHandle = section.dataset.starterHandle || '';
  const starterPrefix = section.dataset.starterHandlePrefix || 'brisa-device-';

  if (matesHandle && handle === matesHandle) return 'mates';
  if (starterPrefix && handle.startsWith(starterPrefix)) return 'starter';
  if (starterHandle && handle === starterHandle) return 'starter';

  return null;
}

function syncSlideshowBrisaKitFromPage(section) {
  const kitFromUrl = detectSlideshowBrisaKitFromUrl(section);
  const kitSet = kitFromUrl || section.dataset.activeKitSet;

  if (kitSet && kitSet !== 'all') {
    applySlideshowBrisaKit(section, kitSet);
  }
}

function initAllSlideshowBrisaSections(root = document) {
  root.querySelectorAll('.shopify-section--slideshow-brisa').forEach((section) => {
    initSlideshowBrisaSection(section);
    syncSlideshowBrisaKitFromPage(section);
  });
}

document.addEventListener('click', (event) => {
  const kitCard = event.target.closest('.product-kit-picker__card--starter, .product-kit-picker__card--mates');
  if (!kitCard) return;

  const kitSet = kitCard.classList.contains('product-kit-picker__card--mates') ? 'mates' : 'starter';
  document.querySelectorAll('.shopify-section--slideshow-brisa').forEach((section) => {
    applySlideshowBrisaKit(section, kitSet);
  });
});

document.addEventListener('DOMContentLoaded', () => initAllSlideshowBrisaSections());
document.addEventListener('shopify:section:load', (event) => {
  const section = event.target?.closest?.('.shopify-section--slideshow-brisa') ?? event.target;
  if (section?.classList?.contains('shopify-section--slideshow-brisa')) {
    initSlideshowBrisaSection(section);
  }
});

document.addEventListener('prev-next:prev', (event) => {
  const navBar = event.target.closest('.slideshow-brisa__nav-bar');
  if (!navBar) return;

  const slideshow = getSlideshowBrisaFromNav(navBar);
  if (slideshow && typeof slideshow.previous === 'function') {
    slideshow.previous();
  }
});

document.addEventListener('prev-next:next', (event) => {
  const navBar = event.target.closest('.slideshow-brisa__nav-bar');
  if (!navBar) return;

  const slideshow = getSlideshowBrisaFromNav(navBar);
  if (slideshow && typeof slideshow.next === 'function') {
    slideshow.next();
  }
});

/**
 * Cores cart stepper shows display units (1 = 3 Shopify packs).
 * Convert typed display qty → Shopify qty before LineItemQuantity reads the value.
 */
document.addEventListener('change', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (!input.matches('input[data-brisa-cores-step]')) return;

  const step = parseInt(input.getAttribute('data-brisa-cores-step') || '3', 10);
  if (!Number.isFinite(step) || step <= 1) return;

  const displayQty = parseInt(input.value, 10);
  if (!Number.isFinite(displayQty)) return;

  input.value = String(Math.max(0, displayQty * step));
}, true);
