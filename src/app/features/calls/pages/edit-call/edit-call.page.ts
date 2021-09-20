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
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
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
import { MapResult } from "src/app/core/models/mapResult";
import { GpsLocation } from "src/app/core/models/gpsLocation";
import { CallResult } from "src/app/core/models/callResult";
import { CallDataResult } from "src/app/core/models/callDataResult";
import { Call } from "src/app/core/models/call";
import { take } from "rxjs/operators";

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
  private mapData: MapResult;
  public editCallForm: FormGroup;

  public callsState$: Observable<CallsState | null>;
  public homeState$: Observable<HomeState | null>;
  public editCall$: Observable<CallResult | null>;
  public editCallData$: Observable<CallDataResult | null>;

  public selectedGroupName: string = "";
  public unitGroups: string[];

  @ViewChild("editCallMapContainer") editCallMapContainer;
  public newCallMap: any;
  public newCallMarker: L.Marker;

  get form() {
    return this.editCallForm.controls;
  }

  constructor(
    public formBuilder: FormBuilder,
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
    this.editCallData$ = this.store.select(selectEditCallData);

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
          state.personnelForGrid
        )
      );

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

      this.mapData = state.mapData;
      this.cdr.detectChanges();
    });

    this.editCall$.subscribe((editCallData) => {
      if (editCallData) {
        this.form["name"].setValue(editCallData.Nme);
        this.form["name"].patchValue(editCallData.Nme);

        this.form["nature"].setValue(editCallData.Noc);
        this.form["nature"].patchValue(editCallData.Noc);

        this.form["priority"].setValue(editCallData.Pri);
        this.form["priority"].patchValue(editCallData.Pri);

        this.form["type"].setValue(editCallData.Typ);
        this.form["type"].patchValue(editCallData.Typ);

        this.form["reportingPartyName"].setValue(editCallData.Rnm);
        this.form["reportingPartyName"].patchValue(editCallData.Rnm);

        this.form["reportingPartyContact"].setValue(editCallData.Rci);
        this.form["reportingPartyContact"].patchValue(editCallData.Rci);

        this.form["address"].setValue(editCallData.Add);
        this.form["address"].patchValue(editCallData.Add);

        this.form["latitude"].setValue(editCallData.Gla);
        this.form["latitude"].patchValue(editCallData.Gla);

        this.form["longitude"].setValue(editCallData.Glo);
        this.form["longitude"].patchValue(editCallData.Glo);

        this.form["callId"].setValue(editCallData.Eid);
        this.form["callId"].patchValue(editCallData.Eid);

        this.form["incidentId"].setValue("");
        this.form["incidentId"].patchValue("");

        this.form["referenceId"].setValue(editCallData.Rid);
        this.form["referenceId"].patchValue(editCallData.Rid);

        this.form["notes"].setValue(editCallData.Not);
        this.form["notes"].patchValue(editCallData.Not);

        this.form["w3w"].setValue(editCallData.w3w);
        this.form["w3w"].patchValue(editCallData.w3w);

        this.form["dispatchOn"].setValue(editCallData.Don);
        this.form["dispatchOn"].patchValue(editCallData.Don);

        this.setupNewCallMap(this.mapData);
        this.addPinToMap(editCallData.Gla, editCallData.Glo);
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
    editCall.Address = call["address"].value;
    editCall.w3w = call["w3w"].value;
    editCall.Latitude = call["latitude"].value;
    editCall.Longitude = call["longitude"].value;
    editCall.Redispatch = call["redispatch"].value;
    editCall.FormData = "";
    editCall.DispatchOn = call["dispatchOn"].value;

    this.store.select(selectCallsState).pipe(take(1)).subscribe((state) => {
      if (state.callToEdit) {
        editCall.Id = state.callToEdit.Cid;
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
  private setupNewCallMap(data: MapResult) {
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

  private getMapCenter(data: MapResult) {
    return [data.CenterLat, data.CenterLon];
  }

  private getMapZoomLevel(data: MapResult): any {
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
