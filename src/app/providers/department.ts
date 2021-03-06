import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { APP_CONFIG_TOKEN, AppConfig } from '../config/app.config-interface';
import { DataProvider } from './data';
import { RespondingOption } from '../models/respondingOption';
import { DepartmentStatusResult } from '../models/departmentStatusResult';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DepartmentProvider {

  constructor(public http: HttpClient, @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig, private dataProvider: DataProvider) {

  }

  public getRespondingOptions(): Observable<RespondingOption[]> {
    // create observable
    const getOptionsObservable = new Observable<RespondingOption[]>((observer) => {
      this.http.get<RespondingOption[]>(this.appConfig.ResgridApiUrl + '/Department/GetRespondingOptions')
        .pipe(map((items) => {
          let options: RespondingOption[] = new Array<RespondingOption>();
          // let options = <RespondingOption[]>items;

          if (items && items.length > 0) {
            for (var i = 0; i < items.length; i++) {
              var option = items[i] as RespondingOption;

              if (option.Typ === 1) {
                option['Type'] = 'Station';

                var localGroup = this.dataProvider.getGroup(option.Id);
                if (localGroup && localGroup.Nme) {
                  option['Nme'] = localGroup.Nme;
                } else {
                  option['Nme'] = ' ';
                }
              } else {
                option['Type'] = 'Call';
              }
              options.push(option);
            }
          }

          return options;
        })).subscribe(
          (data: RespondingOption[]) => {
            observer.next(data);
            observer.complete();
          },
          error => {
            observer.next(new Array<RespondingOption>());
            observer.complete();
          }
        );
    });

    return getOptionsObservable;
  }

  public getDepartmentStatus(): Observable<DepartmentStatusResult> {
    return this.http.get<DepartmentStatusResult>(this.appConfig.ResgridApiUrl + '/DepartmentStatus/GetDepartmentStatus')
      .pipe(map((item) => {
        return item as DepartmentStatusResult;
      }));
  }
}
