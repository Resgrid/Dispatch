import { Injectable, Inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";

import { SettingsProvider } from "./settings";

import { PersonnelChatResult } from "../core/models/personnelChatResult";
import { ResponderChatResult } from "../core/models/responderChatResult";
import { Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { AgmGeocoder } from "@agm/core";
import { GpsLocation } from "../core/models/gpsLocation";
import { Coordinate } from "tsgeo/Coordinate";
import { Vincenty } from "tsgeo/Distance/Vincenty";

@Injectable({
  providedIn: "root",
})
export class LocationProvider {
  constructor(private geocoder: AgmGeocoder) {}

  public getCoordinatesForAddressFromGoogle(address): Observable<GpsLocation> {
    return this.geocoder.geocode({ address: address }).pipe(
      map((data) => {
        if (data && data.length > 0) {
          return new GpsLocation(
            data[0].geometry.location.lat(),
            data[0].geometry.location.lng()
          );
        }

        return null;
      })
    );
  }

  public getDistanceBetweenTwoPoints(
    point1: GpsLocation,
    point2: GpsLocation
  ): number {
    let coordinate1 = new Coordinate(point1.Latitude, point1.Longitude);
    let coordinate2 = new Coordinate(point2.Latitude, point2.Longitude);

    let calculator = new Vincenty();
    return calculator.getDistance(coordinate1, coordinate2);
  }
}
