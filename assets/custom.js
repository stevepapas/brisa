/**
 * DEVELOPER DOCUMENTATION
 *
 * Include your custom JavaScript here.
 *
 * The theme Focal has been developed to be easily extensible through the usage of a lot of different JavaScript
 * events, as well as the usage of custom elements (https://developers.google.com/web/fundamentals/web-components/customelements)
 * to easily extend the theme and re-use the theme infrastructure for your own code.
 *
 * The technical documentation is summarized here.
 *
 * ------------------------------------------------------------------------------------------------------------
 * BEING NOTIFIED WHEN A VARIANT HAS CHANGED
 * ------------------------------------------------------------------------------------------------------------
 *
 * This event is fired whenever a the user has changed the variant in a selector. The target get you the form
 * that triggered this event.
 *
 * Example:
 *
 * document.addEventListener('variant:changed', function(event) {
 *   let variant = event.detail.variant; // Gives you access to the whole variant details
 *   let form = event.target;
 * });
 *
 * ------------------------------------------------------------------------------------------------------------
 * MANUALLY CHANGE A VARIANT
 * ------------------------------------------------------------------------------------------------------------
 *
 * You may want to manually change the variant, and let the theme automatically adjust all the selectors. To do
 * that, you can get the DOM element of type "<product-variants>", and call the selectVariant method on it with
 * the variant ID.
 *
 * Example:
 *
 * const productVariantElement = document.querySelector('product-variants');
 * productVariantElement.selectVariant(12345);
 *
 * ------------------------------------------------------------------------------------------------------------
 * BEING NOTIFIED WHEN A NEW VARIANT IS ADDED TO THE CART
 * ------------------------------------------------------------------------------------------------------------
 *
 * This event is fired whenever a variant is added to the cart through a form selector (product page, quick
 * view...). This event DOES NOT include any change done through the cart on an existing variant. For that,
 * please refer to the "cart:updated" event.
 *
 * Example:
 *
 * document.addEventListener('variant:added', function(event) {
 *   var variant = event.detail.variant; // Get the variant that was added
 * });
 *
 * ------------------------------------------------------------------------------------------------------------
 * BEING NOTIFIED WHEN THE CART CONTENT HAS CHANGED
 * ------------------------------------------------------------------------------------------------------------
 *
 * This event is fired whenever the cart content has changed (if the quantity of a variant has changed, if a variant
 * has been removed, if the note has changed...). This event will also be emitted when a new variant has been
 * added (so you will receive both "variant:added" and "cart:updated"). Contrary to the variant:added event,
 * this event will give you the complete details of the cart.
 *
 * Example:
 *
 * document.addEventListener('cart:updated', function(event) {
 *   var cart = event.detail.cart; // Get the updated content of the cart
 * });
 *
 * ------------------------------------------------------------------------------------------------------------
 * REFRESH THE CART/MINI-CART
 * ------------------------------------------------------------------------------------------------------------
 *
 * If you are adding variants to the cart and would like to instruct the theme to re-render the cart, you cart
 * send the cart:refresh event, as shown below:
 *
 * document.documentElement.dispatchEvent(new CustomEvent('cart:refresh', {
 *   bubbles: true
 * }));
 *
 * ------------------------------------------------------------------------------------------------------------
 * USAGE OF CUSTOM ELEMENTS
 * ------------------------------------------------------------------------------------------------------------
 *
 * Our theme makes extensive use of HTML custom elements. Custom elements are an awesome way to extend HTML
 * by creating new elements that carry their own JavaScript for adding new behavior. The theme uses a large
 * number of custom elements, but the two most useful are drawer and popover. Each of those components add
 * a "open" attribute that you can toggle on and off. For instance, let's say you would like to open the cart
 * drawer, whose id is "mini-cart", you simply need to retrieve it and set its "open" attribute to true (or
 * false to close it):
 *
 * document.getElementById('mini-cart').open = true;
 *
 * Thanks to the power of custom elements, the theme will take care automagically of trapping focus, maintaining
 * proper accessibility attributes...
 *
 * If you would like to create your own drawer, you can re-use the <drawer-content> content. Here is a simple
 * example:
 *
 * // Make sure you add "aria-controls", "aria-expanded" and "is" HTML attributes to your button:
 * <button type="button" is="toggle-button" aria-controls="id-of-drawer" aria-expanded="false">Open drawer</button>
 *
 * <drawer-content id="id-of-drawer">
 *   Your content
 * </drawer-content>
 *
 * The nice thing with custom elements is that you do not actually need to instantiate JavaScript yourself: this
 * is done automatically as soon as the element is inserted to the DOM.
 *
 * ------------------------------------------------------------------------------------------------------------
 * THEME DEPENDENCIES
 * ------------------------------------------------------------------------------------------------------------
 *
 * While the theme tries to keep outside dependencies as small as possible, the theme still uses third-party code
 * to power some of its features. Here is the list of all dependencies:
 *
 * "vendor.js":
 *
 * The vendor.js contains required dependencies. This file is loaded in parallel of the theme file.
 *
 * - custom-elements polyfill (used for built-in elements on Safari - v1.0.0): https://github.com/ungap/custom-elements
 * - web-animations-polyfill (used for polyfilling WebAnimations on Safari 12, this polyfill will be removed in 1 year - v2.3.2): https://github.com/web-animations/web-animations-js
 * - instant-page (v5.1.0): https://github.com/instantpage/instant.page
 * - tocca (v2.0.9); https://github.com/GianlucaGuarini/Tocca.js/
 * - seamless-scroll-polyfill (v2.0.0): https://github.com/magic-akari/seamless-scroll-polyfill
 *
 * "flickity.js": v2.2.0 (with the "fade" package). Flickity is only loaded on demand if there is a product image
 * carousel on the page. Otherwise it is not loaded.
 *
 * "photoswipe": v4.1.3. PhotoSwipe is only loaded on demand to power the zoom feature on product page. If the zoom
 * feature is disabled, then this script is never loaded.
 */


document.addEventListener('scroll', () => {
  document.documentElement.classList.toggle(
    'whoop-show-join',
    window.scrollY >= window.innerHeight
  );
});



  const TARGET_COLLECTION = 'brisas'; // change this
  const REDIRECT_URL = '/pages/select-your-4-cores'; // change this

  let collectionHandles = new Set();

  // ---- Prefetch collection products
  fetch(`/collections/${TARGET_COLLECTION}/products.json?limit=250`)
    .then(res => res.json())
    .then(data => {
      if (data && data.products) {
        data.products.forEach(p => collectionHandles.add(p.handle));
      }
    })
    .catch(err => console.error('Collection fetch error:', err));

  function handleAddToCart(data) {
    if (!data || !data.handle) return;

    // Prevent redirect if already on cart page
    if (window.location.pathname === '/cart') return;

    if (collectionHandles.has(data.handle)) {
      setTimeout(() => {
        ///////////////////window.location.href = REDIRECT_URL;
      }, 400);
    }
  }

  // ---- FETCH intercept
  const originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);

      try {
        const url = args[0];

        if (
          typeof url === 'string' &&
          url.includes('/cart/add.js')
        ) {
          const data = await response.clone().json();

          if (data && data.handle) {
            handleAddToCart(data);
          }
        }
      } catch (e) {
        console.error('Fetch intercept error:', e);
      }

      return response;
    };
  }

  // ---- XHR fallback (for safety)
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url;
    return originalOpen.apply(this, arguments);
  };

  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      try {
        if (this._url && this._url.includes('/cart/add.js')) {
          const data = JSON.parse(this.responseText);

          if (data && data.handle) {
            handleAddToCart(data);
          }
        }
      } catch (e) {
        console.error('XHR intercept error:', e);
      }
    });

    return originalSend.apply(this, arguments);
  };

document.addEventListener('DOMContentLoaded', function () {
  const cartLink = document.querySelector('.header__icon-wrapper[href="/cart"]');

  if (cartLink) {
    cartLink.setAttribute('href', '#');
  }
});

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

document.addEventListener('click', (event) => {
  const playButton = event.target.closest('[data-brisa-video-src]');
  if (!playButton) return;

  const videoSrc = playButton.dataset.brisaVideoSrc;
  if (!videoSrc) return;
  const videoType = playButton.dataset.brisaVideoType || 'iframe';
  const videoAspect = playButton.dataset.brisaVideoAspect || 'landscape';

  let lightbox = document.querySelector('.brisa-video-lightbox');

  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.className = 'brisa-video-lightbox';
    lightbox.innerHTML = `
      <button class="brisa-video-lightbox__overlay" type="button" aria-label="Close video"></button>
      <div class="brisa-video-lightbox__content" role="dialog" aria-modal="true" aria-label="Video">
        <button class="brisa-video-lightbox__close" type="button" aria-label="Close video">&times;</button>
        <div class="brisa-video-lightbox__frame"></div>
      </div>
    `;
    document.body.appendChild(lightbox);
  }

  const content = lightbox.querySelector('.brisa-video-lightbox__content');
  const frame = lightbox.querySelector('.brisa-video-lightbox__frame');
  content.classList.toggle('brisa-video-lightbox__content--portrait', videoAspect === 'portrait');
  frame.innerHTML = '';

  if (videoType === 'html5') {
    const video = document.createElement('video');
    video.src = videoSrc;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    frame.appendChild(video);
  } else {
    const iframe = document.createElement('iframe');
    iframe.title = 'Brisa video';
    iframe.allow = 'autoplay; encrypted-media; fullscreen';
    iframe.allowFullscreen = true;
    iframe.src = videoSrc;
    frame.appendChild(iframe);
  }

  lightbox.classList.add('is-open');
  document.documentElement.style.overflow = 'hidden';
});

document.addEventListener('click', (event) => {
  const closeButton = event.target.closest('.brisa-video-lightbox__close, .brisa-video-lightbox__overlay');
  if (!closeButton) return;

  const lightbox = closeButton.closest('.brisa-video-lightbox');
  const content = lightbox.querySelector('.brisa-video-lightbox__content');
  const frame = lightbox.querySelector('.brisa-video-lightbox__frame');

  frame.innerHTML = '';
  content.classList.remove('brisa-video-lightbox__content--portrait');
  lightbox.classList.remove('is-open');
  document.documentElement.style.overflow = '';
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;

  const lightbox = document.querySelector('.brisa-video-lightbox.is-open');
  if (!lightbox) return;

  const content = lightbox.querySelector('.brisa-video-lightbox__content');
  const frame = lightbox.querySelector('.brisa-video-lightbox__frame');
  frame.innerHTML = '';
  content.classList.remove('brisa-video-lightbox__content--portrait');
  lightbox.classList.remove('is-open');
  document.documentElement.style.overflow = '';
});

function getSlideshowBrisaFromNav(navBar) {
  const section = navBar.closest('.shopify-section--slideshow-brisa, [id^="shopify-section-"]');
  return section?.querySelector('slide-show.slideshow-brisa') ?? null;
}

function slideMatchesKitSet(element, kitSet) {
  const slideKit = element?.dataset?.kitSet || 'both';
  return kitSet === 'all' || slideKit === 'both' || slideKit === kitSet;
}

function applySlideshowBrisaKit(section, kitSet) {
  if (!section || !kitSet) return;

  const slideshow = section.querySelector('slide-show.slideshow-brisa');
  const pageDots = section.querySelector('page-dots.slideshow-brisa__dots');
  const navBar = section.querySelector('.slideshow-brisa__nav-bar');
  if (!slideshow) return;

  section.dataset.activeKitSet = kitSet;

  const items = Array.from(slideshow.querySelectorAll('slide-show-item'));
  const thumbs = pageDots ? Array.from(pageDots.querySelectorAll('.slideshow-brisa__thumb')) : [];
  const visibleItems = items.filter((item) => slideMatchesKitSet(item, kitSet));
  const visibleThumbs = thumbs.filter((thumb) => slideMatchesKitSet(thumb, kitSet));

  items.forEach((item) => item.setAttribute('hidden', ''));
  thumbs.forEach((thumb) => {
    thumb.hidden = true;
    thumb.setAttribute('aria-selected', 'false');
    thumb.removeAttribute('aria-current');
  });

  visibleItems.forEach((item, index) => {
    if (index === 0) {
      item.removeAttribute('hidden');
    } else {
      item.setAttribute('hidden', '');
    }
  });

  visibleThumbs.forEach((thumb, index) => {
    thumb.hidden = false;
    thumb.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    if (index === 0) {
      thumb.setAttribute('aria-current', 'true');
    }
  });

  if (navBar) {
    navBar.hidden = visibleItems.length <= 1;
  }

  if (pageDots && pageDots.selectedIndex !== 0) {
    pageDots.selectedIndex = 0;
  }
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
  const syncDots = () => {
    const index = items.findIndex((item) => !item.hasAttribute('hidden'));
    if (index >= 0 && pageDots.selectedIndex !== index) {
      pageDots.selectedIndex = index;
    }
  };

  items.forEach((item) => {
    new MutationObserver(syncDots).observe(item, {
      attributes: true,
      attributeFilter: ['hidden'],
    });
  });
}

function initAllSlideshowBrisaSections(root = document) {
  root.querySelectorAll('.shopify-section--slideshow-brisa').forEach(initSlideshowBrisaSection);
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