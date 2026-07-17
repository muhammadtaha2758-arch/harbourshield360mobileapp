import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { launchCamera } from 'react-native-image-picker';

export type CapturedImage = {
  uri: string;
  name: string;
  type: string | null;
};

/**
 * Asks the user whether to take a new photo or choose an existing one.
 * Resolves null when dismissed.
 */
export function promptImageSource(): Promise<'camera' | 'library' | null> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: 'camera' | 'library' | null): void => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    Alert.alert(
      'Add photo',
      undefined,
      [
        { text: 'Take Photo', onPress: () => settle('camera') },
        { text: 'Choose from Library', onPress: () => settle('library') },
        { text: 'Cancel', style: 'cancel', onPress: () => settle(null) },
      ],
      { cancelable: true, onDismiss: () => settle(null) },
    );
  });
}

async function ensureCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    // iOS permission is requested by the system camera UI (NSCameraUsageDescription).
    return true;
  }
  const alreadyGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
  if (alreadyGranted) {
    return true;
  }
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
    title: 'Camera access',
    message: 'HarborShield 360 needs camera access so you can take photos in the app.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Opens the device camera and returns the captured photo, or null when cancelled.
 * Throws with a user-friendly message when the camera is unavailable or denied.
 */
export async function captureImageWithCamera(): Promise<CapturedImage | null> {
  const permitted = await ensureCameraPermission();
  if (!permitted) {
    throw new Error('Camera permission is required to take a photo. You can enable it in Settings.');
  }

  const result = await launchCamera({
    mediaType: 'photo',
    quality: 0.8,
    saveToPhotos: false,
    cameraType: 'back',
  });

  if (result.didCancel) {
    return null;
  }
  if (result.errorCode) {
    throw new Error(
      result.errorCode === 'camera_unavailable'
        ? 'The camera is not available on this device.'
        : result.errorMessage || 'Unable to open the camera.',
    );
  }

  const asset = result.assets?.[0];
  if (!asset?.uri) {
    throw new Error('Could not read the captured photo.');
  }

  return {
    uri: asset.uri,
    name: asset.fileName || `photo-${Date.now()}.jpg`,
    type: asset.type ?? 'image/jpeg',
  };
}
