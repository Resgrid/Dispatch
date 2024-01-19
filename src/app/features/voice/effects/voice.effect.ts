import * as voiceAction from "../actions/voice.actions";
import { Action, Store } from "@ngrx/store";
import { Actions, createEffect, ofType, concatLatestFrom } from "@ngrx/effects";
import { catchError, concatMap, exhaustMap, map, mergeMap, tap } from "rxjs/operators";
import { Injectable } from "@angular/core";
import { from, Observable, of } from "rxjs";
import { NgbModal, NgbModalRef } from "@ng-bootstrap/ng-bootstrap";
import { VoiceState } from "../store/voice.store";
import { KazooVoiceService, VoiceService } from "@resgrid/ngx-resgridlib";
import { OpenViduService } from "src/app/providers/openvidu";
import { HomeState } from "../../home/store/home.store";
import { selectAuthState } from "src/app/store";
import { AuthState } from "../../auth/store/auth.store";
import { AudioProvider } from "src/app/providers/audio";

@Injectable()
export class VoiceEffects {
  getVoipInfo$ = createEffect(() =>
    this.actions$.pipe(
      ofType<voiceAction.GetVoipInfo>(voiceAction.VoiceActionTypes.GET_VOIPINFO),
      mergeMap((action) =>
        this.voiceService.getDepartmentVoiceSettings().pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: voiceAction.VoiceActionTypes.GET_VOIPINFO_SUCCESS,
            payload: data.Data,
          })),
          tap((data) => {}),
          // If request fails, dispatch failed action
          catchError(() => of({ type: voiceAction.VoiceActionTypes.GET_VOIPINFO_FAIL }))
        )
      )
    )
  );

  getVoipInfoSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType<voiceAction.GetVoipInfoSuccess>(voiceAction.VoiceActionTypes.GET_VOIPINFO_SUCCESS),
      map((data) => ({
        type: voiceAction.VoiceActionTypes.START_VOIP_SERVICES,
        payload: data.payload,
      }))
    )
  );

  startVoipServices$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<voiceAction.StartVoipServices>(voiceAction.VoiceActionTypes.START_VOIP_SERVICES),
        tap((action) => {
          //this.voiceProvider.startVoipServices(action.payload);
        })
      ),
    { dispatch: false }
  );

  setNoChannel$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<voiceAction.SetNoChannel>(voiceAction.VoiceActionTypes.SET_NOCHANNEL),
        tap((data) => {
          //this.voiceProvider.disconnect();
          this.openViduService.leaveSession();
        })
      ),
    { dispatch: false }
  );

  setActiveChannel$ = createEffect(() =>
    this.actions$.pipe(
      ofType<voiceAction.SetActiveChannel>(voiceAction.VoiceActionTypes.SET_ACTIVECHANNEL),
      concatLatestFrom(() => [this.authStore.select(selectAuthState)]),
      exhaustMap(([action, authState], index) =>
        of(action).pipe(
          concatMap((data) => {
            if (data && data.channel) {
              if (data.channel.Id === "") {
                this.openViduService.leaveSession();
                return of(data);
              } else {
                return this.openViduService.joinChannel(data.channel, authState.user.fullName + "(Dispatch)");
              }
            }
          }),
          map((data) => ({
            type: voiceAction.VoiceActionTypes.DONE,
          }))
        )
      )
    )
  );

  voipCallStartTransmitting$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<voiceAction.StartTransmitting>(voiceAction.VoiceActionTypes.START_TRANSMITTING),
        tap((data) => {
          //this.voiceProvider.unmute();
          this.openViduService.unmute();
        })
      ),
    { dispatch: false }
  );

  voipCallStopTransmitting$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<voiceAction.StopTransmitting>(voiceAction.VoiceActionTypes.STOP_TRANSMITTING),
        tap((data) => {
          //this.voiceProvider.mute();
          this.openViduService.mute();
        })
      ),
    { dispatch: false }
  );

  addOpenViduStream$ = createEffect(() =>
    this.actions$.pipe(
      ofType<voiceAction.AddOpenViduStream>(voiceAction.VoiceActionTypes.ADD_OPENVIDU_STREAM),
      map((data) => ({
        type: voiceAction.VoiceActionTypes.DONE,
      }))
    )
  );

  removeOpenViduStream$ = createEffect(() =>
    this.actions$.pipe(
      ofType<voiceAction.RemoveOpenViduStream>(voiceAction.VoiceActionTypes.REMOVE_OPENVIDU_STREAM),
      map((data) => ({
        type: voiceAction.VoiceActionTypes.DONE,
      }))
    )
  );

  done$ = createEffect(() => this.actions$.pipe(ofType<voiceAction.Done>(voiceAction.VoiceActionTypes.DONE)), { dispatch: false });

  constructor(
    private actions$: Actions,
    private store: Store<VoiceState>,
    //private voiceProvider: KazooVoiceService,
    private voiceService: VoiceService,
    private openViduService: OpenViduService,
    private homeStore: Store<HomeState>,
    private authStore: Store<AuthState>
  ) {}
}
