import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { APP_CONFIG_TOKEN, AppConfig } from '../config/app.config-interface';
import { SettingsProvider } from './settings';

import { MapResult } from '../models/mapResult';
import { MapMakerInfo } from '../models/mapMakerInfo';

import leaflet from 'leaflet';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class MapProvider {
    private markers: any[];

    constructor(private http: HttpClient, @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig,
        private settingsProvider: SettingsProvider) {

    }

    public getMapData(): Observable<MapResult> {
        return this.http.get<MapResult>(this.appConfig.ResgridApiUrl + '/BigBoard/GetMap').pipe(map((item) => {
            let mapResult: MapResult = new MapResult();
            mapResult.MapMakerInfos = new Array<MapMakerInfo>();

            mapResult.CenterLat = item.CenterLat;
            mapResult.CenterLon = item.CenterLon;
            mapResult.ZoomLevel = item.ZoomLevel;


            item.MapMakerInfos.forEach(makerInfo => {
                let marker = new MapMakerInfo();
                marker.Longitude = makerInfo.Longitude;
                marker.Latitude = makerInfo.Latitude;
                marker.Title = makerInfo.Title;
                marker.zIndex = makerInfo.zIndex;
                marker.ImagePath = makerInfo.ImagePath;
                marker.InfoWindowContent = makerInfo.InfoWindowContent;

                mapResult.MapMakerInfos.push(marker);
            });

            return mapResult;
        }));
    }

    public setMarkersForMap(map: any) {
        this.getMapData().subscribe(
            data => {
                if (data && data.MapMakerInfos) {
                    data.MapMakerInfos.forEach(markerInfo => {
                        let marker = leaflet.marker([markerInfo.Latitude, markerInfo.Longitude], {
                            icon: new leaflet.icon({
                                iconUrl: 'assets/mapping/' + markerInfo.ImagePath + '.png',
                                iconSize: [32, 37],
                                iconAnchor: [16, 37]
                            }),
                            draggable: false,
                            title: markerInfo.Title,
                            tooltip: markerInfo.Title
                        }).addTo(map);
                    });
                }
            },
            err => {

            });
    }
}
