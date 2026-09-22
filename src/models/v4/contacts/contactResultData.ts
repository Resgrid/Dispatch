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
}
