import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { UnitStatusResult } from '../core/models/unitStatusResult';
import { SettingsProvider } from './settings';
import { DataProvider } from './data';
import { TypesProvider } from './types';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UnitStatusFullResult } from '../core/models/unitStatusFullResult';
import { GetSetUnitStatusResult } from '../core/models/GetSetUnitStatusResult';
import { GroupsForCallResult } from '../core/models/groupsForCallResult';
import { RolesForCallResult } from '../core/models/rolesForCallResult';
import { PersonnelForCallResult } from '../core/models/personnelForCallResult';
import { CallTypeResult } from '../core/models/callTypeResult';
import { CallTemplateResult } from '../core/models/callTemplate';
import { FormDataResult } from '../core/models/formDataResult';

@Injectable({
  providedIn: 'root'
})
export class DispatchProvider {
  constructor(public http: HttpClient) {

  }

  public getSetUnitStatusesModalPayload(unitId: number): Observable<GetSetUnitStatusResult> {
    const params = new HttpParams().append('unitId', unitId.toString());
    return this.http.get<GetSetUnitStatusResult>(environment.baseApiUrl + environment.resgridApiUrl + '/Dispatch/GetSetUnitStatusData', { params });
  }

  public getPersonnelForCallGridPayload(): Observable<PersonnelForCallResult[]> {
    return this.http.get<PersonnelForCallResult[]>(environment.baseApiUrl + environment.resgridApiUrl + '/Dispatch/GetPersonnelForCallGrid');
  }

  public getGroupsForCallGridPayload(): Observable<GroupsForCallResult[]> {
    return this.http.get<GroupsForCallResult[]>(environment.baseApiUrl + environment.resgridApiUrl + '/Dispatch/GetGroupsForCallGrid');
  }

  public getRolesForCallGridPayload(): Observable<RolesForCallResult[]> {
    return this.http.get<RolesForCallResult[]>(environment.baseApiUrl + environment.resgridApiUrl + '/Dispatch/GetRolesForCallGrid');
  }

  public getcallTemplatesPayload(): Observable<CallTemplateResult[]> {
    return this.http.get<CallTemplateResult[]>(environment.baseApiUrl + environment.resgridApiUrl + '/Dispatch/GetCallTemplates');
  }

  public getcallForm(): Observable<FormDataResult> {
    return this.http.get<FormDataResult>(environment.baseApiUrl + environment.resgridApiUrl + '/Dispatch/GetNewCallForm');
  }
}
