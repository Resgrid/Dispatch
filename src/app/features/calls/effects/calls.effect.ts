import * as callsAction from "../actions/calls.actions";
import { Action, Store } from "@ngrx/store";
import { Actions, Effect, ofType } from "@ngrx/effects";
import { catchError, exhaustMap, map, mergeMap, tap } from "rxjs/operators";
import { Injectable } from "@angular/core";
import { forkJoin, from, Observable, of } from "rxjs";
import { NgbModal, NgbModalRef } from "@ng-bootstrap/ng-bootstrap";
import { CallsState } from "../store/calls.store";
import { VoiceProvider } from "src/app/providers/voice";
import { CallsProvider } from "src/app/providers/calls";
import { GpsLocation } from "src/app/core/models/gpsLocation";
import { LocationProvider } from "src/app/providers/location";

import * as _ from "lodash";
import { AlertProvider } from "src/app/providers/alert";
import { LoadChildren, Router } from "@angular/router";
import { LoadingProvider } from "src/app/providers/loading";
import { merge } from "lodash";
import { UpdateDispatchTimeModalComponent } from "../modals/updateDispatchTime/updateDispatchTime.modal";

@Injectable()
export class CallsEffects {
  private _modalRef: NgbModalRef;

  @Effect()
  getScheduledCalls$: Observable<Action> = this.actions$.pipe(
    ofType<callsAction.GetScheduledCalls>(
      callsAction.CallsActionTypes.GET_SCHEDULED_CALLS
    ),
    mergeMap((action) =>
      this.callsProvider.GetAllPendingScheduledCalls().pipe(
        // If successful, dispatch success action with result
        map((data) => ({
          type: callsAction.CallsActionTypes.GET_SCHEDULED_CALLS_SUCCESS,
          payload: data,
        })),
        tap((data) => {}),
        // If request fails, dispatch failed action
        catchError(() =>
          of({ type: callsAction.CallsActionTypes.GET_SCHEDULED_CALLS_FAIL })
        )
      )
    )
  );

  @Effect({ dispatch: false })
  getScheduledCallsFail$ = this.actions$.pipe(
    ofType<callsAction.GetScheduledCallsFail>(
      callsAction.CallsActionTypes.GET_SCHEDULED_CALLS_FAIL
    ),
    tap(async (action) => {
      this.loadingProvider.hide();
      this.alertProvider.showErrorAlert(
        "Get Scheduled Calls Error",
        "",
        "There was an issue trying to get scheduled calls, please try again."
      );
    })
  );

  @Effect({ dispatch: false })
  getScheduledCallsSuccess$: Observable<Action> = this.actions$.pipe(
    ofType<callsAction.GetScheduledCallsSuccess>(
      callsAction.CallsActionTypes.GET_SCHEDULED_CALLS_SUCCESS
    ),
    tap((data) => {
      this.loadingProvider.hide();
    })
  );

  @Effect({ dispatch: false })
  getUpdatedPersonnelandUnitsDistancesToCall$: Observable<Action> = this.actions$.pipe(
    ofType<callsAction.GetUpdatedPersonnelandUnitsDistancesToCall>(
      callsAction.CallsActionTypes.GET_UPDATEDPERSONANDUNITS_DISTANCE
    ),
    map((action) => {
      let personnel = _.cloneDeep(action.personnel);
      let units = _.cloneDeep(action.units);

      if (!action.callLocation) {
        personnel.forEach((person) => {
          person.Distance = 0;
        });

        units.forEach((unit) => {
          unit.Distance = 0;
        });
      } else {
        personnel.forEach((person) => {
          if (person.Location) {
            const locationParts = person.Location.split(",");
            const distance = this.locationProvider.getDistanceBetweenTwoPoints(
              action.callLocation,
              new GpsLocation(
                Number(locationParts[0]),
                Number(locationParts[1])
              )
            );

            if (distance && distance > 0) {
              person.Distance = distance / 1000;
            } else {
              person.Distance = 0;
            }
          } else {
            person.Distance = 0;
          }
        });

        units.forEach((unit) => {
          if (unit.Latitude && unit.Longitude) {
            const distance = this.locationProvider.getDistanceBetweenTwoPoints(
              action.callLocation,
              new GpsLocation(Number(unit.Latitude), Number(unit.Longitude))
            );

            if (distance && distance > 0) {
              unit.Distance = distance / 1000;
            } else {
              unit.Distance = 0;
            }
          } else {
            unit.Distance = 0;
          }
        });
      }
      return {
        type: callsAction.CallsActionTypes.UPDATE_PERSONANDUNITS_DISTANCE,
        personnel: personnel,
        units: units,
      };
    })
  );

  @Effect()
  getCallById$: Observable<Action> = this.actions$.pipe(
    ofType<callsAction.GetCallById>(callsAction.CallsActionTypes.GET_CALL_BYID),
    tap(() => this.loadingProvider.show()),
    mergeMap((action) =>
      forkJoin([
        this.callsProvider.getCall(action.callId),
        this.callsProvider.getCallData(action.callId),
      ]).pipe(
        // If successful, dispatch success action with result
        map((result) => ({
          type: callsAction.CallsActionTypes.GET_CALL_BYID_SUCCESS,
          call: result[0],
          data: result[1],
        })),
        tap((data) => {}),
        // If request fails, dispatch failed action
        catchError(() =>
          of({ type: callsAction.CallsActionTypes.GET_CALL_BYID_FAIL })
        )
      )
    )
  );

  @Effect({ dispatch: false })
  getCallByIdFail$ = this.actions$.pipe(
    ofType<callsAction.GetCallByIdFailure>(
      callsAction.CallsActionTypes.GET_CALL_BYID_FAIL
    ),
    tap(async (action) => {
      this.loadingProvider.hide();
      this.alertProvider.showErrorAlert(
        "Get Call Error",
        "",
        "There was an issue trying to get this call, please try again."
      );
    })
  );

  @Effect({ dispatch: false })
  getCallByIdSuccess$: Observable<Action> = this.actions$.pipe(
    ofType<callsAction.GetCallByIdSuccess>(
      callsAction.CallsActionTypes.GET_CALL_BYID_SUCCESS
    ),
    tap((data) => {
      this.loadingProvider.hide();
    })
  );

  @Effect()
  updateCall$: Observable<Action> = this.actions$.pipe(
    ofType<callsAction.UpdateCall>(callsAction.CallsActionTypes.UPDATE_CALL),
    mergeMap((action) =>
      this.callsProvider
        .updateCall(
          action.call.Id,
          action.call.Name,
          action.call.Priority,
          action.call.Type,
          action.call.ContactName,
          action.call.ContactInfo,
          action.call.ExternalId,
          action.call.IncidentId,
          action.call.ReferenceId,
          action.call.Nature,
          action.call.Note,
          action.call.Address,
          action.call.w3w,
          parseInt(action.call.Latitude, 10),
          parseInt(action.call.Longitude, 10),
          action.call.DispatchList,
          action.call.DispatchOn,
          action.call.FormData,
          action.call.Redispatch
        )
        .pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: callsAction.CallsActionTypes.UPDATE_CALL_SUCCESS,
          })),
          // If request fails, dispatch failed action
          catchError(() =>
            of({ type: callsAction.CallsActionTypes.UPDATE_CALL_FAIL })
          )
        )
    )
  );

  @Effect({ dispatch: false })
  saveCallFail$ = this.actions$.pipe(
    ofType<callsAction.UpdateCallFail>(
      callsAction.CallsActionTypes.UPDATE_CALL_FAIL
    ),
    tap(async (action) => {
      this.closeModal();
      this.alertProvider.showErrorAlert(
        "Update Save Error",
        "",
        "There was an issue trying to save the call, please try again."
      );
    })
  );

  @Effect({ dispatch: false })
  saveCallSuccess$: Observable<Action> = this.actions$.pipe(
    ofType<callsAction.UpdateCallSuccess>(
      callsAction.CallsActionTypes.UPDATE_CALL_SUCCESS
    ),
    tap((data) => {
      this.loadingProvider.hide();
      this.router.navigate(["/home"]);
      this.alertProvider.showAutoCloseSuccessAlert("Call has been updated.");
    })
  );

  @Effect({ dispatch: false })
  showUpdateCallDispatchTimeModal$: Observable<Action> = this.actions$.pipe(
    ofType<callsAction.ShowUpdateCallDispatchTimeModal>(
      callsAction.CallsActionTypes.SHOW_CALLDISPATCHTIMEMODAL
    ),
    exhaustMap((data) => this.runModal(UpdateDispatchTimeModalComponent, "md"))
  );

  @Effect()
  updateCallDispatchTime$: Observable<Action> = this.actions$.pipe(
    ofType<callsAction.UpdateCallDispatchTime>(callsAction.CallsActionTypes.UPDATE_CALL_DISPATCHTIME),
    mergeMap((action) =>
      this.callsProvider
        .updateCallDisptachTime(
          action.callId,
          action.date,
        ).pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: callsAction.CallsActionTypes.UPDATE_CALL_DISPATCHTIME_SUCCESS,
          })),
          tap((data) => {
            this.closeModal();
          }),
          // If request fails, dispatch failed action
          catchError(() =>
            of({ type: callsAction.CallsActionTypes.UPDATE_CALL_DISPATCHTIME_FAIL })
          )
        )
    )
  );

  @Effect({ dispatch: false })
  updateCallDispatchTimeFail$ = this.actions$.pipe(
    ofType<callsAction.UpdateCallDispatchTimeFail>(
      callsAction.CallsActionTypes.UPDATE_CALL_DISPATCHTIME_FAIL
    ),
    tap(async (action) => {
      this.closeModal();
      this.alertProvider.showErrorAlert(
        "Update Save Error",
        "",
        "There was an issue trying to save the call, please try again."
      );
    })
  );

  @Effect({ dispatch: false })
  updateCallDispatchTimeSuccess$: Observable<Action> = this.actions$.pipe(
    ofType<callsAction.UpdateCallDispatchTimeSuccess>(
      callsAction.CallsActionTypes.UPDATE_CALL_DISPATCHTIME_SUCCESS
    ),
    tap((data) => {
      this.alertProvider.showAutoCloseSuccessAlert("Call has been updated.");
    })
  );

  constructor(
    private actions$: Actions,
    private store: Store<CallsState>,
    private modalService: NgbModal,
    private callsProvider: CallsProvider,
    private locationProvider: LocationProvider,
    private alertProvider: AlertProvider,
    private loadingProvider: LoadingProvider,
    private router: Router
  ) {}

  runModal = (component, size) => {
    this.closeModal();

    if (!size) {
      size = "md";
    }

    this._modalRef = this.modalService.open(component, {
      centered: true,
      backdrop: "static",
      size: size,
    });

    return from(this._modalRef.result);
  };

  closeModal = () => {
    if (this._modalRef) {
      this._modalRef.close();
      this._modalRef = null;
    }
  };
}
