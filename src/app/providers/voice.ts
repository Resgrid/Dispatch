import { Injectable, Inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { environment } from "../../environments/environment";
import { from, Observable, of } from "rxjs";
import { FormDataResult } from "../core/models/formDataResult";
import { DepartmentVoiceResult } from "../core/models/departmentVoiceResult";
import { THIS_EXPR } from "@angular/compiler/src/output/output_ast";
import { WindowRef } from "./window";
import { concatMap, delay } from "rxjs/operators";
//const JsSIP = require("jssip");

@Injectable({
  providedIn: "root",
})
export class VoiceProvider {
  private _userAgent: any;
  private _currentCall: any;
  private _pin: string;

  constructor(public http: HttpClient, private winRef: WindowRef) { }

  public getVoiceSettings(): Observable<DepartmentVoiceResult> {
    return this.http.get<DepartmentVoiceResult>(
      environment.baseApiUrl +
      environment.resgridApiUrl +
      "/Voice/GetDepartmentVoiceSettings"
    );
  }

  public startVoipServices(voice: DepartmentVoiceResult) {
    if (voice && voice.UserInfo) {
      var config = {
        dialpad: {
          //renderTargets: ["dialpad"],
        },
        callList: {
          //renderTargets: ["call_list"],
        },
        callControl: {
          //renderTargets: ["call_control"],
        },
        mediaDevices: {
          //renderTargets: ["media_devices"],
          videoinput: {
            enabled: false,
          },
        },
        audioContext: {
          //renderTargets: ["audio_context"],
        },
        userAgent: {
          renderTargets: [],
          transport: {
            sockets: ["wss://" + voice.VoipServerWebsocketSslAddress],
            recovery_max_interval: 30,
            recovery_min_interval: 2,
          },
          authentication: {
            username: voice.UserInfo.Username,
            password: voice.UserInfo.Password,
            realm: voice.Realm,
          },
          user_agent: {
            //contact_uri: '',
            display_name: voice.CallerIdName + "(Dispatch)",
            //instance_id: "",
            // no_answer_timeout: 60,
            register: true,
            register_expires: 300,
            user_agent: "libwebphone - dispatch app",
          },
        },
      }; //End ofConfig

      this._userAgent = new this.winRef.nativeWindow.libwebphone(config);
      this._userAgent.on("connected", (event) => {
        var test = event;
      });
      this._userAgent.on("disconnected", (event) => {
        var test = event;
      });
      this._userAgent.on("registered", (event) => {
        var test = event;
      });
      this._userAgent.on("unregistered", (event) => {
        var test = event;
      });
      this._userAgent.on("registrationFailed", (event) => {
        var test = event;
      });
      this._userAgent.on("registrationExpiring", (event) => {
        var test = event;
      });
      this._userAgent.on("newRTCSession", (event) => {
        var test = event;
      });
      this._userAgent.on("newMessage", (event) => {
        var test = event;
      });
      this._userAgent.on("sipEvent", (event) => {
        var test = event;
      });
      this._userAgent.on("call.primary.established", (event) => {
        this.mute();
        this.processPin();
      });
      this._userAgent.on("userAgent.call.failed", (event) => {
        var test = event;
      });
      this._userAgent.getUserAgent().start();
      this._pin = voice.UserInfo.Pin;
    }
  }

  public joinChannel(channel: string) {
    if (this._userAgent) {
      this._userAgent.getUserAgent().call(channel);
    }
  }

  public disconnect() {
    if (this._userAgent) {
      this._userAgent.getUserAgent().hangupAll();
    }
  }

  public mute() {
    if (this._userAgent) {
      this._userAgent.getCallControl().mute();
    }
  }

  public unmute() {
    if (this._userAgent) {
      this._userAgent.getCallControl().unmute();
    }
  }

  private processPin() {
    if (this._userAgent) {
      const ac = this._userAgent.getAudioContext();
      var orgVolume = ac.getVolume("tones");
      ac.changeVolume("tones", 0);
      //ac.togglePreviewTone();

      var numbers = this._pin.split("");
      from(numbers)
        .pipe(concatMap((item) => of(item).pipe(delay(500))))
        .subscribe((number) => {
          this._userAgent.getDialpad().dial(number);
        });

      ac.changeVolume("tones", orgVolume);
    }
  }
}
