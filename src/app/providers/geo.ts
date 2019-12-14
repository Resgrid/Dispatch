import { Injectable, NgZone } from '@angular/core';
import { Geolocation, Geoposition } from '@ionic-native/geolocation';
import { Location } from '../models/location';

@Injectable({
  providedIn: 'root'
})
export class GeoProvider {
  private watch: any;
  private latitude: number = 0;
  private longitude: number = 0;

  constructor(public zone: NgZone, private geolocation: Geolocation) {

  }

  public getLocationAsString(): string {
    if (this.latitude !== 0 && this.longitude !== 0) {
      return this.latitude + ',' + this.longitude;
    }

    return null;
  }

  public getLocation(): Location {
    if (this.latitude && this.latitude !== 0 && this.longitude && this.longitude !== 0) {
      return new Location(this.latitude, this.longitude);
    }

    return null;
  }

  public IsLocationEnabled(): boolean {
    if (!this.watch || !this.latitude || this.latitude === 0 || !this.longitude || this.longitude === 0) {
      return false;
    }

    return true;
  }

  startTracking() {
    const config = {
      desiredAccuracy: 0,
      stationaryRadius: 20,
      distanceFilter: 10,
      debug: true,
      interval: 2000
    };

    /*
    this.backgroundGeolocation.configure(config).subscribe((location) => {
      // Run update inside of Angular's zone
      this.zone.run(() => {
        this.latitude = location.latitude;
        this.longitude = location.longitude;
        //this.location = location;
      });
    }, (err) => {

    });

    // Turn ON the background-geolocation system.
    this.backgroundGeolocation.start();
*/
    const options = {
      frequency: 3000,
      enableHighAccuracy: true
    };

    this.watch = this.geolocation.watchPosition(options).subscribe((position: Geoposition) => {
      // Run update inside of Angular's zone
      this.zone.run(() => {
        if (position && position.coords) {
          this.latitude = position.coords.latitude;
          this.longitude = position.coords.longitude;
        }
        // this.location = position
      });
    });
  }

  stopTracking() {
    // this.backgroundGeolocation.finish();
    if (this.watch) {
      this.watch.unsubscribe();
    }
  }
}
