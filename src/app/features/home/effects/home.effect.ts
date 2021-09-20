import * as homeAction from "../actions/home.actions";
import { Action, Store } from "@ngrx/store";
import { Actions, Effect, ofType } from "@ngrx/effects";
import { catchError, exhaustMap, map, mergeMap, tap } from "rxjs/operators";
import { Injectable } from "@angular/core";
import { from, Observable, of } from "rxjs";
import { HomeProvider } from "../providers/home";
import { NgbModal, NgbModalRef } from "@ng-bootstrap/ng-bootstrap";
import { SetUnitStatusModalComponent } from "../modals/setUnitStatus/setUnitStatus.modal";
import { DispatchProvider } from "src/app/providers/dispatch";
import { UnitStatusProvider } from "src/app/providers/unitStatus";
import { AlertProvider } from "src/app/providers/alert";
import { UnitsProvider } from "src/app/providers/units";
import { HomeState } from "../store/home.store";
import { CallsProvider } from "src/app/providers/calls";
import { CloseCallModalComponent } from "../modals/closeCall/closeCall.modal";
import { MapProvider } from "src/app/providers/map";
import { SelectTemplateModalComponent } from "../modals/selectTemplate/selectTemplate.modal";
import { LocationProvider } from "src/app/providers/location";
import { CallNotesModalComponent } from "../modals/callNotes/callNotes.modal";
import { CallImagesModalComponent } from "../modals/callImages/callImages.modal";
import { CallFilesModalComponent } from "../modals/callFiles/callFiles.modal";
import { GpsLocation } from "src/app/core/models/gpsLocation";
import { PersonnelForCallResult } from "src/app/core/models/personnelForCallResult";
import { CallFormModalComponent } from "../modals/callForm/callForm.modal";
import { VoiceProvider } from "src/app/providers/voice";
import { LoadingProvider } from "src/app/providers/loading";

@Injectable()
export class HomeEffects {
  private _modalRef: NgbModalRef;

  @Effect()
  loading$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.Loading>(homeAction.HomeActionTypes.LOADING),
    tap(() => {
      this.loadingProvider.show();
    }),
    mergeMap((action) =>
      this.homeProvider.getHomeData().pipe(
        // If successful, dispatch success action with result
        map((data) => ({
          type: homeAction.HomeActionTypes.LOADING_SUCCESS,
          payload: data,
        })),
        // If request fails, dispatch failed action
        catchError(() => of({ type: homeAction.HomeActionTypes.LOADING_FAIL }))
      )
    )
  );

  @Effect()
  loadingSuccess$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.LoadingSuccess>(
      homeAction.HomeActionTypes.LOADING_SUCCESS
    ),
    map((data) => ({
      type: homeAction.HomeActionTypes.LOADING_MAP,
    }))
  );

  @Effect({ dispatch: false })
  loadingFail$ = this.actions$.pipe(
    ofType<homeAction.LoadingFail>(
      homeAction.HomeActionTypes.LOADING_FAIL
    ),
    tap(async (action) => {
      this.loadingProvider.hide()
      this.alertProvider.showErrorAlert(
        "Unable to load data",
        "",
        "There was an issue trying to fetch the dashboard data, please try again."
      );
    })
  );

  @Effect()
  showSetUnitStatusModal$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.ShowSetUnitStateModal>(
      homeAction.HomeActionTypes.SHOW_SETUNITSTATUSMODAL
    ),
    mergeMap((action) =>
      this.dispatchProvider.getSetUnitStatusesModalPayload(action.unitId).pipe(
        map((data) => ({
          type: homeAction.HomeActionTypes.OPEN_SETUNITSTATUSMODAL,
          payload: data,
        }))
      )
    )
  );

  @Effect({ dispatch: false })
  openSetUnitStatusModal$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.OpenSetUnitStateModal>(
      homeAction.HomeActionTypes.OPEN_SETUNITSTATUSMODAL
    ),
    exhaustMap((data) => this.runModal(SetUnitStatusModalComponent, "md"))
  );

  @Effect()
  saveUnitState$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.SavingUnitState>(
      homeAction.HomeActionTypes.SAVE_UNITSTATE
    ),
    mergeMap((action) =>
      this.unitStatusProvider
        .sendUnitStatus({
          UnitId: action.payload.unitId,
          StateType: action.payload.stateType,
          RespondingTo: action.payload.destination,
          UtcTimestamp: action.payload.date.toUTCString().replace("UTC", "GMT"),
          LocalTimestamp: action.payload.date.toISOString(),
          Note: action.payload.note,
        })
        .pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.SAVE_UNITSTATE_SUCCESS,
          })),
          tap((data) => {
            this.closeModal();
          }),
          // If request fails, dispatch failed action
          catchError(() =>
            of({ type: homeAction.HomeActionTypes.SAVE_UNITSTATE_FAIL })
          )
        )
    )
  );

  @Effect({ dispatch: false })
  saveUnitStateFail$ = this.actions$.pipe(
    ofType<homeAction.SavingUnitStateFail>(
      homeAction.HomeActionTypes.SAVE_UNITSTATE_FAIL
    ),
    tap(async (action) => {
      this.closeModal();
      this.alertProvider.showErrorAlert(
        "Unit Status Error",
        "",
        "There was an issue trying to set the unit status, please try again."
      );
    })
  );

  @Effect()
  saveUnitStateSuccess$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.SavingUnitStateSuccess>(
      homeAction.HomeActionTypes.SAVE_UNITSTATE_SUCCESS
    ),
    mergeMap((action) =>
      this.unitsProvider.getUnitStatusesFull().pipe(
        // If successful, dispatch success action with result
        map((data) => ({
          type: homeAction.HomeActionTypes.UPDATE_UNITSTATES,
          payload: data,
        })),
        tap((data) => {
          this.alertProvider.showAutoCloseSuccessAlert(
            "Unit State has been saved."
          );
        }),
        // If request fails, dispatch failed action
        catchError(() =>
          of({ type: homeAction.HomeActionTypes.SAVE_UNITSTATE_FAIL })
        )
      )
    )
  );

  @Effect()
  getLastestUnitStates$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.SavingUnitStateSuccess>(
      homeAction.HomeActionTypes.GET_LATESTUNITSTATES
    ),
    mergeMap((action) =>
      this.unitsProvider.getUnitStatusesFull().pipe(
        // If successful, dispatch success action with result
        map((data) => ({
          type: homeAction.HomeActionTypes.UPDATE_UNITSTATES,
          payload: data,
        })),
        // If request fails, dispatch failed action
        catchError(() =>
          of({ type: homeAction.HomeActionTypes.GENERAL_FAILURE })
        )
      )
    )
  );

  @Effect()
  saveCloseCall$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.SavingCloseCall>(
      homeAction.HomeActionTypes.SAVE_CLOSECALL
    ),
    mergeMap((action) =>
      this.callsProvider
        .closeCall(
          action.payload.callId,
          action.payload.note,
          action.payload.stateType
        )
        .pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.SAVE_CLOSECALL_SUCCESS,
          })),
          tap((data) => {
            this.closeModal();
          }),
          // If request fails, dispatch failed action
          catchError(() =>
            of({ type: homeAction.HomeActionTypes.SAVE_CLOSECALL_FAIL })
          )
        )
    )
  );

  @Effect({ dispatch: false })
  openCloseCallModal$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.ShowCloseCallModal>(
      homeAction.HomeActionTypes.SHOW_CLOSECALLMODAL
    ),
    exhaustMap((data) => this.runModal(CloseCallModalComponent, "md"))
  );

  @Effect({ dispatch: false })
  saveCloseCallFail$ = this.actions$.pipe(
    ofType<homeAction.SavingCloseCallFail>(
      homeAction.HomeActionTypes.SAVE_CLOSECALL_FAIL
    ),
    tap(async (action) => {
      this.closeModal();
      this.alertProvider.showErrorAlert(
        "Close Call Error",
        "",
        "There was an issue trying to close the call, please try again."
      );
    })
  );

  @Effect()
  saveCloseCallSuccess$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.ShowCloseCallModal>(
      homeAction.HomeActionTypes.SAVE_CLOSECALL_SUCCESS
    ),
    mergeMap((action) =>
      this.callsProvider.getActiveCalls().pipe(
        // If successful, dispatch success action with result
        map((data) => ({
          type: homeAction.HomeActionTypes.UPDATE_CALLS,
          payload: data,
        })),
        tap((data) => {
          this.alertProvider.showAutoCloseSuccessAlert("Call has been closed.");
        }),
        // If request fails, dispatch failed action
        catchError(() =>
          of({ type: homeAction.HomeActionTypes.SAVE_CLOSECALL_FAIL })
        )
      )
    )
  );

  @Effect()
  loadingMap$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.LoadingMap>(homeAction.HomeActionTypes.LOADING_MAP),
    mergeMap((action) =>
      this.mapProvider.getMapData().pipe(
        // If successful, dispatch success action with result
        map((data) => ({
          type: homeAction.HomeActionTypes.LOADING_MAP_SUCCESS,
          payload: data,
        })),
        // If request fails, dispatch failed action
        catchError(() =>
          of({ type: homeAction.HomeActionTypes.LOADING_MAP_FAIL })
        )
      )
    )
  );

  @Effect({ dispatch: false })
  loadingMapSuccess$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.LoadingMapSuccess>(
      homeAction.HomeActionTypes.LOADING_MAP_SUCCESS
    ),
    tap((action) => {this.loadingProvider.hide();})
  );

  @Effect({ dispatch: false })
  loadingMapFail$ = this.actions$.pipe(
    ofType<homeAction.LoadingMapFail>(
      homeAction.HomeActionTypes.LOADING_MAP_FAIL
    ),
    tap(async (action) => {
      this.loadingProvider.hide()
      this.alertProvider.showErrorAlert(
        "Unable to load map data",
        "",
        "There was an issue trying to fetch the map data, please try again."
      );
    })
  );

  @Effect()
  showSelectCallTemplateModal$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.ShowSelectCallTemplateModal>(
      homeAction.HomeActionTypes.SHOW_SELECTCALLTEMPLATEMODAL
    ),
    mergeMap((action) =>
      this.dispatchProvider.getcallTemplatesPayload().pipe(
        map((data) => ({
          type: homeAction.HomeActionTypes.OPEN_SELECTCALLTEMPLATEMODAL,
          payload: data,
        }))
      )
    )
  );

  @Effect({ dispatch: false })
  openSelectCallTemplateModal$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.OpenSelectCallTemplateModal>(
      homeAction.HomeActionTypes.OPEN_SELECTCALLTEMPLATEMODAL
    ),
    exhaustMap((data) => this.runModal(SelectTemplateModalComponent, "md"))
  );

  @Effect({ dispatch: false })
  applyCallTemplateModal$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.ApplyCallTemplate>(
      homeAction.HomeActionTypes.UPDATE_APPLYCALLTEMPLATE
    ),
    tap(async (action) => {
      this.closeModal();
    })
  );

  @Effect()
  getCoordinatesForAddress$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.GetCoordinatesForAddress>(
      homeAction.HomeActionTypes.GET_COORDINATESFORADDRESS
    ),
    mergeMap((action) =>
      this.locationProvider
        .getCoordinatesForAddressFromGoogle(action.address)
        .pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.GET_COORDINATESFORADDRESS_SUCCESS,
            payload: data,
          })),
          // If request fails, dispatch failed action
          catchError(() =>
            of({
              type: homeAction.HomeActionTypes.GET_COORDINATESFORADDRESS_FAIL,
            })
          )
        )
    )
  );

  @Effect()
  saveCall$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.SaveCall>(homeAction.HomeActionTypes.SAVE_CALL),
    mergeMap((action) =>
      this.callsProvider
        .saveCall(
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
          action.call.Latitude,
          action.call.Longitude,
          action.call.DispatchList,
          action.call.DispatchOn,
          action.call.FormData
        )
        .pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.SAVE_CALL_SUCCESS,
          })),
          // If request fails, dispatch failed action
          catchError(() =>
            of({ type: homeAction.HomeActionTypes.SAVE_CALL_FAIL })
          )
        )
    )
  );

  @Effect({ dispatch: false })
  saveCallFail$ = this.actions$.pipe(
    ofType<homeAction.SaveCallFail>(homeAction.HomeActionTypes.SAVE_CALL_FAIL),
    tap(async (action) => {
      this.closeModal();
      this.alertProvider.showErrorAlert(
        "Call Save Error",
        "",
        "There was an issue trying to save the call, please try again."
      );
    })
  );

  @Effect({ dispatch: false })
  saveCallSuccess$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.SaveCallSuccess>(
      homeAction.HomeActionTypes.SAVE_CALL_SUCCESS
    ),
    tap((data) => {
      this.alertProvider.showAutoCloseSuccessAlert(
        "Call has been saved and dispatched."
      );
    })
  );

  @Effect()
  getLatestPersonnelData$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.GetLatestPersonnelData>(
      homeAction.HomeActionTypes.GET_LATESTPERSONNELDATA
    ),
    mergeMap((action) =>
      this.dispatchProvider.getPersonnelForCallGridPayload().pipe(
        // If successful, dispatch success action with result
        map((data) => ({
          type: homeAction.HomeActionTypes.UPDATE_PERSONNELDATA,
          payload: data,
        })),
        // If request fails, dispatch failed action
        catchError(() =>
          of({ type: homeAction.HomeActionTypes.GENERAL_FAILURE })
        )
      )
    )
  );

  @Effect()
  getLatestCalls$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.GetLatestCalls>(
      homeAction.HomeActionTypes.GET_LATESTCALLS
    ),
    mergeMap((action) =>
      this.callsProvider.getActiveCalls().pipe(
        // If successful, dispatch success action with result
        map((data) => ({
          type: homeAction.HomeActionTypes.UPDATE_CALLS,
          payload: data,
        })),
        // If request fails, dispatch failed action
        catchError(() =>
          of({ type: homeAction.HomeActionTypes.GENERAL_FAILURE })
        )
      )
    )
  );

  @Effect()
  showCallNotesModal$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.ShowCallNotesModal>(
      homeAction.HomeActionTypes.SHOW_CALLNOTESMODAL
    ),
    mergeMap((action) =>
      this.callsProvider.getCallNotes(action.callId).pipe(
        map((data) => ({
          type: homeAction.HomeActionTypes.OPEN_CALLNOTESMODAL,
          payload: data,
        }))
      )
    )
  );

  @Effect({ dispatch: false })
  openCallNotesModal$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.OpenCallNotesModal>(
      homeAction.HomeActionTypes.OPEN_CALLNOTESMODAL
    ),
    exhaustMap((data) => this.runModal(CallNotesModalComponent, "lg"))
  );

  @Effect()
  saveCallNote$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.SaveCallNote>(homeAction.HomeActionTypes.SAVE_CALLNOTE),
    mergeMap((action) =>
      this.callsProvider
        .saveCallNote(action.callId, action.userId, action.callNote, null)
        .pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.SAVE_CALLNOTE_SUCCESS,
          })),
          tap((data) => {
            this.closeModal();
          }),
          // If request fails, dispatch failed action
          catchError(() =>
            of({ type: homeAction.HomeActionTypes.SAVE_CALLNOTE_FAIL })
          )
        )
    )
  );

  @Effect()
  showCallImagesModal$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.ShowCallImagesModal>(
      homeAction.HomeActionTypes.SHOW_CALLIMAGESMODAL
    ),
    mergeMap((action) =>
      this.callsProvider.getCallImages(action.callId, true).pipe(
        map((data) => ({
          type: homeAction.HomeActionTypes.OPEN_CALLIMAGESMODAL,
          payload: data,
        }))
      )
    )
  );

  @Effect({ dispatch: false })
  openCallImagesModal$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.OpenCallImagesModal>(
      homeAction.HomeActionTypes.OPEN_CALLIMAGESMODAL
    ),
    exhaustMap((data) => this.runModal(CallImagesModalComponent, "xl"))
  );

  @Effect()
  uploadCallImage$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.UploadCallImage>(
      homeAction.HomeActionTypes.UPLOAD_CALLIMAGE
    ),
    mergeMap((action) =>
      this.callsProvider
        .saveCallImage(
          action.callId,
          action.userId,
          "",
          action.name,
          null,
          action.image
        )
        .pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.UPLOAD_CALLIMAGE_SUCCESS,
          })),
          tap((data) => {
            this.closeModal();
          }),
          // If request fails, dispatch failed action
          catchError(() =>
            of({ type: homeAction.HomeActionTypes.UPLOAD_CALLIMAGE_FAIL })
          )
        )
    )
  );

  @Effect()
  showCallFilesModal$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.ShowCallFilesModal>(
      homeAction.HomeActionTypes.SHOW_CALLFILESMODAL
    ),
    mergeMap((action) =>
      this.callsProvider.getCallFiles(action.callId, false).pipe(
        map((data) => ({
          type: homeAction.HomeActionTypes.OPEN_CALLFILESMODAL,
          payload: data,
        }))
      )
    )
  );

  @Effect({ dispatch: false })
  openCallFilesModal$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.OpenCallFilesModal>(
      homeAction.HomeActionTypes.OPEN_CALLFILESMODAL
    ),
    exhaustMap((data) => this.runModal(CallFilesModalComponent, "lg"))
  );

  @Effect()
  uploadCallFile$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.UploadCallFile>(
      homeAction.HomeActionTypes.UPLOAD_CALLFILE
    ),
    mergeMap((action) =>
      this.callsProvider
        .saveCallFile(
          action.callId,
          action.userId,
          "",
          action.name,
          null,
          action.image
        )
        .pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.UPLOAD_CALLFILE_SUCCESS,
          })),
          tap((data) => {
            this.closeModal();
          }),
          // If request fails, dispatch failed action
          catchError(() =>
            of({ type: homeAction.HomeActionTypes.UPLOAD_CALLFILE_FAIL })
          )
        )
    )
  );

  @Effect()
  getUpdatedPersonnelandUnitsDistancesToCall$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.GetUpdatedPersonnelandUnitsDistancesToCall>(
      homeAction.HomeActionTypes.GET_UPDATEDPERSONANDUNITS_DISTANCE
    ),
    map((action) => {
      if (!action.callLocation) {
        action.personnel.forEach((person) => {
          person.Distance = 0;
        });

        action.units.forEach((unit) => {
          unit.Distance = 0;
        });
      } else {
        action.personnel.forEach((person) => {
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

        action.units.forEach((unit) => {
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
        type: homeAction.HomeActionTypes.UPDATE_PERSONANDUNITS_DISTANCE,
        personnel: action.personnel,
        units: action.units,
      };
    })
  );

  @Effect({ dispatch: false })
  openCallFormModal$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.OpenCallFormModal>(
      homeAction.HomeActionTypes.OPEN_CALLFORMMODAL
    ),
    exhaustMap((data) => this.runModal(CallFormModalComponent, "xl"))
  );

  @Effect()
  getVoipInfo$: Observable<Action> = this.actions$.pipe(
    ofType<homeAction.GetVoipInfo>(homeAction.HomeActionTypes.GET_VOIPINFO),
    mergeMap((action) =>
      this.voiceProvider.getVoiceSettings().pipe(
        // If successful, dispatch success action with result
        map((data) => ({
          type: homeAction.HomeActionTypes.GET_VOIPINFO_SUCCESS,
          payload: data,
        })),
        tap((data) => {}),
        // If request fails, dispatch failed action
        catchError(() =>
          of({ type: homeAction.HomeActionTypes.GET_VOIPINFO_FAIL })
        )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private store: Store<HomeState>,
    private homeProvider: HomeProvider,
    private modalService: NgbModal,
    private dispatchProvider: DispatchProvider,
    private unitStatusProvider: UnitStatusProvider,
    private alertProvider: AlertProvider,
    private unitsProvider: UnitsProvider,
    private callsProvider: CallsProvider,
    private mapProvider: MapProvider,
    private locationProvider: LocationProvider,
    private voiceProvider: VoiceProvider,
    private loadingProvider: LoadingProvider
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
