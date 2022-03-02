import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  ViewChild,
  OnDestroy,
} from "@angular/core";
import { StreamManager, StreamPropertyChangedEvent } from "openvidu-browser";

@Component({
  selector: "ov-video",
  template: `
    <video #videoElement style="width: 1px; height: 1px;">
      [attr.id]="_streamManager && _streamManager.stream ? 'video-' +
      _streamManager.stream.streamId : 'video-undefined'">
    </video>
  `,
})
export class OpenViduVideoComponent implements AfterViewInit {
  @ViewChild("videoElement") elementRef: ElementRef;
  public _streamManager: StreamManager;

  rotationFunction;

  constructor() {}

  ngAfterViewInit() {
    this.updateVideoView();
  }

  @Input()
  set streamManager(streamManager: StreamManager) {
    this._streamManager = streamManager;
  }

  private updateVideoView() {
    const that = this;
    setTimeout(function () {
      if (
        that._streamManager &&
        that.elementRef &&
        that.elementRef.nativeElement
      ) {
        that._streamManager.addVideoElement(that.elementRef.nativeElement);
        that.elementRef.nativeElement.volume = 1;
      }
    }, 100);
  }
}
