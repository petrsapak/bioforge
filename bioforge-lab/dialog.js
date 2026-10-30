'use strict';
// The game's own question box in place of the browser's confirm() and prompt(): a title, a line of text, a name
// field when it asks for a name, Cancel and the action button (red with a trash can for something that deletes);
// Enter confirms and Esc cancels (browser only).

// Opens the box. question: { title, text, confirmLabel, isDangerous }. onConfirm runs on the action button or Enter;
// Cancel, Esc or a click beside the box do nothing.
function askToConfirm(question, onConfirm) {
  byId('dialog-input').style.display = 'none';
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

// Opens the box with a name field holding name, all of it selected. question: { title, text, confirmLabel }.
// onName(name) runs on the action button or Enter, with the name as typed; Cancel or Esc do nothing.
function askForName(question, name, onName) {
  const input = byId('dialog-input');
  askToConfirm(question, () => onName(input.value));
  input.value = name;
  input.style.display = '';
  input.focus?.();
  input.select?.();
}

// hides the game's dialog box and forgets its confirm action
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

// wires the dialog box's buttons and its name field's Enter and Esc
function setUpDialog() {
  byId('dialog-cancel').onclick = closeDialog;
  // the window's key handler leaves typing in a field alone, so the name field takes Enter and Esc itself
  byId('dialog-input').addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (key !== 'enter' && key !== 'escape') return;
    event.preventDefault();
    handleDialogKey(key);
  });
  byId('dialog-sheet').addEventListener('mousedown', event => {
    if (event.target === byId('dialog-sheet')) closeDialog();
  });
}
