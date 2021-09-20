import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { StatusesInfo } from '../core/models/statusesInfo';
import { SettingsProvider } from './settings';
import { DataProvider } from './data';
import { TypesProvider } from './types';
import { UtilsProvider } from './utils';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SetUnitStatePayload } from '../features/home/models/setUnitStatePayload';

@Injectable({
  providedIn: 'root'
})
export class UnitStatusProvider {
  private currentStatusesInfo: StatusesInfo;
  private currentDestination: any;

  constructor(public http: HttpClient, private settingsProvider: SettingsProvider, private dataProvider: DataProvider, private typesProvider: TypesProvider,
    private utilsProvider: UtilsProvider) {

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

    return this.http.post(environment.baseApiUrl + environment.resgridApiUrl + '/UnitState/SetUnitState', result);
  }
}
