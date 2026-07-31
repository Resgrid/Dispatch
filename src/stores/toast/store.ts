import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'muted';

interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  /** Tap handler - e.g. navigate to a detail screen. */
  onPress?: () => void;
  /** Auto-dismiss delay in ms (default 3000). */
  duration?: number;
}

interface ToastOptions {
  onPress?: () => void;
  duration?: number;
}

interface ToastStore {
  toasts: ToastMessage[];
  showToast: (type: ToastType, message: string, title?: string, options?: ToastOptions) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  showToast: (type, message, title, options) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, title, onPress: options?.onPress, duration: options?.duration }],
    }));
    // Auto remove toast after the requested duration (default 3 seconds)
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id),
      }));
    }, options?.duration ?? 3000);
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
}));
