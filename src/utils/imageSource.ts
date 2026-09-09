import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { launchCamera, launchImageLibrary, type Asset, type ImagePickerResponse } from 'react-native-image-picker';

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
 * On Android 12 and below, reading the gallery needs READ_EXTERNAL_STORAGE.
 * Android 13+ system photo picker typically does not require a runtime grant.
 */
async function ensureLibraryPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const apiLevel =
    typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);

  if (Number.isFinite(apiLevel) && apiLevel >= 33) {
    return true;
  }

  const permission = PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
  const alreadyGranted = await PermissionsAndroid.check(permission);
  if (alreadyGranted) {
    return true;
  }

  const result = await PermissionsAndroid.request(permission, {
    title: 'Photo library access',
    message: 'HarborShield 360 needs access to your photos so you can attach existing pictures.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function assetToCapturedImage(asset: Asset | undefined, fallbackLabel: string): CapturedImage {
  if (!asset?.uri) {
    throw new Error(`Could not read the ${fallbackLabel}.`);
  }

  let uri = asset.uri;
  if (Platform.OS === 'android' && uri.startsWith('/') && !uri.startsWith('file://') && !uri.startsWith('content://')) {
    uri = `file://${uri}`;
  }

  let type = (asset.type ?? 'image/jpeg').toLowerCase();
  if (type === 'image/jpg') {
    type = 'image/jpeg';
  }

  let name = asset.fileName || `photo-${Date.now()}.jpg`;
  if (!/\.(jpe?g|png|gif|webp)$/i.test(name)) {
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('gif') ? 'gif' : 'jpg';
    name = `${name.replace(/\.[^.]+$/, '')}.${ext}`;
  }

  if (/\.(heic|heif)$/i.test(name)) {
    name = `${name.replace(/\.[^.]+$/, '')}.jpg`;
    type = 'image/jpeg';
  }

  return { uri, name, type };
}

function throwIfPickerError(result: ImagePickerResponse, unavailableMessage: string): void {
  if (!result.errorCode) {
    return;
  }
  if (result.errorCode === 'permission') {
    throw new Error('Permission is required to continue. You can enable it in Settings.');
  }
  if (result.errorCode === 'camera_unavailable') {
    throw new Error(unavailableMessage);
  }
  throw new Error(result.errorMessage || 'Unable to open the photo picker.');
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
    maxWidth: 1600,
    maxHeight: 1600,
    saveToPhotos: false,
    cameraType: 'back',
  });

  if (result.didCancel) {
    return null;
  }
  throwIfPickerError(result, 'The camera is not available on this device.');
  return assetToCapturedImage(result.assets?.[0], 'captured photo');
}

/**
 * Opens the device photo library and returns the selected photo, or null when cancelled.
 */
export async function pickImageFromLibrary(): Promise<CapturedImage | null> {
  const permitted = await ensureLibraryPermission();
  if (!permitted) {
    throw new Error(
      'Photo library permission is required to choose an existing photo. You can enable it in Settings.',
    );
  }

  const result = await launchImageLibrary({
    mediaType: 'photo',
    quality: 0.8,
    maxWidth: 1600,
    maxHeight: 1600,
    selectionLimit: 1,
  });

  if (result.didCancel) {
    return null;
  }
  throwIfPickerError(result, 'The photo library is not available on this device.');
  return assetToCapturedImage(result.assets?.[0], 'selected photo');
}
