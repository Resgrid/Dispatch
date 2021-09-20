import { Injectable, Inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";

import { TypesProvider } from "./types";
import { DataProvider } from "./data";
import { environment } from "../../environments/environment";
import { CallDataResult } from "../core/models/callDataResult";
import { CallResult } from "../core/models/callResult";
import { CallFileResult } from "../core/models/callFileResult";
import { CallNoteResult } from "../core/models/callNoteResult";
import { CallTypeResult } from "../core/models/callTypeResult";
import { GpsLocation } from "../core/models/gpsLocation";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { CallPriorityResult } from "../core/models/callPriorityResult";
import { UtilsProvider } from "./utils";

@Injectable({
  providedIn: "root",
})
export class CallsProvider {
  constructor(
    public http: HttpClient,
    private typesProvider: TypesProvider,
    private dataProvider: DataProvider,
    private utilsProvider: UtilsProvider
  ) {}

  public getActiveCalls(): Observable<CallResult[]> {
    const url =
      environment.baseApiUrl +
      environment.resgridApiUrl +
      "/Calls/GetActiveCalls";

    return this.http.get<CallResult[]>(url).pipe(
      map((items) => {
        let statuses: CallResult[] = new Array<CallResult>();

        items.forEach((item) => {
          let status: CallResult = this.mapDataToCall(item);

          statuses.push(status);
        });

        return statuses;
      })
    );
  }

  public saveCall(
    name,
    priority,
    type,
    contactName,
    contactInfo,
    externalId,
    incidentId,
    referenceId,
    nature,
    notes,
    address,
    w3w,
    latitude,
    longitude,
    dispatchList,
    dispatchOn,
    callFormData
  ): Observable<any> {
    let url =
      environment.baseApiUrl + environment.resgridApiUrl + "/Calls/SaveCall";

    let coordinates = "";
    if (latitude && latitude != 0 && longitude && longitude != 0) {
      coordinates = latitude + "," + longitude;
    }

    return this.http.post(url, {
      Pri: priority,
      Typ: type,
      CNme: contactName,
      CNum: contactInfo,
      EId: externalId,
      InI: incidentId,
      RId: referenceId,
      Nme: name,
      Noc: nature,
      Not: notes,
      Geo: coordinates,
      Add: address,
      W3W: w3w,
      Dis: dispatchList,
      Don: dispatchOn,
      Cfd: callFormData,
    });
  }

  public getCall(callId: any): Observable<CallResult> {
    let url =
      environment.baseApiUrl + environment.resgridApiUrl + "/Calls/GetCall";

    let params = new HttpParams().append("callId", callId);

    //return this.http.get<CallResult>(url + "?callId=" + callId).map((item) => {
    return this.http.get<CallResult>(url, { params: params }).pipe(
      map((item) => {
        let status: CallResult = this.mapDataToCall(item);

        return status;
      })
    );
  }

  public getCallData(callId: any): Observable<CallDataResult> {
    let url =
      environment.baseApiUrl +
      environment.resgridApiUrl +
      "/Calls/GetCallExtraData";

    let params = new HttpParams().append("callId", callId);

    return this.http.get(url, { params: params }).pipe(
      map((item) => {
        let status: CallDataResult = <CallDataResult>item;

        status.Activity.forEach((activity) => {
          if (activity.Type === "User") {
            activity.StatusText = this.typesProvider.statusToTextConverter(
              activity.StatusId
            );
            activity.StatusColor = this.typesProvider.statusToColorConverter(
              activity.StatusId
            );
          } else {
            activity.StatusText = this.typesProvider.unitStatusToTextConverter(
              activity.StatusId
            );
            activity.StatusColor =
              this.typesProvider.unitStatusToColorConverter(activity.StatusId);
          }
        });

        return status;
      })
    );
  }

  public getCallNotes(callId: any): Observable<CallNoteResult[]> {
    let params = new HttpParams().append("callId", callId);

    return this.http
      .get<CallNoteResult[]>(
        environment.baseApiUrl +
          environment.resgridApiUrl +
          "/Calls/GetCallNotes",
        { params: params }
      )
      .pipe(
        map((items) => {
          return items;
        })
      );
  }

  public saveCallNote(
    callId: string,
    userId: string,
    note: string,
    location: GpsLocation
  ): Observable<Object> {
    let data = {
      CallId: callId,
      UserId: userId,
      Note: note,
    };

    if (location && location != null) {
      data["Lat"] = location.Latitude;
      data["Lon"] = location.Longitude;
    }

    return this.http.post(
      environment.baseApiUrl + environment.resgridApiUrl + "/Calls/AddCallNote",
      data
    );
  }

  public saveCallImage(
    callId: string,
    userId: string,
    note: string,
    name: string,
    location: GpsLocation,
    image: string
  ): Observable<Object> {
    let data = {
      Cid: callId,
      Uid: userId,
      Typ: 2,
      Nme: name,
      Lat: "",
      Lon: "",
      Not: note,
      Data: image,
    };

    if (location && location != null) {
      data["Lat"] = location.Latitude.toString();
      data["Lon"] = location.Longitude.toString();
    }

    return this.http.post(
      environment.baseApiUrl + environment.resgridApiUrl + "/Calls/UploadFile",
      data
    );
  }

  public saveCallFile(
    callId: string,
    userId: string,
    note: string,
    name: string,
    location: GpsLocation,
    file: string
  ): Observable<Object> {
    let data = {
      Cid: callId,
      Uid: userId,
      Typ: 3,
      Nme: name,
      Lat: "",
      Lon: "",
      Not: note,
      Data: file,
    };

    if (location && location != null) {
      data["Lat"] = location.Latitude.toString();
      data["Lon"] = location.Longitude.toString();
    }

    return this.http.post(
      environment.baseApiUrl + environment.resgridApiUrl + "/Calls/UploadFile",
      data
    );
  }

  public closeCall(
    callId: string,
    note: string,
    type: string
  ): Observable<Object> {
    return this.http.put(
      environment.baseApiUrl + environment.resgridApiUrl + "/Calls/CloseCall",
      {
        Id: callId,
        Msg: note,
        Typ: type,
      }
    );
  }

  public updateCall(
    callId: string,
    name: string,
    priority: number,
    type: string,
    contactName: string,
    contactInfo: string,
    externalId: string,
    incidentId: string,
    referenceId: string,
    nature: string,
    notes: string,
    address: string,
    w3w: string,
    latitude: number,
    longitude: number,
    dispatchList: string,
    dispatchOn: string,
    callFormData: string,
    redispatch: boolean
  ): Observable<Object> {
    let coordinates = "";
    if (latitude && latitude != 0 && longitude && longitude != 0) {
      coordinates = latitude + "," + longitude;
    }

    return this.http.put(
      environment.baseApiUrl + environment.resgridApiUrl + "/Calls/EditCall",
      {
        Id: callId,
        Pri: priority,
        Typ: type,
        CNme: contactName,
        CNum: contactInfo,
        EId: externalId,
        InI: incidentId,
        RId: referenceId,
        Nme: name,
        Noc: nature,
        Not: notes,
        Geo: coordinates,
        Add: address,
        W3W: w3w,
        Dis: dispatchList,
        Don: dispatchOn,
        Cfd: callFormData,
        RebroadcastCall: redispatch,
      }
    );
  }

  public getCallImages(
    callId: string,
    includeData: boolean
  ): Observable<CallFileResult[]> {
    return this.getFiles(callId, includeData, 2);
  }

  public getCallFiles(
    callId: string,
    includeData: boolean
  ): Observable<CallFileResult[]> {
    return this.getFiles(callId, includeData, 3);
  }

  public getCallAudio(
    callId: string,
    includeData: boolean
  ): Observable<CallFileResult[]> {
    return this.getFiles(callId, includeData, 1);
  }

  public getFiles(
    callId: string,
    includeData: boolean,
    type: number
  ): Observable<CallFileResult[]> {
    let params = new HttpParams()
      .append("callId", callId.toString())
      .append("includeData", includeData.toString())
      .append("type", type.toString());

    return this.http
      .get<CallFileResult[]>(
        environment.baseApiUrl +
          environment.resgridApiUrl +
          "/Calls/GetFilesForCall",
        { params: params }
      )
      .pipe(
        map((items) => {
          let files: CallFileResult[] = new Array<CallFileResult>();

          items.forEach((item) => {
            let file = <CallFileResult>item;
            files.push(file);
          });

          return files;
        })
      );
  }

  public getCallTypes(): Observable<CallTypeResult[]> {
    return this.http
      .get<CallTypeResult[]>(
        environment.baseApiUrl +
          environment.resgridApiUrl +
          "/Calls/GetCallTypes"
      )
      .pipe(
        map((items) => {
          let types: CallTypeResult[] = new Array<CallTypeResult>();

          types.push({
            Id: 0,
            Name: "No Type",
          });

          items.forEach((item) => {
            let type = <CallTypeResult>item;
            types.push(type);
          });

          return types;
        })
      );
  }

  public getCallPriorties(): Observable<CallPriorityResult[]> {
    return this.http.get<CallPriorityResult[]>(
      environment.baseApiUrl +
        environment.resgridApiUrl +
        "/CallPriorities/GetAllCallPriorites"
    );
  }

  public GetAllPendingScheduledCalls(): Observable<CallResult[]> {
    const url =
      environment.baseApiUrl +
      environment.resgridApiUrl +
      "/Calls/GetAllPendingScheduledCalls";

    return this.http.get<CallResult[]>(url).pipe(
      map((items) => {
        let statuses: CallResult[] = new Array<CallResult>();

        items.forEach((item) => {
          let status: CallResult = this.mapDataToCall(item);

          statuses.push(status);
        });

        return statuses;
      })
    );
  }

  public updateCallDisptachTime(
    callId: string,
    date: string
  ): Observable<Object> {
    return this.http.get(
      environment.baseApiUrl + environment.resgridApiUrl + `/Calls/UpdateScheduledDispatchTime?callId=${callId}&date=${date}`
    );
  }

  public deleteCall(
    callId: string
  ): Observable<Object> {
    return this.http.get(
      environment.baseApiUrl + environment.resgridApiUrl + `/Calls/DeleteCall?callId=${callId}`
    );
  }

  private mapDataToCall(item: any): CallResult {
    let status: CallResult = new CallResult();

    status.Cid = item.Cid;
    status.Pri = item.Pri;
    status.Ctl = item.Ctl;
    status.Nme = item.Nme;

    status.Noc = item.Noc;
    status.Map = item.Map;
    status.Not = item.Not;
    status.Add = item.Add;

    status.Geo = item.Geo;
    status.Lon = item.Lon;
    status.Utc = item.Utc;
    status.Ste = item.Ste;
    status.Num = item.Num;

    status.Nts = item.Nts;
    status.Aud = item.Aud;
    status.Img = item.Img;
    status.Fls = item.Fls;
    status.w3w = item.w3w;
    status.Aid = item.Aid;
    status.Typ = item.Typ;

    status.PriorityColor = this.typesProvider.priorityToColorConverter(
      status.Pri
    );
    status.PriorityText = this.typesProvider.priorityToTextConverter(
      status.Pri
    );

    status.LoggedOnDate = this.utilsProvider.formatDateForDisplay(
      new Date(item.Utc),
      "yyyy-MM-dd HH:mm"
    );
    status.DispatchOnDate = this.utilsProvider.formatDateForDisplay(
      new Date(item.Don),
      "yyyy-MM-dd HH:mm"
    );

    return status;
  }
}
