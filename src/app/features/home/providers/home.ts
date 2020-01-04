import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { SettingsProvider } from 'src/app/providers/settings';
import { TypesProvider } from 'src/app/providers/types';
import { DataProvider } from 'src/app/providers/data';
import { APP_CONFIG_TOKEN, AppConfig } from 'src/app/config/app.config-interface';
import { UnitsProvider } from 'src/app/providers/units';
import { CallsProvider } from 'src/app/providers/calls';
import { DashboardPayload } from '../models/dashboardPayload';

@Injectable({
    providedIn: 'root'
})
export class HomeProvider {

    constructor(public http: HttpClient, private settingsProvider: SettingsProvider,
        private dataProvider: DataProvider, private typesProvider: TypesProvider,
        @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig, private unitsProvider: UnitsProvider,
        private callsProvider: CallsProvider) {

    }

    public getHomeData(): Observable<DashboardPayload> {

        const getUnits = this.unitsProvider.getUnitStatusesFull();
        const getCalls = this.callsProvider.getActiveCalls();


        return forkJoin([getUnits, getCalls]).pipe(map((results) => {
            return {
                UnitStatuses: results[0],
                Calls: results[1]
            };
        }));
    }
}
