import React, { useEffect, useRef, useState } from 'react';
import { registerDialogHost, DialogRequest, ToastRequest } from '../services/ui/dialogs';

export const DialogHost: React.FC = () => {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [toasts, setToasts] = useState<ToastRequest[]>([]);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const current = queue[0];

  useEffect(() => registerDialogHost(
    req => setQueue(q => [...q, req]),
    t => {
      setToasts(ts => [...ts, t]);
      setTimeout(() => setToasts(ts => ts.filter(x => x.id !== t.id)), 3500);
    },
  ), []);

  useEffect(() => {
    if (current?.kind === 'ask') {
      setValue(current.defaultValue);
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 30);
    }
  }, [current]);

  const close = (result: string | boolean | null) => {
    if (!current) return;
    (current.resolve as (v: any) => void)(result);
    setQueue(q => q.slice(1));
  };

  return (
    <>
      {current && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onMouseDown={e => { if (e.target === e.currentTarget) close(current.kind === 'ask' ? null : false); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 text-gray-900">
            <h3 className="text-lg font-bold mb-1">{current.title}</h3>
            {current.kind === 'ask' ? (
              <form onSubmit={e => { e.preventDefault(); close(value.trim() ? value.trim() : null); }}>
                {current.label && <label className="text-xs text-gray-500 block mb-1">{current.label}</label>}
                <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 mt-2" />
                <div className="flex justify-end gap-2 mt-5">
                  <button type="button" onClick={() => close(null)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 rounded-lg">{current.confirmLabel}</button>
                </div>
              </form>
            ) : (
              <>
                <p className="text-sm text-gray-600 mt-1">{current.message}</p>
                <div className="flex justify-end gap-2 mt-5">
                  <button onClick={() => close(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button onClick={() => close(true)} className={`px-4 py-2 text-sm font-bold text-white rounded-lg ${current.danger ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}>{current.confirmLabel}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[210] flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2 rounded-lg shadow-lg text-sm font-semibold text-white ${t.tone === 'success' ? 'bg-emerald-600' : t.tone === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}>{t.message}</div>
        ))}
      </div>
    </>
  );
};
