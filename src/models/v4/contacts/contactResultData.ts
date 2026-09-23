import { type ContactCategoryResultData } from './contactCategoryResultData';

export enum ContactType {
  Person = 0,
  Company = 1,
}

export interface ContactResultData {
  Mobile: any;
  Address: any;
  City: any;
  State: any;
  Zip: any;
  Notes: any;
  ImageUrl: any;
  Name: string | undefined;
  IsImportant: any;
  Phone: any;
  ContactId: string;
  ContactType: ContactType;
  OtherName?: string;
  ContactCategoryId?: string;
  Category?: ContactCategoryResultData;
  FirstName?: string;
  MiddleName?: string;
  LastName?: string;
  CompanyName?: string;
  Email?: string;
  PhysicalAddressId?: number;
  MailingAddressId?: number;
  Website?: string;
  Twitter?: string;
  Facebook?: string;
  LinkedIn?: string;
  Instagram?: string;
  Threads?: string;
  Bluesky?: string;
  Mastodon?: string;
  LocationGpsCoordinates?: string;
  EntranceGpsCoordinates?: string;
  ExitGpsCoordinates?: string;
  LocationGeofence?: string;
  CountryIssuedIdNumber?: string;
  CountryIdName?: string;
  StateIdNumber?: string;
  StateIdName?: string;
  StateIdCountryName?: string;
  Description?: string;
  OtherInfo?: string;
  HomePhoneNumber?: string;
  CellPhoneNumber?: string;
  FaxPhoneNumber?: string;
  OfficePhoneNumber?: string;
  Image?: Uint8Array;
  IsDeleted: boolean;
  AddedOnUtc: Date;
  AddedOn?: string;
  AddedByUserId?: string;
  AddedByUserName?: string;
  EditedOnUtc?: Date;
  EditedOn?: string;
  EditedByUserId?: string;
  EditedByUserName?: string;
  /**
   * Catalog field ids the server withheld from THIS contact (ADP plan 7.2). Per row, not a union
   * across the list: a field withheld on one contact must not mark it on every other one.
   */
  RedactedFields?: string[];
  IsProtected?: boolean;
  ProtectedReason?: string | null;
  /** The contact category's name and color (both list rows and the detail read). */
  CategoryName?: string | null;
  CategoryColor?: string | null;
  /** Resolved addresses (GetContactById only). */
  PhysicalAddress?: ContactAddressData | null;
  MailingAddress?: ContactAddressData | null;
  /** Mobile-visible custom field values with their labels, in form order (GetContactById only). */
  CustomFields?: ContactCustomFieldData[];
}

export interface ContactAddressData {
  Address1?: string | null;
  City?: string | null;
  State?: string | null;
  PostalCode?: string | null;
  Country?: string | null;
  /** One-line form for display and for a maps app. */
  Formatted?: string | null;
}

export interface ContactCustomFieldData {
  UdfFieldId: string;
  Label: string;
  Value: string;
  FieldDataType: number;
  GroupName?: string | null;
  SortOrder: number;
}
