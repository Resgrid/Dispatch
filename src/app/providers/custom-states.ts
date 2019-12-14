import { Injectable } from '@angular/core';
import 'rxjs/add/operator/map';

import { Consts } from '../consts';
import { DataProvider } from './data';
import { StatusesInfo } from '../models/statusesInfo';

@Injectable({
  providedIn: 'root'
})
export class CustomStatesProvider {

  constructor(private consts: Consts,
    private dataProvider: DataProvider) { }

  public getPersonnelStatuses(): Promise<StatusesInfo[]> {
    return this.getCustomStatuses(this.consts.CUSTOMTYPES.PERSONNEL, false);
  }

  public getActivePersonnelStatuses(): Promise<StatusesInfo[]> {
    return this.getCustomStatuses(this.consts.CUSTOMTYPES.PERSONNEL, true);
  }

  public getPersonnelStaffing(): Promise<StatusesInfo[]> {
    return this.getCustomStatuses(this.consts.CUSTOMTYPES.STAFFING, false);
  }

  public getActivePersonnelStaffing(): Promise<StatusesInfo[]> {
    return this.getCustomStatuses(this.consts.CUSTOMTYPES.STAFFING, true);
  }

  public getUnitStates(): Promise<StatusesInfo[]> {
    return this.getCustomStatuses(this.consts.CUSTOMTYPES.UNIT, false);
  }

  public getActiveUnitStates(): Promise<StatusesInfo[]> {
    return this.getCustomStatuses(this.consts.CUSTOMTYPES.UNIT, true);
  }

  private getCustomStatuses(customType: any, activeOnly: boolean): Promise<StatusesInfo[]> {
    return this.dataProvider.getAllStatuses().then((statuses) => {
      const filteredStatuses: StatusesInfo[] = new Array<StatusesInfo>();

      if (statuses) {
        statuses.forEach(element => {
          if (activeOnly) {
            if (element.Type === customType && element.IsDeleted === false) {
              filteredStatuses.push(element);
            }
          } else {
            if (element.Type === customType) {
              filteredStatuses.push(element);
            }
          }
        });
      }

      return filteredStatuses;
    });
  }
}
