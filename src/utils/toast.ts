export type ToastType = 'success' | 'error' | 'info' | 'warning';

export type ToastAction = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
};

export type ToastOptions = {
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
  actions?: ToastAction[];
};

export type ToastItem = ToastOptions & {
  id: string;
};

export function inferToastType(title: string, message: string): ToastType {
  const text = `${title} ${message}`.toLowerCase();

  if (
    /success|uploaded|submitted|updated successfully|profile updated|saved|copied|download started|sent|review your application/.test(
      text,
    )
  ) {
    return 'success';
  }

  if (
    /fail|error|unable|invalid|required|could not|must be|not loaded|not available|coming soon/.test(
      text,
    )
  ) {
    return 'error';
  }

  if (/validation|verify|check your|enter your|choose a|select a|please fill|please enter/.test(text)) {
    return 'warning';
  }

  return 'info';
}
