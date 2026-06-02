async function refreshDisplay() {
  try {
    const response = await fetch('/api/state', { cache: 'no-store' });
    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const image = document.getElementById('display-image');
    if (!image) {
      return;
    }

    const nextSource = `/static/images/${data.image}`;
    if (!image.dataset.currentSource) {
      image.dataset.currentSource = image.getAttribute('src') || '';
    }

    if (image.dataset.currentSource !== nextSource) {
      image.dataset.currentSource = nextSource;
      image.src = nextSource;
    }
  } catch (_error) {
    // Keep the display stable if the control server is briefly unavailable.
  }
}

refreshDisplay();
setInterval(refreshDisplay, 500);