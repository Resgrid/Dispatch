import { Injectable, Inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, forkJoin } from "rxjs";
import { map } from "rxjs/operators";
import { SettingsProvider } from "src/app/providers/settings";
import { TypesProvider } from "src/app/providers/types";
import { DataProvider } from "src/app/providers/data";
import { UnitsProvider } from "src/app/providers/units";
import { CallsProvider } from "src/app/providers/calls";
import { DashboardPayload } from "../models/dashboardPayload";
import { DispatchProvider } from "src/app/providers/dispatch";

@Injectable({
  providedIn: "root",
})
export class HomeProvider {
  constructor(
    public http: HttpClient,
    private settingsProvider: SettingsProvider,
    private dataProvider: DataProvider,
    private typesProvider: TypesProvider,
    private unitsProvider: UnitsProvider,
    private callsProvider: CallsProvider,
    private dispatchProvider: DispatchProvider
  ) {}

  public getHomeData(): Observable<DashboardPayload> {
    const getUnits = this.unitsProvider.getUnitStatusesFull();
    const getCalls = this.callsProvider.getActiveCalls();
    const getCallPriorities = this.callsProvider.getCallPriorties();
    const getCallTypes = this.callsProvider.getCallTypes();
    const getPersonnelForGrid =
      this.dispatchProvider.getPersonnelForCallGridPayload();
    const getGroupsForGrid =
      this.dispatchProvider.getGroupsForCallGridPayload();
    const getRolesForGrid =
      this.dispatchProvider.getRolesForCallGridPayload();
      const getNewCallForm =
      this.dispatchProvider.getcallForm();

    return forkJoin({units: getUnits, 
                     calls: getCalls, 
                     priorities: getCallPriorities,
                     types: getCallTypes,
                     personnelForGrid: getPersonnelForGrid,
                     groupsForGrid: getGroupsForGrid,
                     rolesForGrid: getRolesForGrid,
                     newCallForm: getNewCallForm}).pipe(
      map((results) => {
        return {
          UnitStatuses: results.units,
          Calls: results.calls,
          CallPriorties: results.priorities,
          CallTypes: results.types,
          PersonnelForGrid: results.personnelForGrid,
          GroupsForGrid: results.groupsForGrid,
          RolesForGrid: results.rolesForGrid,
          NewCallForm: results.newCallForm
        };
      })
    );
  }
}
