import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { APP_CONFIG_TOKEN, AppConfig } from '../config/app.config-interface';
import { CalendarItem } from '../models/calendarItem';
import { DataProvider } from './data';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CalendarProvider {

  constructor(public http: HttpClient,
              @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig,
              private dataProvider: DataProvider) {

      }

      public getAllCalendarItems(): Observable<CalendarItem[]> {
        return this.http.get<CalendarItem[]>(this.appConfig.ResgridApiUrl + '/Calendar/GetDepartmentCalendarItems');
      }

      public getAllCalendarItemsInRange(start: string, end: string): Observable<CalendarItem[]> {
        const url = this.appConfig.ResgridApiUrl + '/Calendar/GetAllDepartmentCalendarItemsInRange';
        const params = new HttpParams().append('startDate', start).append('endDate', end);

        return this.http.get<CalendarItem[]>(url, { params });
      }

      public getCalendarItem(calendarItemId: any): Observable<CalendarItem> {
        const url = this.appConfig.ResgridApiUrl + '/Calendar/GetCalendarItem';
        const params = new HttpParams().append('id', calendarItemId);

        return this.http.get<CalendarItem>(url, { params }).pipe(map((item) => {
          const calendarItem = item as CalendarItem;

          if (calendarItem && calendarItem.Attendees) {
            calendarItem.Attendees.forEach(item2 => {
              const localPerson = this.dataProvider.getPerson(item2.UserId);
              if (localPerson) {
                item2.FullName = localPerson.Fnm + ' ' + localPerson.Lnm;
              }
            });
          }

          return item as CalendarItem;
        }));
      }

      public setAttendingStatus(calendarItemId: number, note: string, type: string) {
        const url = this.appConfig.ResgridApiUrl + '/Calendar/SetCalendarAttendingStatus';

        return this.http.post(url, {
          CalId: calendarItemId,
          Note: note,
          Type: type
        });
      }
}
