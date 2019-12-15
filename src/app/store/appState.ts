export interface AppState {
    UserId: string;
    Username: string;
    Password: string;
    EmailAddress: string;
    FullName: string;
    DepartmentId: number;
    AuthToken: string;
    AuthTokenExpiry: string;
    EnableDetailedResponses: boolean;
    EnablePushNotifications: boolean;
    PushDeviceUriId: string;
    PersonnelFilter: string;
    UnitsFilter: string;
    DepartmentName: string;
    DepartmentCreatedOn: string;
    SortRespondingTop: boolean;
    EnableCustomSounds: boolean;
    CustomRespondingText: string;
    EnableGeolocation: boolean;
    Language: string;
    EnableSounds: boolean;
    EnableLiveUpdates: boolean;
    LastSynced: string;
    PushRegisteredOn: string;
    CustomUrl: string;
    CustomUrlValidated: boolean;
  }
