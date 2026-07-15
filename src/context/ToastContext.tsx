import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ToastView } from '../components/ToastView';
import type { ToastOptions } from '../utils/toast';
import { inferToastType } from '../utils/toast';

type ToastContextValue = {
  show: (options: ToastOptions) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastController: ToastContextValue | null = null;

function nextToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Array<ToastOptions & { id: string }>>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    const type = options.type ?? inferToastType(options.title ?? '', options.message);
    setItems((prev) => {
      const next = [...prev, { ...options, type, id: nextToastId() }];
      return next.slice(-3);
    });
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message, title) => show({ message, title, type: 'success' }),
      error: (message, title) => show({ message, title, type: 'error' }),
      info: (message, title) => show({ message, title, type: 'info' }),
      warning: (message, title) => show({ message, title, type: 'warning' }),
    }),
    [show],
  );

  useEffect(() => {
    toastController = value;
    return () => {
      toastController = null;
    };
  }, [value]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
        {items.map((item) => (
          <ToastView key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

/** Imperative API for use outside React components. */
export const toast: ToastContextValue = {
  show: (options) => toastController?.show(options),
  success: (message, title) => toastController?.success(message, title),
  error: (message, title) => toastController?.error(message, title),
  info: (message, title) => toastController?.info(message, title),
  warning: (message, title) => toastController?.warning(message, title),
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
});
