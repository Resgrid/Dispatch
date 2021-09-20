import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { StatusesInfo } from '../core/models/statusesInfo';
import { StaffingResult } from '../core/models/staffingResult';
import { StaffingScheduleResult } from '../core/models/staffingScheduleResult';
import { TypesProvider } from './types';
import { UtilsProvider } from './utils';
import { Consts } from '../consts';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StaffingProvider {
  private currentStatusesInfo: StatusesInfo;
  private currentSchedule: StaffingScheduleResult;

  constructor(public http: HttpClient, private typesProvider: TypesProvider, private utilsProvider: UtilsProvider,
    private consts: Consts) {

  }

  public getCurrentStaffing(): Observable<StaffingResult> {
    return this.http.get<StaffingResult>(environment.baseApiUrl + environment.resgridApiUrl + '/Staffing/GetCurrentStaffing')
      .pipe(map((item) => {
        return item as StaffingResult;
      }));
  }

  public setStaffing(type: number, geoLocation: string, note: string): Observable<object> {
    return this.http.post(environment.baseApiUrl + environment.resgridApiUrl + '/Staffing/SetStaffing', {
      Typ: type,
      Geo: geoLocation,
      Not: note
    });
  }

  public setStaffingForUser(userId: string, type: number, geoLocation: string, note: string): Observable<object> {
    return this.http.put(environment.baseApiUrl + environment.resgridApiUrl + '/Staffing/SetStaffingForUser', {
      Uid: userId,
      Typ: type,
      Geo: geoLocation,
      Not: note
    }).pipe(map((item) => {
      //this.pubsub.$pub(this.consts.EVENTS.STAFFING_UPDATED, event);
      return item as StaffingResult;
    }));
  }

  public setWorkingStaffing(statusInfo: StatusesInfo): void {
    this.currentStatusesInfo = statusInfo;
  }

  public getWorkingStaffing(): StatusesInfo {
    return this.currentStatusesInfo;
  }

  public getStaffingSchedules(): Observable<StaffingScheduleResult[]> {
    return this.http.get<StaffingScheduleResult[]>(environment.baseApiUrl + environment.resgridApiUrl + '/StaffingSchedules/GetStaffingSchedules')
      .pipe(map((items) => {
        let staffings: StaffingScheduleResult[] = new Array<StaffingScheduleResult>();

        items.forEach(item => {
          let schedule: StaffingScheduleResult = item as StaffingScheduleResult;

          schedule.StateText = this.typesProvider.staffingToTextConverter(Number(schedule.Data));
          schedule.StateColor = this.typesProvider.staffingToColorConverter(Number(schedule.Data));

          if (schedule.Typ === 'Weekly') {
            schedule.Timeframe = schedule.Dow;
          } else {
            schedule.Timeframe = this.utilsProvider.formatDateForDisplay(new Date(schedule.Spc), 'yyyy-MM-dd HH:mm');
          }

          staffings.push(schedule);
        });

        return staffings;
      }));
  }

  public toggleStaffingSchedule(id: number, active: boolean): Observable<object> {
    return this.http.put(environment.baseApiUrl + environment.resgridApiUrl + '/StaffingSchedules/ToggleStaffingSchedule', {
      Id: id,
      Act: active
    });
  }

  public deleteStaffingSchedule(id: number): Observable<object> {
    const params = new HttpParams().append('staffingSecheduleId', id.toString());

    return this.http.delete(environment.resgridApiUrl + '/StaffingSchedules/DeleteStaffingSchedule', { params });
  }

  public createStaffingSchedule(type: string, date: string, time: string, state: number, sunday: boolean,
                                monday: boolean, tuesday: boolean, wednesday: boolean, thursday: boolean,
                                friday: boolean, satruday: boolean, note: string): Observable<object> {

    let intType: number;
    if (type === 'Date') {
      intType = 1;
    } else {
      intType = 2;
    }

    return this.http.post(environment.resgridApiUrl + '/StaffingSchedules/CreateStaffingSchedule', {
      Typ: intType,
      Spd: date,
      Spt: time,
      Ste: state,
      Sun: sunday,
      Mon: monday,
      Tue: tuesday,
      Wed: wednesday,
      Thu: thursday,
      Fri: friday,
      Sat: satruday,
      Not: note
    });
  }

  public setWorkingStaffingSchedule(schedule: StaffingScheduleResult) {
    this.currentSchedule = schedule;
  }

  public getWorkingStaffingSchedule() {
    return this.currentSchedule;
  }
}
