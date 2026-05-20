const toggleButton = document.getElementById('toggleButton');
const statusText = document.getElementById('statusText');

function render(enabled) {
  statusText.textContent = enabled ? 'Status: ON' : 'Status: OFF';
  toggleButton.textContent = enabled ? 'Turn OFF' : 'Turn ON';
  toggleButton.classList.toggle('is-off', !enabled);
}

chrome.storage.local.get({ cor3TranslatorEnabled: true }, (result) => {
  render(result.cor3TranslatorEnabled !== false);
});

toggleButton.addEventListener('click', () => {
  chrome.storage.local.get({ cor3TranslatorEnabled: true }, (result) => {
    const current = result.cor3TranslatorEnabled !== false;
    const next = !current;
    chrome.storage.local.set({ cor3TranslatorEnabled: next }, () => render(next));
  });
});
