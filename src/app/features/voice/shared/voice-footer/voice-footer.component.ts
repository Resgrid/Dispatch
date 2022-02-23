import { Component, OnInit } from "@angular/core";
import { Store } from "@ngrx/store";
import { DepartmentVoiceChannelResultData } from '@resgrid/ngx-resgridlib';
import { Observable } from "rxjs";
import { VoiceState } from "src/app/features/voice/store/voice.store";
import { AudioProvider } from "src/app/providers/audio";
import { selectAvailableChannelsState, selectVoiceState } from "src/app/store";
import * as VoiceActions from "../../actions/voice.actions";

@Component({
  selector: "app-voice-footer",
  templateUrl: "./voice-footer.component.html",
  styleUrls: ["./voice-footer.component.scss"],
})
export class VoiceFooterComponent implements OnInit {
  public selectedChannel: DepartmentVoiceChannelResultData;
  public isTransmitting: boolean = false;
  public voiceState$: Observable<VoiceState | null>;
  public availableChannels$: Observable<DepartmentVoiceChannelResultData[] | null>;

  constructor(private store: Store<VoiceState>, private audioProvider: AudioProvider) {
    this.voiceState$ = this.store.select(selectVoiceState);
    this.availableChannels$ = this.store.select(selectAvailableChannelsState);

    this.availableChannels$.subscribe((channels) => {
      if (channels) {
        this.selectedChannel = channels[0];
      }
    });
  }

  ngOnInit(): void {
  }

  public startTransmitting(): void {
    this.audioProvider.playTransmitStart();
    this.store.dispatch(new VoiceActions.StartTransmitting());
  }

  public stopTransmitting(): void {
    this.store.dispatch(new VoiceActions.StopTransmitting());
    this.audioProvider.playTransmitEnd();
  }

  public stopTransmittingLeave(): void {
    this.store.dispatch(new VoiceActions.StopTransmitting());
  }

  public onChannelChange(channel) {
    if (channel.Id === '') {
      this.store.dispatch(new VoiceActions.SetNoChannel());
    } else {
      this.store.dispatch(new VoiceActions.SetActiveChannel(channel));
    }
  }
}
