import { Injectable } from '@angular/core';
import {
  OpenVidu,
  Publisher,
  Session,
  StreamEvent,
  StreamManager,
  Subscriber,
} from 'openvidu-browser';
import {
  DepartmentVoiceChannelResultData,
  VoiceService,
} from '@resgrid-shared/ngx-resgridlib';
import { VoiceState } from '../features/voice/store/voice.store';
import { Store } from '@ngrx/store';
import * as VoiceActions from '../features/voice/actions/voice.actions';

@Injectable({
  providedIn: 'root',
})
export class OpenViduService {
  // OpenVidu objects
  OV: OpenVidu;
  session: Session;
  //publisher: StreamManager; // Local
  publisher: Publisher; // Local
  public subscribers: StreamManager[] = []; // Remotes

  constructor(
    private store: Store<VoiceState>,
    private voiceService: VoiceService
  ) {}

  public async hide() {}

  public joinChannel(channel: DepartmentVoiceChannelResultData, name: string) {
    this.OV = new OpenVidu();
    this.session = this.OV.initSession();

    // On every new Stream received...
    this.session.on('streamCreated', (event: StreamEvent) => {
      // Subscribe to the Stream to receive it. Second parameter is undefined
      // so OpenVidu doesn't create an HTML video on its own
      const subscriber: Subscriber = this.session.subscribe(
        event.stream,
        undefined
      );
      this.subscribers.push(subscriber);

      //this.store.dispatch(new VoiceActions.AddOpenViduStream(subscriber));
    });

    // On every Stream destroyed...
    this.session.on('streamDestroyed', (event: StreamEvent) => {
      // Remove the stream from 'subscribers' array
      this.deleteSubscriber(event.stream.streamManager);
    });

    // On every asynchronous exception...
    this.session.on('exception', (exception) => {
      console.warn(exception);
    });

    this.voiceService.connectToSession(channel.Id).subscribe((data) => {
      if (data && data.Data && data.Status === 'success') {
        this.session
          .connect(data.Data.Token, { clientData: name })
          .then(() => {
            this.initPublisher();
          })
          .catch((error) => {
            console.log(
              'There was an error connecting to the session:',
              error.code,
              error.message
            );
          });
      }
    });
  }

  private initPublisher() {
    // Init a publisher passing undefined as targetElement (we don't want OpenVidu to insert a video
    // element: we will manage it on our own) and with the desired properties
    const publisher: Publisher = this.OV.initPublisher(undefined, {
      audioSource: undefined, // The source of audio. If undefined default microphone
      videoSource: false, // The source of video. If undefined default webcam
      publishAudio: false, // Whether you want to start publishing with your audio unmuted or not
      publishVideo: false, // Whether you want to start publishing with your video enabled or not
      resolution: '640x480', // The resolution of your video
      frameRate: 30, // The frame rate of your video
      insertMode: 'APPEND', // How the video is inserted in the target element 'video-container'
      mirror: true, // Whether to mirror your local video or not
    });

    // --- 6) Publish your stream ---

    this.session.publish(publisher).then(() => {
      // Store our Publisher
      this.publisher = publisher;
      this.store.dispatch(new VoiceActions.SetCurrentVoiceState('Connected'));
    });
  }

  public leaveSession() {
    // --- 7) Leave the session by calling 'disconnect' method over the Session object ---

    if (this.session) {
      this.session.disconnect();
    }

    // Empty all properties...
    this.subscribers = [];
    delete this.publisher;
    delete this.session;
    delete this.OV;
    //this.generateParticipantInfo();

    this.store.dispatch(new VoiceActions.SetCurrentVoiceState('Disconnected'));
  }

  public mute() {
    if (this.publisher) {
      this.publisher.publishAudio(false);
    }
  }

  public unmute() {
    if (this.publisher) {
      this.publisher.publishAudio(true);
    }
  }

  private deleteSubscriber(streamManager: StreamManager): void {
    const index = this.subscribers.indexOf(streamManager, 0);
    if (index > -1) {
      this.subscribers.splice(index, 1);
    }

    //this.store.dispatch(new VoiceActions.RemoveOpenViduStream(streamManager));
  }
}
