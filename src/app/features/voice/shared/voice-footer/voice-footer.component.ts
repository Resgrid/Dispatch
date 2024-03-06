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
  }

  ngOnInit(): void {

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
}
