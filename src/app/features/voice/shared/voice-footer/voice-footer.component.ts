import { ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { Store } from "@ngrx/store";
import { DepartmentVoiceChannelResultData } from '@resgrid/ngx-resgridlib';
import { Observable, Subscription } from "rxjs";
import { VoiceState } from "src/app/features/voice/store/voice.store";
import { AudioProvider } from "src/app/providers/audio";
import { OpenViduService } from "src/app/providers/openvidu";
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

  private participants: number = 0;
  private voiceSubscription: Subscription;
  private availableChannelsSubscription: Subscription;

  constructor(private store: Store<VoiceState>, private audioProvider: AudioProvider, 
    public openViduService: OpenViduService, private ref: ChangeDetectorRef) {
    this.voiceState$ = this.store.select(selectVoiceState);
    this.availableChannels$ = this.store.select(selectAvailableChannelsState);
  }

  ngOnInit(): void {
    this.availableChannelsSubscription = this.availableChannels$.subscribe((channels) => {
      if (channels) {
        this.selectedChannel = channels[0];
      }
    });

    this.voiceSubscription = this.voiceState$.subscribe((state) => {
      if (state) {
        if (state.currentActiveVoipChannel) {
          this.selectedChannel = state.currentActiveVoipChannel;
        } else if (state.channels) {
          this.selectedChannel = state.channels[0];
        }

        this.isTransmitting = state.isTransmitting;

        if (this.participants !== state.participants) {
          this.ref.detectChanges();
          this.participants = state.participants;
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.voiceSubscription) {
      this.voiceSubscription.unsubscribe();
      this.voiceSubscription = null;
    }

    if (this.availableChannelsSubscription) {
      this.availableChannelsSubscription.unsubscribe();
      this.availableChannelsSubscription = null;
    }
  }

  public toggleTransmitting() {
    if (this.isTransmitting) {
      this.stopTransmitting();
    } else {
      this.startTransmitting();
    }
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
