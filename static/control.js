function triggerForward() {
  const form = document.getElementById('forward-form');
  if (form) {
    form.requestSubmit();
  }
}

document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && !event.repeat) {
    event.preventDefault();
    triggerForward();
  }
});