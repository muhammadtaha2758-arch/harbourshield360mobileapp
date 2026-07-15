import { env } from '../config/env';
import type { CustomerProfile, ProfileUpdatePayload } from '../types/profile';

export const SUBSCRIPTION_PLAN_LABELS: Record<string, string> = {
  '1': 'Basic Plan',
  '2': 'Premium Plan',
  '3': 'Enterprise Plan',
};

export type ProfileFormState = {
  clientId: string;
  fullName: string;
  newPassword: string;
  email: string;
  phoneNumber: string;
  subscriptionPlan: string;
  propertyAddress: string;
  zipCode: string;
  ownerFullName: string;
  ownershipType: string;
  mailingAddress: string;
  ownerOccupied: string;
  lastSaleDate: string;
  salePrice: string;
  assessedValue: string;
  yearBuilt: string;
  lotSize: string;
  structureSize: string;
  propertyType: string;
  vinNumber: string;
  licensePlate: string;
  carMake: string;
  carModel: string;
  carMileage: string;
  carColor: string;
  dateOfLoss: string;
  carPhotosPath: string;
  carPhotosUrl: string;
  driverLicensePath: string;
  driverLicenseUrl: string;
};

export function emptyProfileForm(): ProfileFormState {
  return {
    clientId: '',
    fullName: '',
    newPassword: '',
    email: '',
    phoneNumber: '',
    subscriptionPlan: '',
    propertyAddress: '',
    zipCode: '',
    ownerFullName: '',
    ownershipType: '',
    mailingAddress: '',
    ownerOccupied: '',
    lastSaleDate: '',
    salePrice: '',
    assessedValue: '',
    yearBuilt: '',
    lotSize: '',
    structureSize: '',
    propertyType: '',
    vinNumber: '',
    licensePlate: '',
    carMake: '',
    carModel: '',
    carMileage: '',
    carColor: '',
    dateOfLoss: '',
    carPhotosPath: '',
    carPhotosUrl: '',
    driverLicensePath: '',
    driverLicenseUrl: '',
  };
}

export function str(value: unknown): string {
  if (value == null) {
    return '';
  }
  return String(value);
}

export function resolveProfileMediaUrl(pathOrUrl?: string | null): string {
  if (!pathOrUrl) {
    return '';
  }
  const raw = String(pathOrUrl).trim();
  if (!raw) {
    return '';
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const base = env.stormBuddiApiOrigin.replace(/\/+$/, '');
  if (raw.startsWith('client_pictures/')) {
    return `${base}/${raw}`;
  }
  if (raw.startsWith('storage/')) {
    return `${env.apiOrigin}/${raw}`;
  }
  return `${base}/${raw.replace(/^\//, '')}`;
}

export function extractStoragePathFromUrl(url?: string): string {
  if (!url) {
    return '';
  }
  const raw = String(url).trim();
  if (!raw) {
    return '';
  }
  if (!/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const stormBase = env.stormBuddiApiOrigin.replace(/\/+$/, '');
  if (raw.startsWith(stormBase)) {
    return raw.slice(stormBase.length).replace(/^\//, '');
  }
  return raw;
}

export function profileToForm(profile: CustomerProfile): ProfileFormState {
  const carUrl = resolveProfileMediaUrl(profile.car_photos);
  const licenseUrl = resolveProfileMediaUrl(profile.driver_license_photo);

  return {
    clientId: profile.id != null ? String(profile.id) : '',
    fullName: str(profile.name),
    newPassword: '',
    email: str(profile.email),
    phoneNumber: str(profile.phone),
    subscriptionPlan: str(profile.subscriptions_plan),
    propertyAddress: str(profile.address),
    zipCode: str(profile.zip_code),
    ownerFullName: str(profile.Owner_Full_Name),
    ownershipType: str(profile.OwnershipType),
    mailingAddress: str(profile.MailingAddress),
    ownerOccupied: str(profile.OwnerOccupied),
    lastSaleDate: str(profile.LastSaleDate),
    salePrice: str(profile.SalePrice),
    assessedValue: str(profile.AssessedValue),
    yearBuilt: str(profile.YearBuilt),
    lotSize: str(profile.LotSize),
    structureSize: str(profile.StructureSize),
    propertyType: str(profile.PropertyType),
    vinNumber: str(profile.vin_number),
    licensePlate: str(profile.license_plate),
    carMake: str(profile.car_make),
    carModel: str(profile.car_model),
    carMileage: str(profile.car_mileage),
    carColor: str(profile.car_color),
    dateOfLoss: str(profile.date_of_loss),
    carPhotosPath: extractStoragePathFromUrl(carUrl) || extractStoragePathFromUrl(profile.car_photos),
    carPhotosUrl: carUrl,
    driverLicensePath: extractStoragePathFromUrl(licenseUrl) || extractStoragePathFromUrl(profile.driver_license_photo),
    driverLicenseUrl: licenseUrl,
  };
}

export function formToUpdatePayload(form: ProfileFormState): ProfileUpdatePayload {
  const payload: ProfileUpdatePayload = {
    Name: form.fullName.trim(),
    Email: form.email.trim(),
    Phone: form.phoneNumber.trim(),
    SubscriptionsPlan: form.subscriptionPlan.trim(),
    Owner_Full_Name: form.ownerFullName.trim(),
    OwnershipType: form.ownershipType.trim(),
    MailingAddress: form.mailingAddress.trim(),
    Address: form.propertyAddress.trim(),
    ZipCode: form.zipCode.trim(),
    OwnerOccupied: form.ownerOccupied.trim(),
    LastSaleDate: form.lastSaleDate.trim(),
    SalePrice: form.salePrice.trim(),
    AssessedValue: form.assessedValue.trim(),
    YearBuilt: form.yearBuilt.trim(),
    LotSize: form.lotSize.trim(),
    StructureSize: form.structureSize.trim(),
    PropertyType: form.propertyType.trim(),
    Vin_Number: form.vinNumber.trim(),
    License_Plate: form.licensePlate.trim(),
    Car_Make: form.carMake.trim(),
    Car_Model: form.carModel.trim(),
    Car_Mileage: form.carMileage.trim(),
    Car_Color: form.carColor.trim(),
    Date_Of_Loss: form.dateOfLoss.trim(),
    Car_Photos: form.carPhotosPath.trim(),
    Driver_License_Photo: form.driverLicensePath.trim(),
  };

  if (form.newPassword.trim()) {
    payload.Password = form.newPassword.trim();
  }

  return payload;
}

export function subscriptionPlanLabel(planId: string): string {
  return SUBSCRIPTION_PLAN_LABELS[planId] || planId || '—';
}

export function fileLabelFromUrl(url: string, fallback: string): string {
  if (!url) {
    return fallback;
  }
  try {
    const parts = url.split('?')[0].split('/');
    const name = parts[parts.length - 1];
    return name || fallback;
  } catch {
    return fallback;
  }
}
