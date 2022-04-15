import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewChild,
} from "@angular/core";
import { Store } from "@ngrx/store";
import { HomeState } from "../../store/home.store";
import { Observable } from "rxjs";
import {
  selectActiveCallTemplateState,
  selectHomeState,
  selectMapDataState,
  selectNewCallAddressState,
  selectNewCallState,
} from "src/app/store";
import * as HomeActions from "../../actions/home.actions";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { take } from "rxjs/operators";
import * as L from "leaflet";
import { environment } from "../../../../../environments/environment";
import * as _ from "lodash";
import { VoiceState } from "src/app/features/voice/store/voice.store";
import * as VoiceActions from "../../../voice/actions/voice.actions";
import { Router } from "@angular/router";
import { CallResultData, ConnectionState, GetCallTemplatesResultData, GpsLocation, MapDataAndMarkersData, SignalRService } from "@resgrid/ngx-resgridlib";
import { Call } from "src/app/core/models/call";
import { AuthState } from "src/app/features/auth/store/auth.store";
import { HomeProvider } from "../../providers/home";
import { NgbNavChangeEvent } from "@ng-bootstrap/ng-bootstrap";

const iconRetinaUrl = './assets/marker-icon-2x.png';
const iconUrl = './assets/marker-icon.png';
const shadowUrl = './assets/marker-shadow.png';
const iconDefault = L.icon({
iconRetinaUrl,
iconUrl,
shadowUrl,
iconSize: [25, 41],
iconAnchor: [12, 41],
popupAnchor: [1, -34],
tooltipAnchor: [16, -28],
shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = iconDefault;

@Component({
  selector: "app-dashboard",
  templateUrl: "dashboard.page.html",
  styleUrls: ["dashboard.page.scss"],
})
export class DashboardPage implements AfterViewInit {
  public homeState$: Observable<HomeState | null>;
  public mapData$: Observable<MapDataAndMarkersData | null>;
  public activeCallTemplate$: Observable<GetCallTemplatesResultData | null>;
  public newCallAddress$: Observable<GpsLocation | null>;
  public newCall$: Observable<CallResultData | null>;
  public breadCrumbItems: Array<{}>;

  @ViewChild("map") mapContainer;
  public map: any;

  @ViewChild("newCallMapContainer") newCallMapContainer;
  public newCallMap: any;

  public newCallMarker: L.Marker;
  public markers: any[];
  public selectedGroupName: string = "";
  public auth: AuthState;
  public newCallForm: FormGroup;
  public unitGroups: string[];
  public currentStatusTabSelected: number = 1;

  constructor(
    public formBuilder: FormBuilder,
    private store: Store<HomeState>,
    private voiceStore: Store<VoiceState>,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private homeProvider: HomeProvider
  ) {
    this.homeState$ = this.store.select(selectHomeState);
    this.mapData$ = this.store.select(selectMapDataState);
    this.activeCallTemplate$ = this.store.select(selectActiveCallTemplateState);
    this.newCallAddress$ = this.store.select(selectNewCallAddressState);
    this.newCall$ = this.store.select(selectNewCallState);

    this.markers = new Array<any>();
    this.unitGroups = new Array<any>();

    this.newCallForm = this.formBuilder.group({
      name: ["", Validators.required],
      nature: ["", Validators.required],
      priority: ["0", Validators.required],
      type: ["0", Validators.required],
      reportingPartyName: [""],
      reportingPartyContact: [""],
      latitude: [""],
      longitude: [""],
      callId: [""],
      incidentId: [""],
      referenceId: [""],
      notes: [""],
      address: [""],
      w3w: [""],
      dispatchOn: [""],
    });
  }

  ngAfterViewInit(): void {
    this.store.dispatch(new HomeActions.Loading());

    this.mapData$.subscribe((state) => {
      this.processMapData(state);
    });

    this.activeCallTemplate$.subscribe((activeCallTemplate) => {
      if (activeCallTemplate) {
        this.form["name"].setValue(activeCallTemplate.CallName);
        this.form["name"].patchValue(activeCallTemplate.CallName);

        this.form["type"].setValue(activeCallTemplate.CallType);
        this.form["type"].patchValue(activeCallTemplate.CallType);

        this.form["nature"].setValue(activeCallTemplate.CallNature);
        this.form["nature"].patchValue(activeCallTemplate.CallNature);

        this.form["priority"].setValue(activeCallTemplate.CallPriority);
        this.form["priority"].patchValue(activeCallTemplate.CallPriority);
      }
    });

    this.newCallAddress$.subscribe((geolocation) => {
      if (geolocation) {
        this.form["latitude"].setValue(geolocation.Latitude.toString());
        this.form["latitude"].patchValue(geolocation.Latitude.toString());

        this.form["longitude"].setValue(geolocation.Longitude.toString());
        this.form["longitude"].patchValue(geolocation.Longitude.toString());

        this.addPinToMap(geolocation.Latitude, geolocation.Longitude);
      }
    });

    this.newCall$.subscribe((newCallData) => {
      this.form["name"].setValue("");
      this.form["name"].patchValue("");

      this.form["nature"].setValue("");
      this.form["nature"].patchValue("");

      this.form["priority"].setValue(0);
      this.form["priority"].patchValue(0);

      this.form["type"].setValue(0);
      this.form["type"].patchValue(0);

      this.form["reportingPartyName"].setValue("");
      this.form["reportingPartyName"].patchValue("");

      this.form["reportingPartyContact"].setValue("");
      this.form["reportingPartyContact"].patchValue("");

      this.form["address"].setValue("");
      this.form["address"].patchValue("");

      this.form["latitude"].setValue("");
      this.form["latitude"].patchValue("");

      this.form["longitude"].setValue("");
      this.form["longitude"].patchValue("");

      this.form["callId"].setValue("");
      this.form["callId"].patchValue("");

      this.form["incidentId"].setValue("");
      this.form["incidentId"].patchValue("");

      this.form["referenceId"].setValue("");
      this.form["referenceId"].patchValue("");

      this.form["notes"].setValue("");
      this.form["notes"].patchValue("");

      this.form["w3w"].setValue("");
      this.form["w3w"].patchValue("");

      this.form["dispatchOn"].setValue("");
      this.form["dispatchOn"].patchValue("");
    });

    this.store.select(selectHomeState).subscribe((state) => {
      if (state.unitStatuses) {
        var units = _(state.unitStatuses)
          .groupBy((x) => x.GroupName)
          .map((value, key) => ({ groupName: key, units: value }))
          .value();

        if (units) {
          this.selectedGroupName = units[0].groupName;

          if (!this.selectedGroupName || this.selectedGroupName == "") {
            this.selectedGroupName = "No Group";
          }
        } else {
          this.selectedGroupName = "No Group";
        }

        if (!this.unitGroups || this.unitGroups.length == 0) {
          this.unitGroups.push("No Group");
          const groups = _.uniqBy(state.unitStatuses, "GroupName").map(
            (item) => item.GroupName
          );

          groups.forEach((group) => {
            if (group && group.length > 0) {
              this.unitGroups.push(group);
            }
          });
        }
      } else {
        this.selectedGroupName = "No Group";
      }

      this.cdr.detectChanges();
    });

    this.breadCrumbItems = [
      { label: "Resgrid Dispatch" },
      { label: "Dashboard", active: true },
    ];

    this.homeProvider.startSignalR();
    this.store.dispatch(new VoiceActions.GetVoipInfo());
  }

  get form() {
    return this.newCallForm.controls;
  }

  public setUnitStatus(unitId) {
    this.store.dispatch(new HomeActions.ShowSetUnitStateModal(unitId));
  }

  public setPersonnelStatus() {
    this.store.dispatch(new HomeActions.OpenSetPersonStatusModal());
  }

  public setPersonnelStaffing() {
    this.store.dispatch(new HomeActions.OpenSetPersonStaffingModal());
  }

  public callNotes() {
    this.store
      .select(selectHomeState)
      .pipe(take(1))
      .subscribe((state) => {
        const selectedCall = _.find(state.calls, ["Selected", true]);

        if (selectedCall) {
          this.store.dispatch(
            new HomeActions.ShowCallNotesModal(selectedCall.CallId)
          );
        }
      });
  }

  public callImages() {
    this.store
      .select(selectHomeState)
      .pipe(take(1))
      .subscribe((state) => {
        const selectedCall = _.find(state.calls, ["Selected", true]);

        if (selectedCall) {
          this.store.dispatch(
            new HomeActions.ShowCallImagesModal(selectedCall.CallId)
          );
        }
      });
  }

  public callFiles() {
    this.store
      .select(selectHomeState)
      .pipe(take(1))
      .subscribe((state) => {
        const selectedCall = _.find(state.calls, ["Selected", true]);

        if (selectedCall) {
          this.store.dispatch(
            new HomeActions.ShowCallFilesModal(selectedCall.CallId)
          );
        }
      });
  }

  public closeCall() {
    this.store.dispatch(new HomeActions.ShowCloseCallModal());
  }

  public editCall() {
    this.store
      .select(selectHomeState)
      .pipe(take(1))
      .subscribe((state) => {
        const selectedCall = _.find(state.calls, ["Selected", true]);

        if (selectedCall) {
          this.router.navigate(['/calls/edit-call', selectedCall.CallId, "2"]);
        }
      });
  }

  public getCoordinatesForAddress() {
    this.store.dispatch(
        new HomeActions.GetCoordinatesForAddress(this.newCallForm.get("address").value)
    );
  }

  public callTemplate() {
    this.store.dispatch(new HomeActions.ShowSelectCallTemplateModal());
  }

  public changeCheckedUnit(event) {
    var id = event.target.name;
    var checked = event.target.checked;

    this.store.dispatch(new HomeActions.UpdateSelectUnit(id, checked));
  }

  public changeCheckedPerson(event) {
    var id = event.target.name;
    var checked = event.target.checked;

    this.store.dispatch(new HomeActions.UpdateSelectPerson(id, checked));
  }

  public changeCheckedCall(event) {
    var id = event.target.name;
    var checked = event.target.checked;

    this.store.dispatch(new HomeActions.UpdateSelectedCall(id, checked));
  }

  public changeCheckedPersonnelDispatch(event) {
    var id = event.target.name;
    var checked = event.target.checked;

    this.store.dispatch(
      new HomeActions.UpdateSelectedDispatchPerson(id, checked)
    );
  }

  public changeCheckedGroupDispatch(event) {
    var id = event.target.name;
    var checked = event.target.checked;

    this.store.dispatch(
      new HomeActions.UpdateSelectedDispatchGroup(id, checked)
    );
  }

  public changeCheckedRoleDispatch(event) {
    var id = event.target.name;
    var checked = event.target.checked;

    this.store.dispatch(
      new HomeActions.UpdateSelectedDispatchRole(id, checked)
    );
  }

  public changeCheckedUnitDispatch(event) {
    var id = event.target.name;
    var checked = event.target.checked;

    this.store.dispatch(
      new HomeActions.UpdateSelectedDispatchRoleUnit(id, checked)
    );
    event.stopPropagation();
  }

  public findCoordinates() {
    this.addPinToMap(this.form.value["latitude"], this.form.value["longitude"]);
  }

  public getUnitsForGroup(groupName, groups) {
    return _.map(groups, function (o) {
      if (o.GroupName == groupName) return o;
    });
  }

  public callForm() {
    this.store.dispatch(
      new HomeActions.OpenCallFormModal()
    );
  }

  public updateAssignments() {

  }

  public viewCallForm() {

  }

  public saveCall() {
    this.store.dispatch(new HomeActions.IsSavingCall());

    const call = this.form;
    let newCall: Call = new Call();

    newCall.Name = call["name"].value;
    newCall.Nature = call["nature"].value;
    newCall.Note = call["notes"].value;
    newCall.ContactName = call["reportingPartyName"].value;
    newCall.ContactInfo = call["reportingPartyContact"].value;
    newCall.Priority = call["priority"].value;
    newCall.Type = call["type"].value;
    newCall.ExternalId = call["callId"].value;
    newCall.IncidentId = call["incidentId"].value;
    newCall.ReferenceId = call["referenceId"].value;
    newCall.Address = call["address"].value;
    newCall.w3w = call["w3w"].value;
    newCall.Latitude = call["latitude"].value;
    newCall.Longitude = call["longitude"].value;
    newCall.FormData = "";

    //const currentDate = new Date(call["dispatchOn"].value);
    //newCall.DispatchOn = currentDate.toISOString();
    newCall.DispatchOn = call["dispatchOn"].value;


    this.store.select(selectHomeState).pipe(take(1)).subscribe((state) => {
      if (state && state.personnelForGrid) {
        state.personnelForGrid.forEach((person) => {
          if (person && person.Selected) {
            if (newCall.DispatchList.length > 0) {
              newCall.DispatchList = newCall.DispatchList.concat(
                `|P:${person.UserId}`
              );
            } else {
              newCall.DispatchList = `P:${person.UserId}`;
            }
          }
        });
      }

      if (state && state.groupsForGrid) {
        state.groupsForGrid.forEach((group) => {
          if (group && group.Selected) {
            if (newCall.DispatchList.length > 0) {
              newCall.DispatchList = newCall.DispatchList.concat(
                `|G:${group.GroupId}`
              );
            } else {
              newCall.DispatchList = `G:${group.GroupId}`;
            }
          }
        });
      }

      if (state && state.rolesForGrid) {
        state.rolesForGrid.forEach((role) => {
          if (role && role.Selected) {
            if (newCall.DispatchList.length > 0) {
              newCall.DispatchList = newCall.DispatchList.concat(
                `|R:${role.RoleId}`
              );
            } else {
              newCall.DispatchList = `R:${role.RoleId}`;
            }
          }
        });
      }

      if (state && state.unitStatuses) {
        state.unitStatuses.forEach((unit) => {
          if (unit && unit.Selected) {
            if (newCall.DispatchList.length > 0) {
              newCall.DispatchList = newCall.DispatchList.concat(
                `|U:${unit.UnitId}`
              );
            } else {
              newCall.DispatchList = `U:${unit.UnitId}`;
            }
          }
        });
      }

      if (state.newCallFormData) {
        newCall.FormData = state.newCallFormData;
      }

      this.store.dispatch(new HomeActions.SaveCall(newCall));
    });
  }

  public onStatuseTabNavChange(changeEvent: NgbNavChangeEvent) {
    if (changeEvent) {
      this.currentStatusTabSelected = changeEvent.nextId;
    }
  }

  /* New Call Map func */
  private setupNewCallMap(data: MapDataAndMarkersData) {
    if (!this.newCallMap) {
      this.newCallMap = L.map(this.newCallMapContainer.nativeElement, {
        scrollWheelZoom: false,
      });

      L.tileLayer(
        "https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=" +
          environment.osmMapKey,
        {
          attribution:
            '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
        }
      ).addTo(this.newCallMap);

      this.newCallMap.scrollWheelZoom.disable();
      var mapCenter = this.getMapCenter(data);
      this.newCallMap.setView(mapCenter, this.getMapZoomLevel(data));

      this.newCallMap.on("click", (e) => {
        var coord = e.latlng;
        var lat = coord.lat;
        var lng = coord.lng;

        this.addPinToMap(lat, lng);
      });
    }
  }

  private addPinToMap(lat, lng) {
    if (this.newCallMarker) {
      this.newCallMap.removeLayer(this.newCallMarker);
      this.newCallMarker = null;
    }
    //console.log('You clicked the map at latitude: ' + lat + ' and longitude: ' + lng);
    this.newCallMarker = new L.Marker([lat, lng], { draggable: true }).addTo(
      this.newCallMap
    );
    const that = this;
    this.newCallMarker.on("dragend", function (event) {
      var marker = event.target;
      var position = marker.getLatLng();
      that.newCallMarker.setLatLng(new L.LatLng(position.lat, position.lng));
      that.newCallMap.panTo(new L.LatLng(position.lat, position.lng));

      if (that && that.form) {
        that.form["latitude"].setValue(position.lat);
        that.form["latitude"].patchValue(position.lat);

        that.form["longitude"].setValue(position.lng);
        that.form["longitude"].patchValue(position.lng);
      }

      that.updatePersonnelDistances(
        new GpsLocation(position.lat, position.lng)
      );

      //that.store.dispatch(
      //  new HomeActions.UpdateNewCallLocation(position.lat, position.lng)
      //);
    });
    this.newCallMap.panTo(new L.LatLng(lat, lng));

    //this.store.dispatch(
    //  new HomeActions.UpdateNewCallLocation(lat, lng)
    //);

    if (this.form) {
      this.form["latitude"].setValue(lat);
      this.form["latitude"].patchValue(lat);

      this.form["longitude"].setValue(lng);
      this.form["longitude"].patchValue(lng);
    }

    this.updatePersonnelDistances(new GpsLocation(lat, lng));
  }

  private updatePersonnelDistances(location: GpsLocation) {
    this.store.select(selectHomeState).pipe(take(1)).subscribe((state) => {
      if (state && state.personnelForGrid && state.unitStatuses) {
        this.store.dispatch(
          new HomeActions.GetUpdatedPersonnelandUnitsDistancesToCall(
            location,
            state.personnelForGrid,
            state.unitStatuses
          )
        );
      }
    });
  }
  /* New Call Map func end */

  /* Map func */
  private processMapData(data: MapDataAndMarkersData) {
    if (data) {
      this.setupNewCallMap(data);

      var mapCenter = this.getMapCenter(data);

      if (!this.map) {
        this.map = L.map(this.mapContainer.nativeElement, {
          //dragging: false,
          doubleClickZoom: false,
          zoomControl: false,
        });

        L.tileLayer(
          "https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=" +
            environment.osmMapKey,
          {
            attribution:
              '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
          }
        ).addTo(this.map);
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
            let marker = L.marker([markerInfo.Latitude, markerInfo.Longitude], {
              icon: L.icon({
                iconUrl:
                  "assets/images/mapping/" + markerInfo.ImagePath + ".png",
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
          });
        }

        var group = L.featureGroup(this.markers);
        this.map.fitBounds(group.getBounds());
      }
    }
  }

  private getMapCenter(data: MapDataAndMarkersData) {
    return [data.CenterLat, data.CenterLon];
  }

  private getMapZoomLevel(data: MapDataAndMarkersData): any {
    return data.ZoomLevel;
  }
  /* Map func end */
}
