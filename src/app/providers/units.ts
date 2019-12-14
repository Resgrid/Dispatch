import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { APP_CONFIG_TOKEN, AppConfig } from '../config/app.config-interface';

import { UnitStatusResult } from '../models/unitStatusResult';
import { SettingsProvider } from './settings';
import { DataProvider } from './data';
import { TypesProvider } from './types';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class UnitsProvider {
  constructor(public http: HttpClient, private settingsProvider: SettingsProvider,
    private dataProvider: DataProvider, private typesProvider: TypesProvider, @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig) {

  }

  public getUnitStatuses(): Observable<UnitStatusResult[]> {
    let url = '';
    let filter = this.settingsProvider.settings.UnitsFilter;

    if (filter) {
      url = this.appConfig.ResgridApiUrl + '/Units/GetUnitStatuses?activeFilter=' + encodeURIComponent(filter);
    } else {
      url = this.appConfig.ResgridApiUrl + '/Units/GetUnitStatuses';
    }

    return this.http.get<UnitStatusResult[]>(url).pipe(map((items) => {
      let statuses: UnitStatusResult[] = new Array<UnitStatusResult>();

      items.forEach(item => {
        const status = new UnitStatusResult();
        status.Uid = item.Uid;
        status.Did = item.Did;
        status.Typ = item.Typ;
        status.Tmp = item.Tmp;

        const localUnit = this.dataProvider.getUnit(status.Uid);
        if (localUnit) {
          status.Name = localUnit.Nme;
          status.Type = localUnit.Typ;
        }

        status.StateText = this.typesProvider.unitStatusToTextConverter(item.Typ);
        status.StateColor = this.typesProvider.unitStatusToColorConverter(item.Typ);

        statuses.push(status);
      });

      return statuses;
    }));
  }
}
