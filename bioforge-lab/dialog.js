'use strict';
// The game's own question box in place of the browser's confirm(): a title, a line of text, Cancel and the action
// button (red with a trash can for something that deletes); Enter confirms and Esc cancels (browser only).

// Opens the box. question: { title, text, confirmLabel, isDangerous }. onConfirm runs on the action button or Enter;
// Cancel, Esc or a click beside the box do nothing.
function askToConfirm(question, onConfirm) {
  byId('dialog-title').textContent = question.title;
  byId('dialog-text').textContent = question.text;
  byId('dialog-box').classList.toggle('dangerous', !!question.isDangerous);
  const confirmButton = byId('dialog-confirm');
  confirmButton.textContent = question.confirmLabel;
  confirmButton.onclick = () => {
    closeDialog();
    onConfirm();
  };
  byId('dialog-sheet').style.display = 'flex';
  confirmButton.focus?.();
}

function closeDialog() {
  byId('dialog-sheet').style.display = 'none';
  byId('dialog-confirm').onclick = null;
}

const isDialogOpen = () => byId('dialog-sheet').style.display === 'flex';

// while the box is open it takes every key: Enter confirms, Esc cancels
function handleDialogKey(key) {
  if (key === 'enter') byId('dialog-confirm').onclick();
  else if (key === 'escape') closeDialog();
}

function setUpDialog() {
  byId('dialog-cancel').onclick = closeDialog;
  byId('dialog-sheet').addEventListener('mousedown', event => {
    if (event.target === byId('dialog-sheet')) closeDialog();
  });
}
