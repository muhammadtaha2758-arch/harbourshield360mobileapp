import { Alert, type AlertButton } from 'react-native';
import { toast } from '../context/ToastContext';
import { inferToastType, type ToastAction } from './toast';

function mapAlertButtons(buttons: AlertButton[]): ToastAction[] {
  return buttons
    .filter((button) => button.text && button.style !== 'cancel')
    .map((button) => ({
      label: button.text ?? 'OK',
      onPress: button.onPress,
      variant: button.style === 'destructive' ? 'secondary' : 'primary',
    }));
}

/**
 * Drop-in replacement for simple `Alert.alert(title, message)` calls.
 * Interactive alerts with custom button actions use toast actions when possible.
 */
export function toastAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  const trimmedMessage = message?.trim();
  const hasButtons = Boolean(buttons && buttons.length > 0);

  if (hasButtons) {
    const actions = mapAlertButtons(buttons ?? []);
    const cancelOnly =
      buttons?.every((button) => !button.onPress || button.style === 'cancel') ?? false;

    if (actions.length > 0 && !cancelOnly) {
      toast.show({
        title: trimmedMessage ? title : undefined,
        message: trimmedMessage || title,
        type: inferToastType(title, trimmedMessage ?? title),
        actions,
      });
      return;
    }

    // Android document action sheets and similar multi-choice menus stay native.
    const needsNativeSheet =
      buttons!.length >= 3 ||
      buttons!.some((button) => button.text === 'Download' || button.text === 'Share');

    if (needsNativeSheet) {
      Alert.alert(title, message, buttons);
      return;
    }
  }

  toast.show({
    title: trimmedMessage ? title : undefined,
    message: trimmedMessage || title,
    type: inferToastType(title, trimmedMessage ?? title),
  });
}
