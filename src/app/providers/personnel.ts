import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { PersonnelStatusResult } from '../core/models/personnelStatusResult';
import { SettingsProvider } from './settings';
import { DataProvider } from './data';
import { TypesProvider } from './types';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PersonnelProvider {

  constructor(public http: HttpClient, private settingsProvider: SettingsProvider,
    private dataProvider: DataProvider, private typesProvider: TypesProvider) {

  }

  public getPersonnelStatuses(): Observable<PersonnelStatusResult[]> {
    let url = '';
    const filter = this.settingsProvider.settings.PersonnelFilter;

    if (filter) {
      url = environment.baseApiUrl + environment.resgridApiUrl + '/Personnel/GetPersonnelStatuses?activeFilter=' + encodeURIComponent(filter);
    } else {
      url = environment.baseApiUrl + environment.resgridApiUrl + '/Personnel/GetPersonnelStatuses';
    }

    return this.http.get<PersonnelStatusResult[]>(url).pipe(map((items) => {
      const statuses: PersonnelStatusResult[] = new Array<PersonnelStatusResult>();

      items.forEach(item => {
        const status = new PersonnelStatusResult();
        status.Uid = item.Uid;
        status.Atp = item.Atp;
        status.Atm = item.Atm;
        status.Did = item.Did;
        status.Ste = item.Ste;
        status.Stm = item.Stm;

        const localPerson = this.dataProvider.getPerson(status.Uid);
        if (localPerson) {
          status.Name = localPerson.Fnm + ' ' + localPerson.Lnm;

          if (localPerson.Roles) {
            localPerson.Roles.forEach(element => {
              status.Roles = status.Roles + ' ' + element;
            });
          } else {
            status.Roles = '';
          }
        }

        status.ActionText = this.typesProvider.statusToTextConverter(item.Atp);
        status.ActionColor = this.typesProvider.statusToColorConverter(item.Atp);
        status.StateText = this.typesProvider.staffingToTextConverter(item.Ste);
        status.StateColor = this.typesProvider.staffingToColorConverter(item.Ste);

        statuses.push(status);
      });

      return statuses;
    }));
  }
}
