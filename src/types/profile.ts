export interface CustomerProfile {
  id: number | string | null;
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  subscriptions_plan?: string | number | null;
  address?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  zip_code?: string;
  Owner_Full_Name?: string;
  OwnershipType?: string;
  MailingAddress?: string;
  OwnerOccupied?: string;
  LastSaleDate?: string;
  SalePrice?: string | number | null;
  AssessedValue?: string | number | null;
  YearBuilt?: string | number | null;
  LotSize?: string | number | null;
  StructureSize?: string | number | null;
  PropertyType?: string;
  vin_number?: string;
  license_plate?: string;
  car_make?: string;
  car_model?: string;
  car_mileage?: string;
  car_color?: string;
  date_of_loss?: string;
  car_photos?: string;
  driver_license_photo?: string;
  avatar?: string | null;
  avatar_url?: string | null;
  APN?: string;
  ZoningCode?: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProfileUpdatePayload {
  Name?: string;
  Password?: string;
  Email?: string;
  Phone?: string;
  SubscriptionsPlan?: string | number;
  Owner_Full_Name?: string;
  OwnershipType?: string;
  MailingAddress?: string;
  Address?: string;
  Latitude?: number | string | null;
  Longitude?: number | string | null;
  ZipCode?: string;
  OwnerOccupied?: string;
  LastSaleDate?: string;
  SalePrice?: string | number;
  AssessedValue?: string | number;
  YearBuilt?: string | number;
  LotSize?: string | number;
  StructureSize?: string | number;
  PropertyType?: string;
  Vin_Number?: string;
  License_Plate?: string;
  Car_Make?: string;
  Car_Model?: string;
  Car_Mileage?: string;
  Car_Color?: string;
  Date_Of_Loss?: string;
  Car_Photos?: string;
  Driver_License_Photo?: string;
}

export interface ProfileUpdateResponse {
  success?: boolean;
  message?: string;
  client?: CustomerProfile;
  errors?: Record<string, string[]>;
}
