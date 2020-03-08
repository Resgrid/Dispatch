import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { APP_CONFIG_TOKEN, AppConfig } from '../config/app.config-interface';

import { StatusesInfo } from '../models/statusesInfo';
import { SettingsProvider } from './settings';
import { DataProvider } from './data';
import { TypesProvider } from './types';
import { UtilsProvider } from './utils';
import { Observable } from 'rxjs';

@Injectable()
export class UnitStatusProvider {
  private currentStatusesInfo: StatusesInfo;
  private currentDestination: any;

  constructor(public http: HttpClient, private settingsProvider: SettingsProvider, private dataProvider: DataProvider, private typesProvider: TypesProvider,
    @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig, private utilsProvider: UtilsProvider) {

  }

  public setWorkingStatus(statusInfo: StatusesInfo): void {
    this.currentStatusesInfo = statusInfo;
  }

  public getWorkingStatus(): StatusesInfo {
    return this.currentStatusesInfo;
  }

  public setWorkingDestination(id: number, type: number): void {
    this.currentDestination = {
      Id: id,
      Type: type
    };
  }

  public getWorkingDestination(): any {
    return this.currentDestination;
  }

  public sendUnitStatus(state): Observable<object> {
    let result = {
      Eid: state.Id,
      Uid: state.UnitId,
      Typ: parseInt(state.StateType),
      Rto: state.RespondingTo,
      Tms: state.UtcTimestamp,
      Lts: state.LocalTimestamp,
      Lat: state.Latitude,
      Lon: state.Longitude,
      Acc: state.Accuracy,
      Alc: state.AltitudeAccuracy,
      Spd: state.Speed,
      Hdn: state.Heading,
      Roles: state.Roles,
      Not: state.Note
    };

    if (!result.Rto) {
      result.Rto = 0;
    }

    return this.http.post(this.appConfig.ResgridApiUrl + '/UnitState/SetUnitState', result);
  }
}
