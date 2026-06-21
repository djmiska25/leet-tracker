import { createContext, useCallback, useContext, useState, PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

interface Toast {
  id: string;
  message: string;
  type?: 'success' | 'warning' | 'error';
}

type AddToast = (_msg: string, _type?: 'success' | 'warning' | 'error') => void;

const ToastContext = createContext<AddToast>(() => {});

export function useToast(): AddToast {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: PropsWithChildren<{}>) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast: AddToast = useCallback((message, type = 'success') => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      {createPortal(
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={clsx(
                'rounded-md border px-4 py-2 text-sm shadow',
                'border-border text-foreground',
                t.type === 'error' && 'bg-red-500 text-white',
                t.type === 'warning' && 'bg-amber-400 text-amber-950',
                t.type === 'success' && 'bg-card',
              )}
            >
              {t.message}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
