function triggerForward() {
  const form = document.getElementById('forward-form');
  if (form) {
    form.requestSubmit();
  }
}

document.addEventListener('keydown', (event) => {
  if (event.key && event.key.toLowerCase() === 'b' && !event.repeat) {
    event.preventDefault();
    triggerForward();
  }
});