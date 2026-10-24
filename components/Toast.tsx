"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ToastItem {
  id: number;
  message: string;
}

const ToastContext = createContext<{ toast: (message: string) => void }>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string) => {
    const id = nextId.current++;
    setItems((cur) => [...cur, { id, message }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-6 top-[76px] z-[80] flex flex-col gap-2"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex max-w-[min(600px,92vw)] items-center gap-3 rounded-[10px] bg-ink px-4 py-2.5 font-semibold text-bg shadow-pp"
          >
            <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
