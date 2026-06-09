const statusValue = document.getElementById('status-value');
const backButton = document.getElementById('back-button');
const forwardButton = document.getElementById('forward-button');
const resetButton = document.getElementById('reset-button');

function setBusy(isBusy) {
  if (backButton) {
    backButton.disabled = isBusy;
  }
  if (forwardButton) {
    forwardButton.disabled = isBusy;
  }
  if (resetButton) {
    resetButton.disabled = isBusy;
  }
}

function updateStatus(status) {
  if (statusValue && Number.isInteger(status)) {
    statusValue.textContent = String(status);
  }
}

async function sendControlAction(path) {
  setBusy(true);
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    updateStatus(data.status);
  } catch (_error) {
    // Ignore transient network/server errors; next action can retry.
  } finally {
    setBusy(false);
  }
}

function triggerForward() {
  sendControlAction('/control/next');
}

document.addEventListener('keydown', (event) => {
  if (event.key && event.key.toLowerCase() === 'b' && !event.repeat) {
    event.preventDefault();
    triggerForward();
  }
});

if (backButton) {
  backButton.addEventListener('click', () => {
    sendControlAction('/control/prev');
  });
}

if (forwardButton) {
  forwardButton.addEventListener('click', () => {
    triggerForward();
  });
}

if (resetButton) {
  resetButton.addEventListener('click', () => {
    sendControlAction('/control/reset');
  });
}