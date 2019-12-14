import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { APP_CONFIG_TOKEN, AppConfig } from '../config/app.config-interface';
import { DataProvider } from './data';
import { ShiftResult } from '../models/shiftResult';
import { ShiftDayResult } from '../models/shiftDayResult';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ShiftsProvider {

  constructor(public http: HttpClient, @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig, private dataProvider: DataProvider) {
  }

  public getShifts(): Observable<ShiftResult[]> {
    return this.http.get<ShiftResult[]>(this.appConfig.ResgridApiUrl + '/Shifts/GetShifts')
      .pipe(map((items) => {
        let shifts: ShiftResult[] = new Array<ShiftResult>();

        items.forEach(item => {
          const shift = item as ShiftResult;

          shifts.push(shift);
        });

        return shifts;
      }));
  }

  public getShift(shiftId: any): Observable<ShiftResult> {
    const params = new HttpParams().append('id', shiftId);

    return this.http.get<ShiftResult>(this.appConfig.ResgridApiUrl + '/Shifts/GetShift', { params })
      .pipe(map((item) => {
        const shift: ShiftResult = item as ShiftResult;

        return shift;
      }));
  }

  public getShiftDay(shiftDayId: any): Observable<ShiftDayResult> {
    const params = new HttpParams().append('id', shiftDayId);

    return this.http.get<ShiftDayResult>(this.appConfig.ResgridApiUrl + '/Shifts/GetShiftDay', { params })
      .pipe(map((item) => {
        let shiftDay: ShiftDayResult = item as ShiftDayResult;

        if (shiftDay.Signups && shiftDay.Signups.length > 0) {
          shiftDay.Signups.forEach(signup => {
            const localUser = this.dataProvider.getPerson(signup.UserId);
            if (localUser) {
              signup.SignedUpName = localUser.Fnm + ' ' + localUser.Lnm;
            }
          });
        }

        if (shiftDay.Needs && shiftDay.Needs.length > 0) {
          shiftDay.Needs.forEach(need => {
            const localGroup = this.dataProvider.getGroup(need.GroupId);
            if (localGroup) {
              need.GroupName = localGroup.Nme;
            }

            if (need.GroupNeeds && need.GroupNeeds.length > 0) {
              need.GroupNeeds.forEach(role => {
                let localRole = this.dataProvider.getRole(role.RoleId);
                if (localRole) {
                  role.RoleName = localRole.Nme;
                }
              });
            }
          });
        }

        return shiftDay;
      }));
  }

  public getTodaysShifts(): Observable<ShiftDayResult[]> {
    return this.http.get<ShiftDayResult[]>(this.appConfig.ResgridApiUrl + '/Shifts/GetTodaysShifts')
    .pipe(map((items) => {
        let shiftDays: ShiftDayResult[] = new Array<ShiftDayResult>();

        items.forEach(item => {
          let shiftDay = item as ShiftDayResult;

          if (shiftDay.Signups && shiftDay.Signups.length > 0) {
            shiftDay.Signups.forEach(signup => {
              const localUser = this.dataProvider.getPerson(signup.UserId);
              if (localUser) {
                signup.SignedUpName = localUser.Fnm + " " + localUser.Lnm;
              }
            });
          }

          if (shiftDay.Needs && shiftDay.Needs.length > 0) {
            shiftDay.Needs.forEach(need => {
              let localGroup = this.dataProvider.getGroup(need.GroupId);
              if (localGroup) {
                need.GroupName = localGroup.Nme;
              }

              if (need.GroupNeeds && need.GroupNeeds.length > 0) {
                need.GroupNeeds.forEach(role => {
                  let localRole = this.dataProvider.getRole(role.RoleId);
                  if (localRole) {
                    role.RoleName = localRole.Nme;
                  }
                });
              }
            });
          }

          shiftDays.push(shiftDay);
        });

        return shiftDays;
      }));
  }

  public signupForShift(shiftDayId: number, groupId: number): Observable<object> {

    const data = {
      ShiftDayId: shiftDayId,
      GroupId: groupId,
    };

    return this.http.post(this.appConfig.ResgridApiUrl + '/Shifts/SignupForShiftDay', data);
  }
}
