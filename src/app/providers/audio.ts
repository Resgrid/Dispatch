import { Injectable } from "@angular/core";
import { Howl, Howler } from "howler";

@Injectable({
  providedIn: "root",
})
export class AudioProvider {
  constructor() {}

  public playTransmitStart() {
    var sound = new Howl({
      src: ["assets/audio/ui/Space_Notification1.ogg"],
      autoplay: true,
      loop: false,
      volume: 1.0,
    });
  }

  public playTransmitEnd() {
    var sound = new Howl({
      src: ["assets/audio/ui/Space_Notification2.ogg"],
      autoplay: true,
      loop: false,
      volume: 1.0,
    });
  }
}
