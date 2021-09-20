import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { CalendarItem } from '../core/models/calendarItem';
import { DataProvider } from './data';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CalendarProvider {

  constructor(public http: HttpClient,
              private dataProvider: DataProvider) {

      }

      public getAllCalendarItems(): Observable<CalendarItem[]> {
        return this.http.get<CalendarItem[]>(environment.baseApiUrl + environment.resgridApiUrl + '/Calendar/GetDepartmentCalendarItems');
      }

      public getAllCalendarItemsInRange(start: string, end: string): Observable<CalendarItem[]> {
        const url = environment.baseApiUrl + environment.resgridApiUrl + '/Calendar/GetAllDepartmentCalendarItemsInRange';
        const params = new HttpParams().append('startDate', start).append('endDate', end);

        return this.http.get<CalendarItem[]>(url, { params });
      }

      public getCalendarItem(calendarItemId: any): Observable<CalendarItem> {
        const url = environment.baseApiUrl + environment.resgridApiUrl + '/Calendar/GetCalendarItem';
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
        const url = environment.baseApiUrl + environment.resgridApiUrl + '/Calendar/SetCalendarAttendingStatus';

        return this.http.post(url, {
          CalId: calendarItemId,
          Note: note,
          Type: type
        });
      }
}
