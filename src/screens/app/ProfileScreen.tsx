import { toastAlert } from '../../utils/toastAlert';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { portalService } from '../../services/api/portalService';
import { PortalProfileHeaderButton } from '../../components/PortalProfileHeaderButton';
import { colors } from '../../theme/colors';
import { portalScreenLayout } from '../../theme/portalScreenLayout';
import type { AppDrawerParamList } from '../../navigation/types';
import {
  emptyProfileForm,
  fileLabelFromUrl,
  formToUpdatePayload,
  profileToForm,
  subscriptionPlanLabel,
  type ProfileFormState,
} from '../../utils/profileMapping';
import { NotificationBellPressable } from '../../components/NotificationBellPressable';

const SUBSCRIPTION_HINT = 'Plan ID: 1 = Basic, 2 = Premium, 3 = Enterprise';

export function ProfileScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<AppDrawerParamList>>();
  const [form, setForm] = useState<ProfileFormState>(emptyProfileForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCarPhoto, setUploadingCarPhoto] = useState(false);
  const [driverLicenseUri, setDriverLicenseUri] = useState<string | null>(null);
  const [driverLicenseName, setDriverLicenseName] = useState('');
  const [driverLicenseType, setDriverLicenseType] = useState<string | null>(null);

  const patchForm = useCallback((patch: Partial<ProfileFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const profile = await portalService.getProfile();
      setForm(profileToForm(profile));
      setDriverLicenseUri(null);
      setDriverLicenseName('');
      setDriverLicenseType(null);
    } catch (error) {
      toastAlert('Profile', error instanceof Error ? error.message : 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile().catch(() => setLoading(false));
  }, [loadProfile]);

  const pickImageFile = useCallback(async (): Promise<{
    uri: string;
    name: string;
    type: string | null;
  } | null> => {
    const [file] = await pick({
      type: [types.images],
      allowMultiSelection: false,
      ...(Platform.OS === 'android' ? { allowVirtualFiles: true } : {}),
    });
    if (!file || file.error) {
      if (file?.error) {
        toastAlert('Profile', file.error);
      }
      return null;
    }

    let uri = file.uri;
    const baseName = file.name || 'image.jpg';

    if (Platform.OS === 'ios') {
      const [copy] = await keepLocalCopy({
        files: [{ uri: file.uri, fileName: baseName }],
        destination: 'cachesDirectory',
      });
      if (copy.status === 'success') {
        uri = copy.localUri;
      }
    }

    if (!uri) {
      toastAlert('Profile', 'Could not read the selected file.');
      return null;
    }

    return { uri, name: baseName, type: file.type ?? 'image/jpeg' };
  }, []);

  const onChooseCarPhoto = useCallback(async () => {
    if (!form.clientId) {
      toastAlert('Profile', 'Save your profile first or reload to get a client ID.');
      return;
    }
    try {
      const picked = await pickImageFile();
      if (!picked) {
        return;
      }
      setUploadingCarPhoto(true);
      const result = await portalService.uploadProfileCarPhoto({
        clientId: form.clientId,
        uri: picked.uri,
        name: picked.name,
        type: picked.type,
      });
      patchForm({
        carPhotosPath: result.picturePath,
        carPhotosUrl: result.pictureUrl,
      });
      toastAlert('Profile', 'Car photo uploaded.');
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      toastAlert('Profile', e instanceof Error ? e.message : 'Could not upload car photo.');
    } finally {
      setUploadingCarPhoto(false);
    }
  }, [form.clientId, patchForm, pickImageFile]);

  const onChooseDriverLicense = useCallback(async () => {
    try {
      const picked = await pickImageFile();
      if (!picked) {
        return;
      }
      setDriverLicenseUri(picked.uri);
      setDriverLicenseName(picked.name);
      setDriverLicenseType(picked.type);
      patchForm({ driverLicenseUrl: picked.uri });
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      toastAlert('Profile', e instanceof Error ? e.message : 'Could not pick driver license photo.');
    }
  }, [patchForm, pickImageFile]);

  const onSaveProfile = useCallback(async () => {
    if (!form.clientId) {
      toastAlert('Profile', 'Profile is not loaded yet. Pull down to refresh and try again.');
      return;
    }
    if (!form.fullName.trim()) {
      toastAlert('Profile', 'Full name is required.');
      return;
    }
    if (!form.email.trim()) {
      toastAlert('Profile', 'Email is required.');
      return;
    }

    try {
      setSaving(true);
      const payload = formToUpdatePayload(form);
      const result = await portalService.updateProfile(payload, {
        driverLicense: driverLicenseUri
          ? { uri: driverLicenseUri, name: driverLicenseName, type: driverLicenseType }
          : undefined,
      });

      if (result.client) {
        setForm(profileToForm(result.client));
        setDriverLicenseUri(null);
        setDriverLicenseName('');
        setDriverLicenseType(null);
      } else {
        await loadProfile();
      }

      patchForm({ newPassword: '' });
      toastAlert('Profile', result.message || 'Profile updated successfully.');
    } catch (error) {
      toastAlert('Profile', error instanceof Error ? error.message : 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }, [driverLicenseName, driverLicenseType, driverLicenseUri, form, loadProfile, patchForm]);

  const carPhotoLabel = form.carPhotosUrl
    ? fileLabelFromUrl(form.carPhotosUrl, 'Car photo on file')
    : 'No file chosen';

  const driverLicenseLabel = driverLicenseUri
    ? driverLicenseName || 'New photo selected'
    : form.driverLicenseUrl
      ? fileLabelFromUrl(form.driverLicenseUrl, 'License on file')
      : 'No file chosen';

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={portalScreenLayout.chrome}>
        <View style={portalScreenLayout.profileRow}>
          <View style={styles.headerLeading}>
            <Pressable
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              style={({ pressed }) => [styles.iconTile, pressed && styles.dim]}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
            >
              <View style={styles.menuGlyph}>
                <View style={styles.menuLine} />
                <View style={styles.menuLine} />
                <View style={styles.menuLine} />
              </View>
            </Pressable>
            <PortalProfileHeaderButton displayName={form.fullName.split(' ')[0] || undefined} />
          </View>
          <NotificationBellPressable style={({ pressed }) => [styles.iconTile, pressed && styles.dim]} />
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Profile Management</Text>
          <Text style={styles.heroSub}>Manage personal, property, and vehicle details in one place.</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <FormField label="Full Name" value={form.fullName} onChangeText={(v) => patchForm({ fullName: v })} />
          <FormField
            label="New Password"
            value={form.newPassword}
            onChangeText={(v) => patchForm({ newPassword: v })}
            placeholder="Please leave this field blank if you haven't changed it"
            secureTextEntry
            helperText="Please leave this field blank if you haven't changed it"
          />
          <FormField label="Email Address" value={form.email} onChangeText={(v) => patchForm({ email: v })} />
          <FormField label="Phone Number" value={form.phoneNumber} onChangeText={(v) => patchForm({ phoneNumber: v })} />
          <FormField
            label="Subscription Plan"
            value={form.subscriptionPlan}
            onChangeText={(v) => patchForm({ subscriptionPlan: v })}
            placeholder="1, 2, or 3"
            helperText={SUBSCRIPTION_HINT}
          />
          {form.subscriptionPlan ? (
            <Text style={styles.planHint}>Current: {subscriptionPlanLabel(form.subscriptionPlan)}</Text>
          ) : null}
          <FormField
            label="Property Address"
            value={form.propertyAddress}
            onChangeText={(v) => patchForm({ propertyAddress: v })}
            placeholder="Enter your property address"
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Property Information</Text>
          <FormField label="Owner Full Name" value={form.ownerFullName} onChangeText={(v) => patchForm({ ownerFullName: v })} />
          <FormField label="Ownership Type" value={form.ownershipType} onChangeText={(v) => patchForm({ ownershipType: v })} />
          <FormField label="Mailing Address" value={form.mailingAddress} onChangeText={(v) => patchForm({ mailingAddress: v })} />
          <FormField label="Owner Occupied" value={form.ownerOccupied} onChangeText={(v) => patchForm({ ownerOccupied: v })} />
          <FormField
            label="Last Sale Date"
            value={form.lastSaleDate}
            onChangeText={(v) => patchForm({ lastSaleDate: v })}
            placeholder="mm/dd/yyyy"
          />
          <FormField label="Sale Price" value={form.salePrice} onChangeText={(v) => patchForm({ salePrice: v })} placeholder="Enter sale price" />
          <FormField
            label="Assessed Value"
            value={form.assessedValue}
            onChangeText={(v) => patchForm({ assessedValue: v })}
            placeholder="Enter assessed value"
          />
          <FormField label="Year Built" value={form.yearBuilt} onChangeText={(v) => patchForm({ yearBuilt: v })} placeholder="Enter year built" />
          <FormField label="Lot Size (sq ft)" value={form.lotSize} onChangeText={(v) => patchForm({ lotSize: v })} placeholder="Enter lot size" />
          <FormField
            label="Structure Size (sq ft)"
            value={form.structureSize}
            onChangeText={(v) => patchForm({ structureSize: v })}
            placeholder="Enter structure size"
          />
          <FormField label="Property Type" value={form.propertyType} onChangeText={(v) => patchForm({ propertyType: v })} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Vehicle & Loss Information</Text>
          <FormField label="VIN Number" value={form.vinNumber} onChangeText={(v) => patchForm({ vinNumber: v })} placeholder="Enter VIN number" />
          <FormField
            label="License Plate"
            value={form.licensePlate}
            onChangeText={(v) => patchForm({ licensePlate: v })}
            placeholder="Enter license plate"
          />
          <FormField label="Car Make" value={form.carMake} onChangeText={(v) => patchForm({ carMake: v })} placeholder="e.g. Toyota, Ford" />
          <FormField label="Car Model" value={form.carModel} onChangeText={(v) => patchForm({ carModel: v })} placeholder="Enter model" />
          <FormField label="Car Mileage" value={form.carMileage} onChangeText={(v) => patchForm({ carMileage: v })} placeholder="Miles" />
          <FormField label="Car Color" value={form.carColor} onChangeText={(v) => patchForm({ carColor: v })} placeholder="e.g. Black, White" />
          <FormField
            label="Date of Loss"
            value={form.dateOfLoss}
            onChangeText={(v) => patchForm({ dateOfLoss: v })}
            placeholder="mm/dd/yyyy"
          />

          <Text style={styles.fieldLabel}>Driver License Photo</Text>
          {form.driverLicenseUrl && !driverLicenseUri ? (
            <Image source={{ uri: form.driverLicenseUrl }} style={styles.previewImage} resizeMode="cover" />
          ) : null}
          {driverLicenseUri ? <Image source={{ uri: driverLicenseUri }} style={styles.previewImage} resizeMode="cover" /> : null}
          <View style={styles.fileRow}>
            <Pressable style={({ pressed }) => [styles.fileButton, pressed && styles.dim]} onPress={onChooseDriverLicense}>
              <Text style={styles.fileButtonText}>Choose File</Text>
            </Pressable>
            <Text style={styles.fileText} numberOfLines={2}>
              {driverLicenseLabel}
            </Text>
          </View>

          <Text style={styles.fieldLabel}>Car Photos</Text>
          {form.carPhotosUrl ? <Image source={{ uri: form.carPhotosUrl }} style={styles.previewImage} resizeMode="cover" /> : null}
          <View style={styles.fileRow}>
            <Pressable
              style={({ pressed }) => [styles.fileButton, pressed && styles.dim, uploadingCarPhoto && styles.dim]}
              onPress={onChooseCarPhoto}
              disabled={uploadingCarPhoto}
            >
              <Text style={styles.fileButtonText}>{uploadingCarPhoto ? 'Uploading…' : 'Choose File'}</Text>
            </Pressable>
            <Text style={styles.fileText} numberOfLines={2}>
              {carPhotoLabel}
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveBtn, (pressed || saving) && styles.dim]}
          onPress={onSaveProfile}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveBtnText}>Save Profile</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dashboardCanvas },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dashboardCanvas },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
  },
  avatarWrap: { width: 36, height: 36, borderRadius: 14, backgroundColor: colors.avatarSoftFill, alignItems: 'center', justifyContent: 'center' },
  avatarGlyph: { color: colors.primaryDark, fontSize: 14, fontWeight: '600' },
  profileName: { fontSize: 16, fontWeight: '600', color: '#4A5568', marginLeft: 10 },
  chevron: { fontSize: 11, color: colors.primary, marginLeft: 6 },
  headerLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    minWidth: 0,
    marginRight: 10,
  },
  iconTile: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  menuGlyph: { width: 18, gap: 4 },
  menuLine: { width: 18, height: 2, borderRadius: 2, backgroundColor: colors.textPrimary },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },
  heroCard: { backgroundColor: colors.primary, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 12 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  heroSub: { color: '#DFE9FF', fontSize: 13, lineHeight: 18, marginTop: 6, marginRight: 100 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3EAF6',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  sectionTitle: { color: '#1D2D44', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  fieldLabel: { color: '#344054', fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  fieldInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7E0EE',
    backgroundColor: '#F9FBFF',
    color: '#24334E',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  helperText: { marginTop: 5, color: '#6B7280', fontSize: 11, lineHeight: 15 },
  planHint: { marginTop: 4, marginBottom: 4, color: colors.primary, fontSize: 12, fontWeight: '600' },
  previewImage: {
    width: '100%',
    maxWidth: 220,
    height: 140,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#EEF4FF',
  },
  fileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  fileButton: { borderRadius: 10, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#C9DAF5', paddingHorizontal: 10, paddingVertical: 7 },
  fileButtonText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  fileText: { marginLeft: 8, color: '#6B7280', fontSize: 12, flex: 1 },
  saveBtn: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dim: { opacity: 0.88 },
});

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  helperText,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  secureTextEntry?: boolean;
}): React.JSX.Element {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8A93A7"
        secureTextEntry={secureTextEntry}
        style={styles.fieldInput}
      />
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}
