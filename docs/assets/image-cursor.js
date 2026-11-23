(() => {
  'use strict';

  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;

  const samples = new WeakMap();

  function pixelsFor(image) {
    const src = image.currentSrc;
    if (!image.complete || !image.naturalWidth || !src || new URL(src).origin !== location.origin) return null;
    const previous = samples.get(image);
    if (previous?.src === src) return previous.pixels;

    let pixels = null;
    try {
      context.clearRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      pixels = context.getImageData(0, 0, size, size).data;
    } catch {
      // Restore the canvas if the browser restricted access to this image.
      canvas.width = size;
    }
    samples.set(image, { src, pixels });
    return pixels;
  }

  function positionOffset(position, freeSpace) {
    const value = parseFloat(position) || 0;
    return position.endsWith('%') ? value / 100 * freeSpace : value;
  }

  function imageTone(image, clientX, clientY) {
    const pixels = pixelsFor(image);
    if (!pixels) return '';

    const box = image.getBoundingClientRect();
    const { objectFit, objectPosition } = getComputedStyle(image);
    let { width, height } = box;
    if (objectFit === 'cover' || objectFit === 'contain') {
      const fit = objectFit === 'cover' ? Math.max : Math.min;
      const scale = fit(width / image.naturalWidth, height / image.naturalHeight);
      width = image.naturalWidth * scale;
      height = image.naturalHeight * scale;
    }
    const [horizontal, vertical] = objectPosition.split(' ');
    const x = (clientX - box.left - positionOffset(horizontal, box.width - width)) / width;
    const y = (clientY - box.top - positionOffset(vertical, box.height - height)) / height;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= 1 || y >= 1) return '';

    const i = 4 * (Math.floor(y * size) * size + Math.floor(x * size));
    if (pixels[i + 3] < 128) return '';
    const brightness = .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2];
    return brightness < 128 ? 'dark' : 'light';
  }

  function update(event) {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || event.pointerType === 'touch') return;
    const tone = imageTone(image, event.clientX, event.clientY);
    if (tone) {
      if (image.dataset.imageTone !== tone) image.dataset.imageTone = tone;
    } else {
      delete image.dataset.imageTone;
    }
  }

  document.addEventListener('pointerover', update, { passive: true });
  document.addEventListener('pointermove', update, { passive: true });
})();
