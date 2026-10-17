/**
 * Small in-app replacements for prompt() and alert(). prompt() does not exist in the desktop app,
 * and alert() freezes the window, so everything goes through <DialogHost />.
 */
export interface AskRequest {
  kind: 'ask';
  title: string;
  label?: string;
  defaultValue: string;
  confirmLabel: string;
  resolve: (v: string | null) => void;
}
export interface ConfirmRequest {
  kind: 'confirm';
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (v: boolean) => void;
}
export interface ToastRequest {
  kind: 'toast';
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}
export type DialogRequest = AskRequest | ConfirmRequest;

type DialogListener = (req: DialogRequest) => void;
type ToastListener = (t: ToastRequest) => void;

let dialogListener: DialogListener | null = null;
let toastListener: ToastListener | null = null;
let toastId = 0;

export const registerDialogHost = (d: DialogListener, t: ToastListener) => {
  dialogListener = d;
  toastListener = t;
  return () => { dialogListener = null; toastListener = null; };
};

export const askText = (title: string, defaultValue = '', opts: { label?: string; confirmLabel?: string } = {}): Promise<string | null> =>
  new Promise(resolve => {
    if (!dialogListener) { resolve(window.prompt ? window.prompt(title, defaultValue) : defaultValue); return; }
    dialogListener({ kind: 'ask', title, label: opts.label, defaultValue, confirmLabel: opts.confirmLabel || 'Save', resolve });
  });

export const askConfirm = (title: string, message: string, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> =>
  new Promise(resolve => {
    if (!dialogListener) { resolve(window.confirm(`${title}\n\n${message}`)); return; }
    dialogListener({ kind: 'confirm', title, message, confirmLabel: opts.confirmLabel || 'OK', danger: !!opts.danger, resolve });
  });

export const toast = (message: string, tone: ToastRequest['tone'] = 'info') => {
  if (toastListener) toastListener({ kind: 'toast', id: ++toastId, message, tone });
};
