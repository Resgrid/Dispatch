import { Injectable, Inject } from '@angular/core';
import { APP_CONFIG_TOKEN, AppConfig } from '../config/app.config-interface';

import { Settings } from '../models/settings';

@Injectable()
export class SettingsProvider {
  private storage: any;
  public isAuthenticated: boolean = false;
  public settings: Settings;

  constructor( @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig) {
    this.settings = new Settings();

    // Ok, NativeStorage should support local storage fallback, but it doesn't presist, so have this fake for web fallback.
    if (window['cordova']) {
      //this.storage = nativeStorage;
    } else {
      this.storage = {
        setItem: (key, value) => {
          return new Promise((resolve, reject) => {
            try {
              window.localStorage.setItem(key, JSON.stringify(value));
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        },
        getItem: (key) => {
          return new Promise((resolve, reject) => {
            try {
              const result = window.localStorage.getItem(key);
              resolve(JSON.parse(result));
            } catch (error) {
              reject(error);
            }
          });
        },
        remove: (key) => {
          return new Promise((resolve, reject) => {
            try {
              window.localStorage.removeItem(key);
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        },
        clear: () => {
          return new Promise((resolve, reject) => {
            try {
              window.localStorage.clear();
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        },
      }
    }
  }

  public init(): Promise<boolean> {
    let that: any = this;

    return new Promise((resolve, reject) => {
      that.storage.getItem("settings").then(function result(savedSettings: Settings) {
        if (savedSettings) {
          if (savedSettings.AuthToken) {
            that.setAuthenticated(true);
          } else {
            that.setAuthenticated(false);
          }

          that.settings = savedSettings;
        } else {
          that.setAuthenticated(false);
        }

        resolve(true);
      }).catch(function (err) {
        that.settings = new Settings();
        that.setAuthenticated(false);
        resolve(true);
      });
    });
  }

  public areSettingsSet(): boolean {
    if (this.appConfig.IsDemo === true) {
      return true;
    } else {
      if (!this.settings.Username)
        return false;

      if (!this.settings.Password)
        return false;

      return true;
    }
  }

  public getUserId(): string {
    return this.settings.UserId;
  }

  public setUserId(userId: string): void {
    this.settings.UserId = userId;
    this.save();
  }

  public getUsername(): string {
    return this.settings.Username;
  }

  public setUsername(userName: string): void {
    this.settings.Username = userName;
    this.save();
  }

  public getPassword(): string {
    return this.settings.Password;
  }

  public setPassword(password: string): void {
    this.settings.Password = password;
    this.save();
  }

  public getDepartmentId(): number {
    return this.settings.DepartmentId;
  }

  public setDepartmentId(departmentId: number): void {
    this.settings.DepartmentId = departmentId;
    this.save();
  }

  public getAuthToken(): string {
    return this.settings.AuthToken;
  }

  public setAuthToken(authToken: string): void {
    this.settings.AuthToken = authToken;
    this.save();
  }

  public getAuthTokenExpiry(): string {
    return this.settings.AuthTokenExpiry;
  }

  public setAuthTokenExpiry(authTokenExpiry: string): void {
    this.settings.AuthTokenExpiry = authTokenExpiry;
    this.save();
  }

  public getFullName(): string {
    return this.settings.FullName;
  }

  public setFullName(name: string): void {
    this.settings.FullName = name;
    this.save();
  }

  public getEmail(): string {
    return this.settings.EmailAddress;
  }

  public setEmail(email: string): void {
    this.settings.EmailAddress = email;
    this.save();
  }

  public getEnableDetailedResponses(): boolean {
    return this.settings.EnableDetailedResponses;
  }

  public setEnableDetailedResponses(enableDetailedResponses: boolean): void {
    this.settings.EnableDetailedResponses = enableDetailedResponses;
    this.save();
  }

  public getEnableGeolocation(): boolean {
    return this.settings.EnableGeolocation;
  }

  public setEnableGeolocation(enableGeolocation: boolean): void {
    this.settings.EnableGeolocation = enableGeolocation;
    this.save();
  }

  public getEnablePushNotifications(): boolean {
    return this.settings.EnablePushNotifications;
  }

  public setEnablePushNotifications(enablePushNotifications: boolean): void {
    this.settings.EnablePushNotifications = enablePushNotifications;
    this.save();
  }

  public getPushDeviceUriId(): string {
    return this.settings.PushDeviceUriId;
  }

  public setPushDeviceUriId(pushDeviceUriId: string): void {
    this.settings.PushDeviceUriId = pushDeviceUriId;
    this.save();
  }

  public getPersonnelFilter(): string {
    return this.settings.PersonnelFilter;
  }

  public setPersonnelFilter(personnelFilter: string): void {
    this.settings.PersonnelFilter = personnelFilter;
    this.save();
  }

  public getUnitsFilter(): string {
    return this.settings.UnitsFilter;
  }

  public setUnitsFilter(unitsFilter: string): void {
    this.settings.UnitsFilter = unitsFilter;
    this.save();
  }

  public getDepartmentName(): string {
    return this.settings.DepartmentName;
  }

  public setDepartmentName(departmentName: string): void {
    this.settings.DepartmentName = departmentName;
    this.save();
  }

  public getDepartmentCreatedOn(): string {
    return this.settings.DepartmentCreatedOn;
  }

  public setDepartmentCreatedOn(departmentCreatedOn: string): void {
    this.settings.DepartmentCreatedOn = departmentCreatedOn;
    this.save();
  }

  public getSortRespondingTop(): boolean {
    return this.settings.SortRespondingTop;
  }

  public setSortRespondingTop(sortRespondingTop: boolean): void {
    this.settings.SortRespondingTop = sortRespondingTop;
    this.save();
  }

  public getEnableCustomSounds(): boolean {
    return this.settings.EnableCustomSounds;
  }

  public setEnableCustomSounds(enableCustomSounds: boolean): void {
    this.settings.EnableCustomSounds = enableCustomSounds;
    this.save();
  }

  public getCustomRespondingText(): string {
    return this.settings.CustomRespondingText;
  }

  public setCustomRespondingText(customRespondingText: string): void {
    this.settings.CustomRespondingText = customRespondingText;
    this.save();
  }

  public getLastSynced(): string {
    return this.settings.LastSynced;
  }

  public setLastSynced(): void {
    let date = new Date();
    this.settings.LastSynced = date.toISOString();
    this.save();
  }

  public getPushRegisteredOn(): string {
    return this.settings.PushRegisteredOn;
  }

  public setPushRegisteredOn(): void {
    let date = new Date();
    this.settings.PushRegisteredOn = date.toISOString();
    this.save();
  }

  public setAuthenticated(authenticated: boolean): void {
    this.isAuthenticated = authenticated;
  }

  public getLanguage(): string {
    return this.settings.Language;
  }

  public setLanguage(language: string): void {
    this.settings.Language = language;
    this.save();
  }

  public getEnableLiveUpdates(): boolean {
    return this.settings.EnableLiveUpdates;
  }

  public save(): Promise<Settings> {
    window.localStorage.setItem('userId', this.settings.UserId);
    window.localStorage.setItem('authToken', this.settings.AuthToken);

    if (this.settings.AuthToken) {
      this.setAuthenticated(true);
    }

    return this.storage.setItem('settings', this.settings);
  }
}
