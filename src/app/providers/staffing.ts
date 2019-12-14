import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { APP_CONFIG_TOKEN, AppConfig } from '../config/app.config-interface';
import { StatusesInfo } from '../models/statusesInfo';
import { StaffingResult } from '../models/staffingResult';
import { StaffingScheduleResult } from '../models/staffingScheduleResult';
import { TypesProvider } from './types';
import { UtilsProvider } from './utils';
import { Consts } from '../consts';
import { PubSubService } from '../components/pubsub/angular2-pubsub.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class StaffingProvider {
  private currentStatusesInfo: StatusesInfo;
  private currentSchedule: StaffingScheduleResult;

  constructor(public http: HttpClient, private typesProvider: TypesProvider, private utilsProvider: UtilsProvider,
    @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig, private pubsub: PubSubService, private consts: Consts) {

  }

  public getCurrentStaffing(): Observable<StaffingResult> {
    return this.http.get<StaffingResult>(this.appConfig.ResgridApiUrl + '/Staffing/GetCurrentStaffing')
      .pipe(map((item) => {
        return item as StaffingResult;
      }));
  }

  public setStaffing(type: number, geoLocation: string, note: string): Observable<object> {
    return this.http.post(this.appConfig.ResgridApiUrl + '/Staffing/SetStaffing', {
      Typ: type,
      Geo: geoLocation,
      Not: note
    });
  }

  public setStaffingForUser(userId: string, type: number, geoLocation: string, note: string): Observable<object> {
    return this.http.put(this.appConfig.ResgridApiUrl + '/Staffing/SetStaffingForUser', {
      Uid: userId,
      Typ: type,
      Geo: geoLocation,
      Not: note
    }).pipe(map((item) => {
      this.pubsub.$pub(this.consts.EVENTS.STAFFING_UPDATED, event);
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
    return this.http.get<StaffingScheduleResult[]>(this.appConfig.ResgridApiUrl + '/StaffingSchedules/GetStaffingSchedules')
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
    return this.http.put(this.appConfig.ResgridApiUrl + '/StaffingSchedules/ToggleStaffingSchedule', {
      Id: id,
      Act: active
    });
  }

  public deleteStaffingSchedule(id: number): Observable<object> {
    const params = new HttpParams().append('staffingSecheduleId', id.toString());

    return this.http.delete(this.appConfig.ResgridApiUrl + '/StaffingSchedules/DeleteStaffingSchedule', { params });
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

    return this.http.post(this.appConfig.ResgridApiUrl + '/StaffingSchedules/CreateStaffingSchedule', {
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
