import * as homeAction from "../actions/home.actions";
import { Action, Store } from "@ngrx/store";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { catchError, exhaustMap, map, mergeMap, tap, switchMap } from "rxjs/operators";
import { Injectable } from "@angular/core";
import { from, Observable, of } from "rxjs";
import { HomeProvider } from "../providers/home";
import { NgbModal, NgbModalRef } from "@ng-bootstrap/ng-bootstrap";
import { SetUnitStatusModalComponent } from "../modals/setUnitStatus/setUnitStatus.modal";
import { AlertProvider } from "src/app/providers/alert";
import { HomeState } from "../store/home.store";
import { CloseCallModalComponent } from "../modals/closeCall/closeCall.modal";
import { SelectTemplateModalComponent } from "../modals/selectTemplate/selectTemplate.modal";
import { CallNotesModalComponent } from "../modals/callNotes/callNotes.modal";
import { CallImagesModalComponent } from "../modals/callImages/callImages.modal";
import { CallFilesModalComponent } from "../modals/callFiles/callFiles.modal";
import { PersonnelForCallResult } from "src/app/core/models/personnelForCallResult";
import { CallFormModalComponent } from "../modals/callForm/callForm.modal";
import { LoadingProvider } from "src/app/providers/loading";
import {
  CallFilesService,
  CallNotesService,
  CallsService,
  DispatchService,
  GpsLocation,
  LocationService,
  MappingService,
  PersonnelStaffingService,
  PersonnelStatusesService,
  UnitsService,
  UnitStatusService,
  VoiceService,
} from "@resgrid/ngx-resgridlib";
import * as _ from "lodash";
import { SetPersonStatusModalComponent } from "../modals/setPersonStatus/setPersonStatus.modal";
import { SetPersonStaffingModalComponent } from "../modals/setPersonStaffing/setPersonStaffing.modal";
import { GeocodingProvider } from "src/app/providers/geocoding";
import { ViewCallFormModalComponent } from "../modals/viewCallForm/view-callForm.modal";

@Injectable()
export class HomeEffects {
  private _modalRef: NgbModalRef;

  loading$ = createEffect(() =>
    this.actions$.pipe(
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
          catchError(() => of({ type: homeAction.HomeActionTypes.LOADING_FAIL })),
        ),
      ),
    ),
  );

  loadingSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.LoadingSuccess>(homeAction.HomeActionTypes.LOADING_SUCCESS),
      map((data) => ({
        type: homeAction.HomeActionTypes.LOADING_MAP,
      })),
    ),
  );

  loadingFail$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<homeAction.LoadingFail>(homeAction.HomeActionTypes.LOADING_FAIL),
        tap(async (action) => {
          this.loadingProvider.hide();
          this.alertProvider.showErrorAlert(
            "Unable to load data",
            "",
            "There was an issue trying to fetch the dashboard data, please try again.",
          );
        }),
      ),
    { dispatch: false },
  );

  showSetUnitStatusModal$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.ShowSetUnitStateModal>(homeAction.HomeActionTypes.SHOW_SETUNITSTATUSMODAL),
      mergeMap((action) =>
        this.dispatchProvider.getSetUnitStatusData(action.unitId).pipe(
          map((data) => ({
            type: homeAction.HomeActionTypes.OPEN_SETUNITSTATUSMODAL,
            payload: data.Data,
          })),
        ),
      ),
    ),
  );

  openSetUnitStatusModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<homeAction.OpenSetUnitStateModal>(homeAction.HomeActionTypes.OPEN_SETUNITSTATUSMODAL),
        exhaustMap((data) => this.runModal(SetUnitStatusModalComponent, "md")),
      ),
    { dispatch: false },
  );

  saveUnitState$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.SavingUnitState>(homeAction.HomeActionTypes.SAVE_UNITSTATE),
      mergeMap((action) =>
        this.unitStatusProvider
          .saveUnitStatus({
            Id: action.payload.unitId,
            Type: action.payload.stateType,
            RespondingTo: action.payload.destination,
            TimestampUtc: action.payload.date.toUTCString().replace("UTC", "GMT"),
            Timestamp: action.payload.date.toISOString(),
            Note: action.payload.note,
            Latitude: "",
            Longitude: "",
            Accuracy: "",
            Altitude: "",
            AltitudeAccuracy: "",
            Speed: "",
            Heading: "",
            EventId: "",
            Roles: [],
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
            catchError(() => of({ type: homeAction.HomeActionTypes.SAVE_UNITSTATE_FAIL })),
          ),
      ),
    ),
  );

  saveUnitStateFail$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<homeAction.SavingUnitStateFail>(homeAction.HomeActionTypes.SAVE_UNITSTATE_FAIL),
        tap(async (action) => {
          this.closeModal();
          this.alertProvider.showErrorAlert("Unit Status Error", "", "There was an issue trying to set the unit status, please try again.");
        }),
      ),
    { dispatch: false },
  );

  saveUnitStateSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.SavingUnitStateSuccess>(homeAction.HomeActionTypes.SAVE_UNITSTATE_SUCCESS),
      mergeMap((action) =>
        this.unitStatusProvider.getAllUnitStatuses().pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.UPDATE_UNITSTATES,
            payload: data.Data,
          })),
          tap((data) => {
            this.alertProvider.showAutoCloseSuccessAlert("Unit State has been saved.");
          }),
          // If request fails, dispatch failed action
          catchError(() => of({ type: homeAction.HomeActionTypes.SAVE_UNITSTATE_FAIL })),
        ),
      ),
    ),
  );

  getLastestUnitStates$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.SavingUnitStateSuccess>(homeAction.HomeActionTypes.GET_LATESTUNITSTATES),
      mergeMap((action) =>
        this.unitStatusProvider.getAllUnitStatuses().pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.UPDATE_UNITSTATES,
            payload: data.Data,
          })),
          // If request fails, dispatch failed action
          catchError(() => of({ type: homeAction.HomeActionTypes.GENERAL_FAILURE })),
        ),
      ),
    ),
  );

  saveCloseCall$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.SavingCloseCall>(homeAction.HomeActionTypes.SAVE_CLOSECALL),
      mergeMap((action) =>
        this.callsProvider.closeCall(action.payload.callId, action.payload.note, action.payload.stateType).pipe(
          tap((data) => {
            this.closeModal();
          }),
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.SAVE_CLOSECALL_SUCCESS,
          })),
          // If request fails, dispatch failed action
          catchError(() => of({ type: homeAction.HomeActionTypes.SAVE_CLOSECALL_FAIL })),
        ),
      ),
    ),
  );

  openCloseCallModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<homeAction.ShowCloseCallModal>(homeAction.HomeActionTypes.SHOW_CLOSECALLMODAL),
        exhaustMap((data) => this.runModal(CloseCallModalComponent, "md")),
      ),
    { dispatch: false },
  );

  saveCloseCallFail$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<homeAction.SavingCloseCallFail>(homeAction.HomeActionTypes.SAVE_CLOSECALL_FAIL),
        tap(async (action) => {
          this.closeModal();
          this.alertProvider.showErrorAlert("Close Call Error", "", "There was an issue trying to close the call, please try again.");
        }),
      ),
    { dispatch: false },
  );

  saveCloseCallSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.ShowCloseCallModal>(homeAction.HomeActionTypes.SAVE_CLOSECALL_SUCCESS),
      mergeMap((action) =>
        this.callsProvider.getActiveCalls().pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.UPDATE_CALLS,
            payload: data.Data,
          })),
          tap((data) => {
            this.alertProvider.showAutoCloseSuccessAlert("Call has been closed.");
          }),
          // If request fails, dispatch failed action
          catchError(() => of({ type: homeAction.HomeActionTypes.SAVE_CLOSECALL_FAIL })),
        ),
      ),
    ),
  );

  loadingMap$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.LoadingMap>(homeAction.HomeActionTypes.LOADING_MAP),
      mergeMap((action) =>
        this.mapProvider.getMapDataAndMarkers().pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.LOADING_MAP_SUCCESS,
            payload: data.Data,
          })),
          // If request fails, dispatch failed action
          catchError(() => of({ type: homeAction.HomeActionTypes.LOADING_MAP_FAIL })),
        ),
      ),
    ),
  );

  loadingMapSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<homeAction.LoadingMapSuccess>(homeAction.HomeActionTypes.LOADING_MAP_SUCCESS),
        tap((action) => {
          this.loadingProvider.hide();
        }),
      ),
    { dispatch: false },
  );

  loadingMapFail$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<homeAction.LoadingMapFail>(homeAction.HomeActionTypes.LOADING_MAP_FAIL),
        tap(async (action) => {
          this.loadingProvider.hide();
          this.alertProvider.showErrorAlert(
            "Unable to load map data",
            "",
            "There was an issue trying to fetch the map data, please try again.",
          );
        }),
      ),
    { dispatch: false },
  );

  showSelectCallTemplateModal$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.ShowSelectCallTemplateModal>(homeAction.HomeActionTypes.SHOW_SELECTCALLTEMPLATEMODAL),
      mergeMap((action) =>
        this.dispatchProvider.getCallTemplates().pipe(
          map((data) => ({
            type: homeAction.HomeActionTypes.OPEN_SELECTCALLTEMPLATEMODAL,
            payload: data.Data,
          })),
        ),
      ),
    ),
  );

  openSelectCallTemplateModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<homeAction.OpenSelectCallTemplateModal>(homeAction.HomeActionTypes.OPEN_SELECTCALLTEMPLATEMODAL),
        exhaustMap((data) => this.runModal(SelectTemplateModalComponent, "md")),
      ),
    { dispatch: false },
  );

  applyCallTemplateModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<homeAction.ApplyCallTemplate>(homeAction.HomeActionTypes.UPDATE_APPLYCALLTEMPLATE),
        tap(async (action) => {
          this.closeModal();
        }),
      ),
    { dispatch: false },
  );

  getCoordinatesForAddress$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.GetCoordinatesForAddress>(homeAction.HomeActionTypes.GET_COORDINATESFORADDRESS),
      mergeMap((action) =>
        //this.locationProvider.getCoordinatesForAddressFromGoogle(action.address).pipe(
        this.geocodingProvider.getLocationFromAddress(action.address).pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.GET_COORDINATESFORADDRESS_SUCCESS,
            payload: data,
          })),
          // If request fails, dispatch failed action
          catchError(() =>
            of({
              type: homeAction.HomeActionTypes.GET_COORDINATESFORADDRESS_FAIL,
            }),
          ),
        ),
      ),
    ),
  );

  getAddressForCoordinates$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.GetAddressForCoordinates>(homeAction.HomeActionTypes.GET_ADDRESSFORCOORDINATES),
      mergeMap((action) =>
        //this.locationProvider.getCoordinatesForAddressFromGoogle(action.address).pipe(
        this.geocodingProvider.getAddressFromLocation(new GpsLocation(parseInt(action.latitude), parseInt(action.longitude))).pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.GET_ADDRESSFORCOORDINATES_SUCCESS,
            address: data,
          })),
          // If request fails, dispatch failed action
          catchError(() =>
            of({
              type: homeAction.HomeActionTypes.GET_ADDRESSFORCOORDINATES_FAIL,
            }),
          ),
        ),
      ),
    ),
  );

  saveCall$ = createEffect(() =>
    this.actions$.pipe(
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
            action.call.FormData,
          )
          .pipe(
            // If successful, dispatch success action with result
            map((data) => ({
              type: homeAction.HomeActionTypes.SAVE_CALL_SUCCESS,
            })),
            // If request fails, dispatch failed action
            catchError(() => of({ type: homeAction.HomeActionTypes.SAVE_CALL_FAIL })),
          ),
      ),
    ),
  );

  saveCallFail$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<homeAction.SaveCallFail>(homeAction.HomeActionTypes.SAVE_CALL_FAIL),
        tap(async (action) => {
          this.closeModal();
          this.alertProvider.showErrorAlert("Call Save Error", "", "There was an issue trying to save the call, please try again.");
        }),
      ),
    { dispatch: false },
  );

  saveCallSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.SaveCallSuccess>(homeAction.HomeActionTypes.SAVE_CALL_SUCCESS),
      mergeMap((action) =>
        this.callsProvider.getActiveCalls().pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.UPDATE_CALLS,
            payload: data.Data,
          })),
          tap((data) => {
            this.alertProvider.showAutoCloseSuccessAlert("Call has been saved and dispatched.");
          }),
          // If request fails, dispatch failed action
          catchError(() => of({ type: homeAction.HomeActionTypes.SAVE_CALL_FAIL })),
        ),
      ),
    ),
  );

  getLatestPersonnelData$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.GetLatestPersonnelData>(homeAction.HomeActionTypes.GET_LATESTPERSONNELDATA),
      mergeMap((action) =>
        this.dispatchProvider.getPersonnelForCallGrid().pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.UPDATE_PERSONNELDATA,
            payload: data.Data,
          })),
          // If request fails, dispatch failed action
          catchError(() => of({ type: homeAction.HomeActionTypes.GENERAL_FAILURE })),
        ),
      ),
    ),
  );

  getLatestCalls$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.GetLatestCalls>(homeAction.HomeActionTypes.GET_LATESTCALLS),
      mergeMap((action) =>
        this.callsProvider.getActiveCalls().pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.UPDATE_CALLS,
            payload: data.Data,
          })),
          // If request fails, dispatch failed action
          catchError(() => of({ type: homeAction.HomeActionTypes.GENERAL_FAILURE })),
        ),
      ),
    ),
  );

  showCallNotesModal$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.ShowCallNotesModal>(homeAction.HomeActionTypes.SHOW_CALLNOTESMODAL),
      mergeMap((action) =>
        this.callNotesProvider.getCallNotes(action.callId).pipe(
          map((data) => ({
            type: homeAction.HomeActionTypes.OPEN_CALLNOTESMODAL,
            payload: data.Data,
          })),
        ),
      ),
    ),
  );

  openCallNotesModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<homeAction.OpenCallNotesModal>(homeAction.HomeActionTypes.OPEN_CALLNOTESMODAL),
        exhaustMap((data) => this.runModal(CallNotesModalComponent, "lg")),
      ),
    { dispatch: false },
  );

  saveCallNote$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.SaveCallNote>(homeAction.HomeActionTypes.SAVE_CALLNOTE),
      mergeMap((action) =>
        this.callNotesProvider.saveCallNote(action.callId, action.userId, action.callNote, null).pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.SAVE_CALLNOTE_SUCCESS,
          })),
          tap((data) => {
            this.closeModal();
          }),
          // If request fails, dispatch failed action
          catchError(() => of({ type: homeAction.HomeActionTypes.SAVE_CALLNOTE_FAIL })),
        ),
      ),
    ),
  );

  showCallImagesModal$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.ShowCallImagesModal>(homeAction.HomeActionTypes.SHOW_CALLIMAGESMODAL),
      mergeMap((action) =>
        this.callFilesProvider.getCallImages(action.callId, true).pipe(
          map((data) => ({
            type: homeAction.HomeActionTypes.OPEN_CALLIMAGESMODAL,
            payload: data.Data,
          })),
        ),
      ),
    ),
  );

  openCallImagesModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<homeAction.OpenCallImagesModal>(homeAction.HomeActionTypes.OPEN_CALLIMAGESMODAL),
        exhaustMap((data) => this.runModal(CallImagesModalComponent, "xl")),
      ),
    { dispatch: false },
  );

  uploadCallImage$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.UploadCallImage>(homeAction.HomeActionTypes.UPLOAD_CALLIMAGE),
      mergeMap((action) =>
        this.callFilesProvider.saveCallImage(action.callId, action.userId, "", action.name, null, action.image).pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.UPLOAD_CALLIMAGE_SUCCESS,
          })),
          tap((data) => {
            this.closeModal();
          }),
          // If request fails, dispatch failed action
          catchError(() => of({ type: homeAction.HomeActionTypes.UPLOAD_CALLIMAGE_FAIL })),
        ),
      ),
    ),
  );

  showCallFilesModal$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.ShowCallFilesModal>(homeAction.HomeActionTypes.SHOW_CALLFILESMODAL),
      mergeMap((action) =>
        this.callFilesProvider.getCallFiles(action.callId, false).pipe(
          map((data) => ({
            type: homeAction.HomeActionTypes.OPEN_CALLFILESMODAL,
            payload: data.Data,
          })),
        ),
      ),
    ),
  );

  openCallFilesModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<homeAction.OpenCallFilesModal>(homeAction.HomeActionTypes.OPEN_CALLFILESMODAL),
        exhaustMap((data) => this.runModal(CallFilesModalComponent, "lg")),
      ),
    { dispatch: false },
  );

  uploadCallFile$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.UploadCallFile>(homeAction.HomeActionTypes.UPLOAD_CALLFILE),
      mergeMap((action) =>
        this.callFilesProvider.saveCallFile(action.callId, action.userId, "", action.name, null, action.image).pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.UPLOAD_CALLFILE_SUCCESS,
          })),
          tap((data) => {
            this.closeModal();
          }),
          // If request fails, dispatch failed action
          catchError(() => of({ type: homeAction.HomeActionTypes.UPLOAD_CALLFILE_FAIL })),
        ),
      ),
    ),
  );

  getUpdatedPersonnelandUnitsDistancesToCall$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.GetUpdatedPersonnelandUnitsDistancesToCall>(homeAction.HomeActionTypes.GET_UPDATEDPERSONANDUNITS_DISTANCE),
      map((action) => {
        var personnel = _.cloneDeep(action.personnel);
        var units = _.cloneDeep(action.units);

        if (!action.callLocation) {
          personnel.forEach((person) => {
            person.Distance = 0;
          });

          action.units.forEach((unit) => {
            unit.Distance = 0;
          });
        } else {
          personnel.forEach((person) => {
            if (person.Location) {
              const locationParts = person.Location.split(",");
              const distance = this.locationProvider.getDistanceBetweenTwoPoints(
                action.callLocation,
                new GpsLocation(Number(locationParts[0]), Number(locationParts[1])),
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
                new GpsLocation(Number(unit.Latitude), Number(unit.Longitude)),
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
          personnel: personnel,
          units: units,
        };
      }),
    ),
  );

  openCallFormModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<homeAction.OpenCallFormModal>(homeAction.HomeActionTypes.OPEN_CALLFORMMODAL),
        exhaustMap((data) => this.runModal(CallFormModalComponent, "xl")),
      ),
    { dispatch: false },
  );

  setCallFormData$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<homeAction.SetNewCallFormData>(homeAction.HomeActionTypes.SET_NEWCALLFORMDATA),
        tap((data) => this.closeModal()),
      ),
    { dispatch: false },
  );

  showSetPersonStatusModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<homeAction.OpenSetPersonStatusModal>(homeAction.HomeActionTypes.OPEN_SETPERSONSTATUSMODAL),
        exhaustMap((data) => this.runModal(SetPersonStatusModalComponent, "md")),
      ),
    { dispatch: false },
  );

  savePersonnelStatus$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.SavingPersonStatuses>(homeAction.HomeActionTypes.SAVE_PERSONSTATUSES),
      mergeMap((action) =>
        this.personnelStatusesProvider
          .savePersonsStatuses({
            UserIds: action.payload.userIds,
            Type: action.payload.stateType,
            RespondingTo: action.payload.destination,
            TimestampUtc: action.payload.date.toUTCString().replace("UTC", "GMT"),
            Timestamp: action.payload.date.toISOString(),
            Note: action.payload.note,
            Latitude: "",
            Longitude: "",
            Accuracy: "",
            Altitude: "",
            AltitudeAccuracy: "",
            Speed: "",
            Heading: "",
            EventId: "",
          })
          .pipe(
            // If successful, dispatch success action with result
            map((data) => ({
              type: homeAction.HomeActionTypes.SAVE_PERSONSTATUSES_SUCCESS,
            })),
            tap((data) => {
              this.closeModal();
            }),
            // If request fails, dispatch failed action
            catchError(() => of({ type: homeAction.HomeActionTypes.SAVE_PERSONSTATUSES_FAIL })),
          ),
      ),
    ),
  );

  savePersonnelStatusFail$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<homeAction.SavingPersonStatusesFail>(homeAction.HomeActionTypes.SAVE_PERSONSTATUSES_FAIL),
        tap(async (action) => {
          this.closeModal();
          this.alertProvider.showErrorAlert(
            "Personnel Status Error",
            "",
            "There was an issue trying to set the personnel statuses, please try again.",
          );
        }),
      ),
    { dispatch: false },
  );

  savePersonnelStatusSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.SavingPersonStatusesSuccess>(homeAction.HomeActionTypes.SAVE_PERSONSTATUSES_SUCCESS),
      mergeMap((action) =>
        this.dispatchProvider.getPersonnelForCallGrid().pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.UPDATE_PERSONSTATUSES,
            payload: data.Data,
          })),
          tap((data) => {
            this.alertProvider.showAutoCloseSuccessAlert("Personnel Status have been updated.");
          }),
          // If request fails, dispatch failed action
          catchError(() => of({ type: homeAction.HomeActionTypes.SAVE_PERSONSTATUSES_FAIL })),
        ),
      ),
    ),
  );

  showSetPersonStaffingModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<homeAction.OpenSetPersonStaffingModal>(homeAction.HomeActionTypes.OPEN_SETPERSONSTAFFINGMODAL),
        exhaustMap((data) => this.runModal(SetPersonStaffingModalComponent, "md")),
      ),
    { dispatch: false },
  );

  savePersonnelStaffing$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.SavingPersonStaffing>(homeAction.HomeActionTypes.SAVE_PERSONSTAFFING),
      mergeMap((action) =>
        this.personnelStaffingProvider
          .savePersonsStaffings({
            UserIds: action.payload.userIds,
            Type: action.payload.staffingType,
            TimestampUtc: action.payload.date.toUTCString().replace("UTC", "GMT"),
            Timestamp: action.payload.date.toISOString(),
            Note: action.payload.note,
            EventId: "",
          })
          .pipe(
            // If successful, dispatch success action with result
            map((data) => ({
              type: homeAction.HomeActionTypes.SAVE_PERSONSTAFFING_SUCCESS,
            })),
            tap((data) => {
              this.closeModal();
            }),
            // If request fails, dispatch failed action
            catchError(() => of({ type: homeAction.HomeActionTypes.SAVE_PERSONSTAFFING_FAIL })),
          ),
      ),
    ),
  );

  savePersonnelStaffingSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.SavingPersonStaffingSuccess>(homeAction.HomeActionTypes.SAVE_PERSONSTAFFING_SUCCESS),
      mergeMap((action) =>
        this.dispatchProvider.getPersonnelForCallGrid().pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: homeAction.HomeActionTypes.UPDATE_PERSONSTAFFING,
            payload: data.Data,
          })),
          tap((data) => {
            this.alertProvider.showAutoCloseSuccessAlert("Personnel Staffings have been updated.");
          }),
          // If request fails, dispatch failed action
          catchError(() => of({ type: homeAction.HomeActionTypes.SAVE_PERSONSTAFFING_FAIL })),
        ),
      ),
    ),
  );

  showViewCallFormModal$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.ShowViewCallForm>(homeAction.HomeActionTypes.SHOW_VIEW_CALL_FORM),
      mergeMap((action) =>
        this.callsProvider.getCallExtraData(action.callId).pipe(
          map((data) => ({
            type: homeAction.HomeActionTypes.OPEN_VIEW_CALL_FORM,
            payload: data.Data,
          })),
        ),
      ),
    ),
  );

  openViewCallFormModal$ = createEffect(() =>
    this.actions$.pipe(
      ofType<homeAction.OpenCallFormModal>(homeAction.HomeActionTypes.OPEN_VIEW_CALL_FORM),
      exhaustMap((data) => this.runModal(ViewCallFormModalComponent, "md")),
      map((data) => ({
        type: homeAction.HomeActionTypes.DONE,
      })),
    ),
  );

  saveCallFormInvalid$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(homeAction.HomeActionTypes.SAVE_CALL_FORM_INVALID),
        switchMap((action) => this.loadingProvider.hide()),
        tap((action) => this.alertProvider.showErrorAlert("Missing Fields", "", "There are fields missing to submit this call.")),
      ),
    { dispatch: false },
  );

  done$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(homeAction.HomeActionTypes.DONE),
        tap((action) => {}),
      ),
    { dispatch: false },
  );

  constructor(
    private actions$: Actions,
    private store: Store<HomeState>,
    private homeProvider: HomeProvider,
    private modalService: NgbModal,
    private dispatchProvider: DispatchService,
    private unitStatusProvider: UnitStatusService,
    private alertProvider: AlertProvider,
    private unitsProvider: UnitsService,
    private callsProvider: CallsService,
    private callNotesProvider: CallNotesService,
    private callFilesProvider: CallFilesService,
    private mapProvider: MappingService,
    private locationProvider: LocationService,
    private voiceProvider: VoiceService,
    private loadingProvider: LoadingProvider,
    private personnelStatusesProvider: PersonnelStatusesService,
    private personnelStaffingProvider: PersonnelStaffingService,
    private geocodingProvider: GeocodingProvider,
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

    return this._modalRef.result;
  };

  closeModal = () => {
    if (this._modalRef) {
      this._modalRef.close();
      this._modalRef = null;
    }
  };
}
