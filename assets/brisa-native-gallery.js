(() => {
  const gallerySelector = '[data-brisa-native-gallery="true"]';

  const initGallery = (gallery) => {
    if (!gallery || gallery.dataset.brisaNativeGalleryInit === 'true') return;

    const slideshow = gallery.querySelector('slide-show.slideshow-brisa');
    const slideList = slideshow?.querySelector('.slideshow__slide-list');
    const pageDots = gallery.parentElement?.querySelector('page-dots.slideshow-brisa__dots');
    const items = slideshow ? Array.from(slideshow.querySelectorAll('slide-show-item')) : [];
    if (!slideshow || !slideList || items.length < 2) return;

    gallery.dataset.brisaNativeGalleryInit = 'true';

    const state = {
      index: Math.max(0, items.findIndex((item) => !item.hidden)),
      startIndex: 0,
      startX: 0,
      startY: 0,
      lastX: 0,
      startScrollLeft: 0,
      dragging: false,
      scrollTimer: 0,
    };

    const clampIndex = (index) => Math.max(0, Math.min(items.length - 1, Number(index) || 0));
    const itemScrollLeft = (index) => Math.max(
      0,
      items[index].offsetLeft - ((slideList.clientWidth - items[index].offsetWidth) / 2)
    );
    const nearestIndex = () => items.reduce((nearest, item, index) => {
      const distance = Math.abs(slideList.scrollLeft - itemScrollLeft(index));
      return distance < nearest.distance ? { index, distance } : nearest;
    }, { index: 0, distance: Infinity }).index;

    const setActive = (index) => {
      state.index = clampIndex(index);
      items.forEach((item, itemIndex) => item.toggleAttribute('hidden', itemIndex !== state.index));
      if (pageDots && pageDots.selectedIndex !== state.index) pageDots.selectedIndex = state.index;
    };

    const goTo = (index, animate = true) => {
      const targetIndex = clampIndex(index);
      setActive(targetIndex);
      slideList.scrollTo({
        left: itemScrollLeft(targetIndex),
        behavior: animate && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto',
      });
    };

    slideshow.select = (index, shouldTransition = true) => goTo(index, shouldTransition);
    slideshow.next = () => goTo(state.index + 1, true);
    slideshow.previous = () => goTo(state.index - 1, true);

    pageDots?.addEventListener('page-dots:changed', (event) => {
      event.stopPropagation();
      goTo(event.detail.index, true);
    });

    slideList.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      state.startX = touch.clientX;
      state.startY = touch.clientY;
      state.lastX = touch.clientX;
      state.startScrollLeft = slideList.scrollLeft;
      state.startIndex = nearestIndex();
      state.dragging = false;
    }, { passive: true });

    slideList.addEventListener('touchmove', (event) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;
      state.lastX = touch.clientX;

      if (!state.dragging && Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
        state.dragging = true;
        slideList.classList.add('is-dragging');
      }
      if (state.dragging) slideList.scrollLeft = state.startScrollLeft - deltaX;
    }, { passive: true });

    const finishDrag = () => {
      if (!state.dragging) return;
      const distance = state.startX - state.lastX;
      slideList.classList.remove('is-dragging');
      state.dragging = false;
      goTo(Math.abs(distance) >= 40 ? state.startIndex + (distance > 0 ? 1 : -1) : nearestIndex(), true);
    };

    slideList.addEventListener('touchend', finishDrag, { passive: true });
    slideList.addEventListener('touchcancel', finishDrag, { passive: true });

    slideList.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch' || event.button !== 0) return;
      state.startX = event.clientX;
      state.lastX = event.clientX;
      state.startScrollLeft = slideList.scrollLeft;
      state.startIndex = nearestIndex();
      state.dragging = false;
    });

    slideList.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch' || (event.buttons & 1) !== 1) return;
      const deltaX = event.clientX - state.startX;
      state.lastX = event.clientX;
      if (!state.dragging && Math.abs(deltaX) > 6) {
        state.dragging = true;
        slideList.classList.add('is-dragging');
        slideList.setPointerCapture(event.pointerId);
      }
      if (state.dragging) slideList.scrollLeft = state.startScrollLeft - deltaX;
    });

    const finishPointer = (event) => {
      if (event.pointerType === 'touch') return;
      if (slideList.hasPointerCapture(event.pointerId)) slideList.releasePointerCapture(event.pointerId);
      finishDrag();
    };

    slideList.addEventListener('pointerup', finishPointer);
    slideList.addEventListener('pointercancel', finishPointer);
    slideList.addEventListener('scroll', () => {
      if (state.dragging) return;
      clearTimeout(state.scrollTimer);
      state.scrollTimer = window.setTimeout(() => setActive(nearestIndex()), 120);
    }, { passive: true });

    slideshow.addEventListener('swipeleft', (event) => event.stopImmediatePropagation(), true);
    slideshow.addEventListener('swiperight', (event) => event.stopImmediatePropagation(), true);

    requestAnimationFrame(() => goTo(state.index, false));
  };

  const initAll = (root = document) => root.querySelectorAll(gallerySelector).forEach(initGallery);

  document.addEventListener('DOMContentLoaded', () => initAll());
  document.addEventListener('shopify:section:load', (event) => initAll(event.target));
})();
