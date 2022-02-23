import { Injectable, Inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, forkJoin, Subscription } from "rxjs";
import { map, take } from "rxjs/operators";
import { DashboardPayload } from "../models/dashboardPayload";
import {
  CallPrioritiesService,
  CallsService,
  CallTypesService,
  ConnectionState,
  Consts,
  DispatchService,
  EventsService,
  FormsService,
  SignalRService,
  UnitsService,
  UnitStatusService,
} from "@resgrid/ngx-resgridlib";
import { CallLocalResult } from "src/app/core/models/callLocalResult";
import * as _ from "lodash";
import { Store } from "@ngrx/store";
import { HomeState } from "../store/home.store";
import { selectHomeState } from "src/app/store";
import { AuthState } from "../../auth/store/auth.store";
import { selectAuthState } from "src/app/store";
import * as HomeActions from "../../../features/home/actions/home.actions";

@Injectable({
  providedIn: "root",
})
export class HomeProvider {
  private personnelStatusUpdated$: Subscription;
  private personnelStaffingUpdated$: Subscription;
  private unitStatusUpdated$: Subscription;
  private callsUpdated$: Subscription;

  constructor(
    public http: HttpClient,
    private unitsProvider: UnitStatusService,
    private callsProvider: CallsService,
    private callPrioritiesProvider: CallPrioritiesService,
    private callTypesProvider: CallTypesService,
    private dispatchProvider: DispatchService,
    private formsProvider: FormsService,
    private signalRProvider: SignalRService,
    private store: Store<HomeState>,
    private authStore: Store<AuthState>,
    private events: EventsService,
    private consts: Consts
  ) {
    //this.personnelStatusUpdated$ = this.events.subscribe(this.consts.SIGNALR_EVENTS.PERSONNEL_STATUS_UPDATED);
    //this.personnelStaffingUpdated$ = this.events.subscribe(this.consts.SIGNALR_EVENTS.PERSONNEL_STAFFING_UPDATED);
    //this.unitStatusUpdated$ = this.events.subscribe(this.consts.SIGNALR_EVENTS.UNIT_STATUS_UPDATED);
    //this.callsUpdated$ = this.events.subscribe(this.consts.SIGNALR_EVENTS.CALLS_UPDATED);
    //this.events.subscribe(this.consts.SIGNALR_EVENTS.CALL_ADDED);
    //this.events.subscribe(this.consts.SIGNALR_EVENTS.CALL_CLOSED);
  }

  public getHomeData(): Observable<DashboardPayload> {
    const getUnits = this.unitsProvider.getAllUnitStatuses();
    const getCalls = this.callsProvider.getActiveCalls();
    const getCallPriorities = this.callPrioritiesProvider.getAllCallPriorites();
    const getCallTypes = this.callTypesProvider.getAllCallTypes();
    const getPersonnelForGrid = this.dispatchProvider.getPersonnelForCallGrid();
    const getGroupsForGrid = this.dispatchProvider.getGroupsForCallGrid();
    const getRolesForGrid = this.dispatchProvider.getRolesForCallGrid();
    const getNewCallForm = this.formsProvider.getNewCallForm();

    return forkJoin({
      units: getUnits,
      calls: getCalls,
      priorities: getCallPriorities,
      types: getCallTypes,
      personnelForGrid: getPersonnelForGrid,
      groupsForGrid: getGroupsForGrid,
      rolesForGrid: getRolesForGrid,
      newCallForm: getNewCallForm,
    }).pipe(
      map((results) => {
        let localCalls: CallLocalResult[] = new Array();
        if (
          results &&
          results.calls &&
          results.calls.Data &&
          results.priorities &&
          results.priorities.Data
        ) {
          results.calls.Data.forEach((call) => {
            let localCall: CallLocalResult = call as CallLocalResult;

            const prioirty = results.priorities.Data.find((obj) => {
              return obj.Id === localCall.Priority;
            });

            if (prioirty) {
              localCall.PriorityText = prioirty.Name;
              localCall.PriorityColor = prioirty.Color;
            }

            localCalls.push(localCall);
          });
        }

        return {
          UnitStatuses: results.units.Data,
          Calls: results.calls.Data,
          CallPriorties: results.priorities.Data,
          CallTypes: results.types.Data,
          PersonnelForGrid: results.personnelForGrid.Data,
          GroupsForGrid: results.groupsForGrid.Data,
          RolesForGrid: results.rolesForGrid.Data,
          NewCallForm: results.newCallForm.Data,
        };
      })
    );
  }

  public startSignalR() {
    this.authStore
      .select(selectAuthState)
      .pipe(take(1))
      .subscribe((auth) => {
        this.signalRProvider.connectionState$.subscribe(
          (state: ConnectionState) => {}
        );

        this.signalRProvider.start(auth.user.departmentId);
        this.init();
      });
  }

  public init() {
    this.events.subscribe(
      this.consts.SIGNALR_EVENTS.PERSONNEL_STATUS_UPDATED,
      (data: any) => {
        this.store.dispatch(new HomeActions.GetLatestPersonnelData());
      }
    );
    this.events.subscribe(
      this.consts.SIGNALR_EVENTS.PERSONNEL_STAFFING_UPDATED,
      (data: any) => {
        this.store.dispatch(new HomeActions.GetLatestPersonnelData());
      }
    );
    this.events.subscribe(
      this.consts.SIGNALR_EVENTS.UNIT_STATUS_UPDATED,
      (data: any) => {
        this.store.dispatch(new HomeActions.GetLatestUnitStates());
      }
    );
    this.events.subscribe(
      this.consts.SIGNALR_EVENTS.CALLS_UPDATED,
      (data: any) => {
        this.store.dispatch(new HomeActions.GetLatestCalls());
      }
    );
  }
}
