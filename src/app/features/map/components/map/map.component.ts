import { Subscription, timer, Observable } from 'rxjs';
import { Component, OnInit, OnDestroy, Input, ViewChild } from '@angular/core';

import leaflet from 'leaflet';
import L from 'leaflet';
import { Store } from '@ngrx/store';
import { MapState } from '../../store/map.store';
import { selectMapState } from 'src/app/store';
import * as MapActions from '../../actions/map.actions';
import { take } from 'rxjs/operators';
import { MapResult } from 'src/app/models/mapResult';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements OnInit, OnDestroy {
  @ViewChild('map', { static: true }) mapContainer;
  public markers: any[];
  public map: any;
  public mapWidth: string = '100px';
  public mapHeight: string = '100px';
  public mapState$: Observable<MapState | null>;

  constructor(private store: Store<MapState>) {
    this.markers = new Array();
    this.mapState$ = this.store.select(selectMapState);
  }

  public ngOnInit() {
    this.mapState$
      //.pipe(take(1))
      .subscribe((data: MapState) => {
        this.loadMap(data.mapData);
      });

    this.store.dispatch(new MapActions.Loading());
  }

  public ngOnDestroy(): void {

  }

  private loadMap(data: MapResult) {

    if (data) {
      this.setMapBounds();
      const mapCenter = [data.CenterLat, data.CenterLon];

      if (!this.map) {
        this.map = leaflet.map(this.mapContainer.nativeElement, {
          dragging: false,
          doubleClickZoom: false,
          zoomControl: false
        });
        leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          setView: true,
          minZoom: 14,
          maxZoom: 14
        }).addTo(this.map);
      }

      this.setMapBounds();
      this.map.setView(mapCenter, data.ZoomLevel);

      // clear map markers
      if (this.markers && this.markers.length >= 0) {
        for (var i = 0; i < this.markers.length; i++) {
          if (this.markers[i]) {
            this.map.removeLayer(this.markers[i]);
          }
        }

        this.markers = new Array<any>();
      }

      if (data.MapMakerInfos && data.MapMakerInfos.length > 0) {
        if (data && data.MapMakerInfos) {
          data.MapMakerInfos.forEach(markerInfo => {

            let marker = leaflet.marker([markerInfo.Latitude, markerInfo.Longitude], {
              icon: new leaflet.icon({
                iconUrl: "assets/mapping/" + markerInfo.ImagePath + ".png",
                iconSize: [32, 37],
                iconAnchor: [16, 37]
              }),
              draggable: false,
              title: markerInfo.Title,
              tooltip: markerInfo.Title
            }).bindTooltip(markerInfo.Title,
              {
                permanent: true,
                direction: 'bottom'
              }).addTo(this.map);

            this.markers.push(marker);

          });
        }

        var group = new leaflet.featureGroup(this.markers);
        this.map.fitBounds(group.getBounds());
      }
    }
  }

  private updateMapSize() {
    if (this.map) {
      let that = this;
      setTimeout(function () {
        that.map.invalidateSize();
      }, 300);
    }
  }

  private setMapBounds() {
    let parent = this.mapContainer.nativeElement.parentElement.parentElement.parentElement;
    this.mapWidth = parent.offsetWidth - 35 + 'px';
    this.mapHeight = parent.offsetHeight - 60 + 'px';

    this.updateMapSize();
  }
}
