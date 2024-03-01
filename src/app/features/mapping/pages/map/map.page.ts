import { AfterViewInit, ChangeDetectorRef, Component, OnInit, QueryList, ViewChild, ViewChildren } from "@angular/core";
import { Store } from "@ngrx/store";
import * as _ from "lodash";
import { MappingState } from "../../store/mapping.store";
import * as CallsActions from "../../actions/mapping.actions";
import { UtilsProvider } from "src/app/providers/utils";
import { Router } from "@angular/router";
import { Observable, Subscription } from "rxjs";
import { selectConfigData, selectMappingState } from "src/app/store";
import * as MappingActions from "../../actions/mapping.actions";
import { GetConfigResultData, MapDataAndMarkersData } from "@resgrid/ngx-resgridlib";
import * as L from "leaflet";
import { environment } from "src/environments/environment";
import { SubSink } from "subsink";

@Component({
  selector: "app-mapping-map",
  templateUrl: "map.page.html",
  styleUrls: ["map.page.scss"],
})
export class MapPage implements AfterViewInit {
  public breadCrumbItems: Array<{}>;
  private mappingStateSub: Subscription;
  public mappingState$: Observable<MappingState | null>;
  public configData$: Observable<GetConfigResultData | null>;

  @ViewChild("map") mapContainer;
  private subs = new SubSink();
  public map: any;
  public markers: any[];
  public showCalls: boolean = true;
  public showStations: boolean = true;
  public showUnits: boolean = true;
  public showPersonnel: boolean = true;
  private creatingMap: boolean = false;
  private mapData: MapDataAndMarkersData;
  private configData: GetConfigResultData = null;

  constructor(
    private mappingStore: Store<MappingState>,
    public utilsProvider: UtilsProvider,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    this.mappingState$ = this.mappingStore.select(selectMappingState);
    this.markers = new Array<any>();
    this.configData$ = this.mappingStore.select(selectConfigData);
  }

  ngAfterViewInit(): void {
    this.mappingStateSub = this.mappingState$.subscribe((state) => {
      if (state && state.mapData) {
        this.mapData = state.mapData;
        this.processMapData(state.mapData);
      }
    });

    this.subs.sink = this.configData$.subscribe((config) => {
      if (config) {
        this.configData = config;

        if (this.configData && this.configData.NavigationMapKey) {
          if (!this.map && this.mapData && !this.creatingMap) {
            this.processMapData(this.mapData);
          }
        }
      }
    });

    this.mappingStore.dispatch(new MappingActions.LoadMapData());

    this.breadCrumbItems = [{ label: "Resgrid Dispatch" }, { label: "Map", active: true }];

    this.cdr.detectChanges();
  }

  public ngOnDestroy(): void {
    if (this.subs) {
      this.subs.unsubscribe();
    }
  }

  public changeShowCalls(event) {
    var checked = event.target.checked;
    this.showCalls = checked;

    this.mappingStore.dispatch(new MappingActions.LoadMapData());
  }

  public changeShowStations(event) {
    var checked = event.target.checked;
    this.showStations = checked;

    this.mappingStore.dispatch(new MappingActions.LoadMapData());
  }

  public changeShowUnits(event) {
    var checked = event.target.checked;
    this.showUnits = checked;

    this.mappingStore.dispatch(new MappingActions.LoadMapData());
  }

  public changeShowPeople(event) {
    var checked = event.target.checked;
    this.showPersonnel = checked;

    this.mappingStore.dispatch(new MappingActions.LoadMapData());
  }

  private processMapData(data: MapDataAndMarkersData) {
    const that = this;

    if (data) {
      if (this.configData && this.configData.MapUrl) {
        if (!this.creatingMap) {
          this.creatingMap = true;

          var mapCenter = this.getMapCenter(data);

          if (!this.map) {
            this.map = L.map(this.mapContainer.nativeElement, {
              //dragging: false,
              doubleClickZoom: false,
              zoomControl: false,
            });

            L.tileLayer(that.configData.MapUrl, {
              attribution: that.configData.MapAttribution,
            }).addTo(this.map);
          }

          //this.mapProvider.setMarkersForMap(this.map);

          //this.setMapBounds();

          //if (this.map) {
          this.map.setView(mapCenter, this.getMapZoomLevel(data));
          //}

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
              data.MapMakerInfos.forEach((markerInfo) => {
                if (
                  (markerInfo.Type == 0 && this.showCalls) ||
                  (markerInfo.Type == 1 && this.showUnits) ||
                  (markerInfo.Type == 2 && this.showStations)
                ) {
                  let marker = L.marker([markerInfo.Latitude, markerInfo.Longitude], {
                    icon: L.icon({
                      iconUrl: "assets/images/mapping/" + markerInfo.ImagePath + ".png",
                      iconSize: [32, 37],
                      iconAnchor: [16, 37],
                    }),
                    draggable: false,
                    title: markerInfo.Title,
                    //tooltip: markerInfo.Title,
                  })
                    .bindTooltip(markerInfo.Title, {
                      permanent: true,
                      direction: "bottom",
                    })
                    .addTo(this.map);

                  this.markers.push(marker);
                }
              });
            }

            var group = L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds());

            this.creatingMap = false;
          }
        }
      }
    }
  }

  private getMapCenter(data: MapDataAndMarkersData) {
    return [data.CenterLat, data.CenterLon];
  }

  private getMapZoomLevel(data: MapDataAndMarkersData): any {
    return data.ZoomLevel;
  }
}
