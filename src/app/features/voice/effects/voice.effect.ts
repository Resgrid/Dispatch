import * as voiceAction from "../actions/voice.actions";
import { Action, Store } from "@ngrx/store";
import { Actions, Effect, ofType } from "@ngrx/effects";
import { catchError, exhaustMap, map, mergeMap, tap } from "rxjs/operators";
import { Injectable } from "@angular/core";
import { from, Observable, of } from "rxjs";
import { NgbModal, NgbModalRef } from "@ng-bootstrap/ng-bootstrap";
import { VoiceState } from "../store/voice.store";
import { VoiceProvider } from "src/app/providers/voice";

@Injectable()
export class VoiceEffects {
  private _modalRef: NgbModalRef;

  @Effect()
  getVoipInfo$: Observable<Action> = this.actions$.pipe(
    ofType<voiceAction.GetVoipInfo>(voiceAction.VoiceActionTypes.GET_VOIPINFO),
    mergeMap((action) =>
      this.voiceProvider.getVoiceSettings().pipe(
        // If successful, dispatch success action with result
        map((data) => ({
          type: voiceAction.VoiceActionTypes.GET_VOIPINFO_SUCCESS,
          payload: data,
        })),
        tap((data) => {}),
        // If request fails, dispatch failed action
        catchError(() =>
          of({ type: voiceAction.VoiceActionTypes.GET_VOIPINFO_FAIL })
        )
      )
    )
  );

  @Effect({ dispatch: false })
  startVoipServices$: Observable<Action> = this.actions$.pipe(
    ofType<voiceAction.GetVoipInfoSuccess>(
      voiceAction.VoiceActionTypes.GET_VOIPINFO_SUCCESS
    ),
    mergeMap((action) =>
      of(action).pipe(
        tap((data) => {
          this.voiceProvider.startVoipServices(data.payload);
        })
      )
    )
  );

  @Effect({ dispatch: false })
  setNoChannel$: Observable<Action> = this.actions$.pipe(
    ofType<voiceAction.SetNoChannel>(
      voiceAction.VoiceActionTypes.SET_NOCHANNEL
    ),
    tap((data) => {
      this.voiceProvider.disconnect();
    })
  );

  @Effect({ dispatch: false })
  setActiveChannel$: Observable<Action> = this.actions$.pipe(
    ofType<voiceAction.SetActiveChannel>(
      voiceAction.VoiceActionTypes.SET_ACTIVECHANNEL
    ),
    mergeMap((action) =>
      of(action).pipe(
        tap((data) => {
          this.voiceProvider.joinChannel(data.channel.ConferenceNumber.toString());
        })
      )
    )
  );

  @Effect({ dispatch: false })
  voipCallStartTransmitting$: Observable<Action> = this.actions$.pipe(
    ofType<voiceAction.StartTransmitting>(
      voiceAction.VoiceActionTypes.START_TRANSMITTING
    ),
    tap((data) => {
      this.voiceProvider.unmute();
    })
  );

  @Effect({ dispatch: false })
  voipCallStopTransmitting$: Observable<Action> = this.actions$.pipe(
    ofType<voiceAction.StopTransmitting>(
      voiceAction.VoiceActionTypes.STOP_TRANSMITTING
    ),
    tap((data) => {
      this.voiceProvider.mute();
    })
  );

  constructor(
    private actions$: Actions,
    private store: Store<VoiceState>,
    private modalService: NgbModal,
    private voiceProvider: VoiceProvider
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
