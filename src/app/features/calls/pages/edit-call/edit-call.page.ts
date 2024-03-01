import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
} from "@angular/core";
import { Store } from "@ngrx/store";
import * as _ from "lodash";
import { CallsState } from "../../store/calls.store";
import * as CallsActions from "../../actions/calls.actions";
import {
  CallsSortableDirective,
  SortEvent,
} from "../../directives/calls-sortable.directive";
import { UtilsProvider } from "src/app/providers/utils";
import { ActivatedRoute, Router } from "@angular/router";
import { UntypedFormBuilder, UntypedFormGroup, Validators } from "@angular/forms";
import { Observable } from "rxjs";
import { HomeState } from "src/app/features/home/store/home.store";
import {
  selectCallsState,
  selectEditCallData,
  selectEditCallState,
  selectHomeState,
} from "src/app/store";
import * as L from "leaflet";
import { environment } from "../../../../../environments/environment";
import { take } from "rxjs/operators";
import { CallResult, CallResultData, GetMapDataAndMarkersResult, GpsLocation, MapDataAndMarkersData } from '@resgrid/ngx-resgridlib';
import { Call } from "src/app/core/models/call";

@Component({
  selector: "app-edit-call",
  templateUrl: "edit-call.page.html",
  styleUrls: ["edit-call.page.scss"],
})
export class EditCallPage implements AfterViewInit {
  @ViewChildren(CallsSortableDirective)
  headers: QueryList<CallsSortableDirective>;
  public breadCrumbItems: Array<{}>;
  private id: string;
  private source: number;
  private activatedRouteSub: any;
  public editCallForm: UntypedFormGroup;

  public callsState$: Observable<CallsState | null>;
  public homeState$: Observable<HomeState | null>;
  public editCall$: Observable<CallResultData | null>;

  public selectedGroupName: string = "";
  public unitGroups: string[];

  @ViewChild("editCallMapContainer") editCallMapContainer;
  public newCallMap: any;
  public newCallMarker: L.Marker;

  get form() {
    return this.editCallForm.controls;
  }

  constructor(
    public formBuilder: UntypedFormBuilder,
    private store: Store<CallsState>,
    private homeStore: Store<HomeState>,
    public utilsProvider: UtilsProvider,
    private activatedroute: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.callsState$ = this.store.select(selectCallsState);
    this.homeState$ = this.store.select(selectHomeState);
    this.editCall$ = this.store.select(selectEditCallState);

    this.editCallForm = this.formBuilder.group({
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
      Redispatch: [false],
    });
  }

  ngAfterViewInit(): void {
    this.breadCrumbItems = [
      { label: "Resgrid Dispatch" },
      { label: "Edit Call", active: true },
    ];

    this.unitGroups = new Array<any>();

    this.activatedRouteSub = this.activatedroute.paramMap.subscribe(
      (params) => {
        if (params) {
          this.id = params.get("id");
          this.source = parseInt(params.get("source"), 10);

          this.store.dispatch(new CallsActions.GetCallById(this.id));
        }
      }
    );

    this.store.select(selectHomeState).subscribe((state) => {
      this.store.dispatch(
        new CallsActions.UpdateEditCallDataFromHomeState(
          state.unitStatuses,
          state.rolesForGrid,
          state.groupsForGrid,
          state.personnelForGrid,
          state.mapData
        )
      );

      if (state.unitStatuses) {
        var units = _(state.unitStatuses)
          .groupBy((x) => x.GroupName)
          .map((value, key) => ({ groupName: key, units: value }))
          .value();

        if (units) {
          if (units[0] && units[0].groupName) {
            this.selectedGroupName = units[0].groupName;
          }

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

    this.callsState$.pipe(take(1)).subscribe((callsState) => {
      if (callsState && callsState.callToEdit) {
        const editCallData = callsState.callToEdit;

        this.form["name"].setValue(editCallData.Name);
        this.form["name"].patchValue(editCallData.Name);

        this.form["nature"].setValue(editCallData.Nature);
        this.form["nature"].patchValue(editCallData.Nature);

        this.form["priority"].setValue(editCallData.Priority);
        this.form["priority"].patchValue(editCallData.Priority);

        //this.form["type"].setValue(editCallData.Type);
        //this.form["type"].patchValue(editCallData.Type);

        this.form["reportingPartyName"].setValue(editCallData.ContactName);
        this.form["reportingPartyName"].patchValue(editCallData.ContactName);

        this.form["reportingPartyContact"].setValue(editCallData.ContactInfo);
        this.form["reportingPartyContact"].patchValue(editCallData.ContactInfo);

        this.form["address"].setValue(editCallData.Address);
        this.form["address"].patchValue(editCallData.Address);

        this.form["latitude"].setValue(editCallData.Latitude);
        this.form["latitude"].patchValue(editCallData.Latitude);

        this.form["longitude"].setValue(editCallData.Longitude);
        this.form["longitude"].patchValue(editCallData.Longitude);

        this.form["callId"].setValue(editCallData.ExternalId);
        this.form["callId"].patchValue(editCallData.ExternalId);

        this.form["incidentId"].setValue(editCallData.IncidentId);
        this.form["incidentId"].patchValue(editCallData.IncidentId);

        this.form["referenceId"].setValue(editCallData.ReferenceId);
        this.form["referenceId"].patchValue(editCallData.ReferenceId);

        this.form["notes"].setValue(editCallData.Note);
        this.form["notes"].patchValue(editCallData.Note);

        this.form["w3w"].setValue(editCallData.What3Words);
        this.form["w3w"].patchValue(editCallData.What3Words);

        this.form["dispatchOn"].setValue(editCallData.DispatchedOn);
        this.form["dispatchOn"].patchValue(editCallData.DispatchedOn);

        this.store
          .select(selectHomeState)
          .pipe(take(1))
          .subscribe((state) => {
            const selectedCallType = _.find(state.callTypes, ["Name", editCallData.Type]);

            if (selectedCallType) {
              this.form["type"].setValue(selectedCallType.Id);
              this.form["type"].patchValue(selectedCallType.Id);
            }
          });

        if (editCallData.Latitude && editCallData.Longitude) {
          this.setupNewCallMap(parseInt(editCallData.Latitude), parseInt(editCallData.Longitude), 13);
          this.addPinToMap(editCallData.Latitude, editCallData.Longitude);
        } else {
          this.setupNewCallMap(parseInt(callsState.mapData.CenterLat), parseInt(callsState.mapData.CenterLon), parseInt(callsState.mapData.ZoomLevel));
        }

        this.cdr.detectChanges();
      }
    });
  }

  public changeCheckedPersonnelDispatch(event) {
    var id = event.target.name;
    var checked = event.target.checked;

    this.store.dispatch(
      new CallsActions.UpdateSelectedDispatchPerson(id, checked)
    );
  }

  public changeCheckedGroupDispatch(event) {
    var id = event.target.name;
    var checked = event.target.checked;

    this.store.dispatch(
      new CallsActions.UpdateSelectedDispatchGroup(id, checked)
    );
  }

  public changeCheckedRoleDispatch(event) {
    var id = event.target.name;
    var checked = event.target.checked;

    this.store.dispatch(
      new CallsActions.UpdateSelectedDispatchRole(id, checked)
    );
  }

  public changeCheckedUnitDispatch(event) {
    var id = event.target.name;
    var checked = event.target.checked;

    this.store.dispatch(
      new CallsActions.UpdateSelectedDispatchRoleUnit(id, checked)
    );
    event.stopPropagation();
  }

  public updateCall() {
    const call = this.form;
    let editCall: Call = new Call();

    editCall.Name = call["name"].value;
    editCall.Nature = call["nature"].value;
    editCall.Note = call["notes"].value;
    editCall.ContactName = call["reportingPartyName"].value;
    editCall.ContactInfo = call["reportingPartyContact"].value;
    editCall.Priority = call["priority"].value;
    editCall.Type = call["type"].value;
    editCall.ExternalId = call["callId"].value;
    editCall.IncidentId = call["incidentId"].value;
    editCall.ReferenceId = call["referenceId"].value;

    if (call["address"]) {
      editCall.Address = call["address"].value;
    }

    if (call["w3w"]) {
      editCall.w3w = call["w3w"].value;
    }

    if (call["latitude"]) {
      let latitude = call["latitude"].value;

      if (latitude && latitude !== 'null') {
        editCall.Latitude = call["latitude"].value;
      }
    }

    if (call["longitude"]) {
      let longitude = call["longitude"].value;

      if (longitude && longitude !== 'null') {
        editCall.Longitude = call["longitude"].value;
      }
    }

    if (call["redispatch"]) {
      editCall.Redispatch = call["redispatch"].value;
    }
    editCall.FormData = "";

    if (call["dispatchOn"]) {
      editCall.DispatchOn = call["dispatchOn"].value;
    }

    this.store.select(selectCallsState).pipe(take(1)).subscribe((state) => {
      if (state.callToEdit) {
        editCall.Id = state.callToEdit.CallId;
      }

      if (state && state.personnelForGrid) {
        state.personnelForGrid.forEach((person) => {
          if (person && person.Selected) {
            if (editCall.DispatchList.length > 0) {
              editCall.DispatchList = editCall.DispatchList.concat(
                `|P:${person.UserId}`
              );
            } else {
              editCall.DispatchList = `P:${person.UserId}`;
            }
          }
        });
      }

      if (state && state.groupsForGrid) {
        state.groupsForGrid.forEach((group) => {
          if (group && group.Selected) {
            if (editCall.DispatchList.length > 0) {
              editCall.DispatchList = editCall.DispatchList.concat(
                `|G:${group.GroupId}`
              );
            } else {
              editCall.DispatchList = `G:${group.GroupId}`;
            }
          }
        });
      }

      if (state && state.rolesForGrid) {
        state.rolesForGrid.forEach((role) => {
          if (role && role.Selected) {
            if (editCall.DispatchList.length > 0) {
              editCall.DispatchList = editCall.DispatchList.concat(
                `|R:${role.RoleId}`
              );
            } else {
              editCall.DispatchList = `R:${role.RoleId}`;
            }
          }
        });
      }

      if (state && state.unitStatuses) {
        state.unitStatuses.forEach((unit) => {
          if (unit && unit.Selected) {
            if (editCall.DispatchList.length > 0) {
              editCall.DispatchList = editCall.DispatchList.concat(
                `|U:${unit.UnitId}`
              );
            } else {
              editCall.DispatchList = `U:${unit.UnitId}`;
            }
          }
        });
      }

      this.store.dispatch(new CallsActions.UpdateCall(editCall, this.source));
    });
  }

  public getCoordinatesForAddress() {}

  public findCoordinates() {}

  /* New Call Map func */
  private setupNewCallMap(latitude: number, longitude: number, zoom: number) {
    if (!this.newCallMap) {
      this.newCallMap = L.map(this.editCallMapContainer.nativeElement, {
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
      this.newCallMap.setView([latitude, longitude], zoom);

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

      this.form["latitude"].setValue(position.lat);
      this.form["latitude"].patchValue(position.lat);

      this.form["longitude"].setValue(position.lng);
      this.form["longitude"].patchValue(position.lng);

      this.updatePersonnelDistances(
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

    this.form["latitude"].setValue(lat);
    this.form["latitude"].patchValue(lat);

    this.form["longitude"].setValue(lng);
    this.form["longitude"].patchValue(lng);

    this.updatePersonnelDistances(new GpsLocation(lat, lng));
  }

  private getMapCenter(data: CallResultData) {
    return [data.Latitude, data.Longitude];
  }

  private getMapZoomLevel(data: MapDataAndMarkersData): any {
    return data.ZoomLevel;
  }

  private updatePersonnelDistances(location: GpsLocation) {
    this.store.select(selectHomeState).subscribe((state) => {
      if (state && state.personnelForGrid) {
        this.store.dispatch(
          new CallsActions.GetUpdatedPersonnelandUnitsDistancesToCall(
            location,
            state.personnelForGrid,
            state.unitStatuses
          )
        );
      }
    });
  }
}
