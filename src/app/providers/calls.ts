import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { APP_CONFIG_TOKEN, AppConfig } from '../config/app.config-interface';

import { TypesProvider } from './types';
import { DataProvider } from './data';

import { CallDataResult } from '../models/callDataResult';
import { CallResult } from '../models/callResult';
import { CallFileResult } from '../models/callFileResult';
import { CallNoteResult } from '../models/callNoteResult';
import { CallTypeResult } from '../models/callTypeResult';
import { Location } from '../models/location';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
  })
export class CallsProvider {

	constructor(public http: HttpClient,
		private typesProvider: TypesProvider,
		@Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig,
		private dataProvider: DataProvider) {

	}

	public getActiveCalls(): Observable<CallResult[]> {
		const url = this.appConfig.ResgridApiUrl + '/Calls/GetActiveCalls';

		return this.http.get<CallResult[]>(url).pipe(map((items) => {
			let statuses: CallResult[] = new Array<CallResult>();

			items.forEach(item => {
				let status: CallResult = this.mapDataToCall(item);

				statuses.push(status);
			});

			return statuses;
		}));
	}

	public saveCall(priority, name, nature, gpsCoordinates, address): void {
		let url = this.appConfig.ResgridApiUrl + '/Calls/SaveCall';

		this.http.post(url, {
			Pri: priority,
			Nme: name,
			Noc: nature,
			Geo: gpsCoordinates,
			Add: address
		});
	}

	public getCall(callId: any): Observable<CallResult> {
		let url = this.appConfig.ResgridApiUrl + '/Calls/GetCall';

		let params = new HttpParams().append('callId', callId);

		//return this.http.get<CallResult>(url + "?callId=" + callId).map((item) => {
		return this.http.get<CallResult>(url, { params: params }).map((item) => {
			let status: CallResult = this.mapDataToCall(item);

			return status;
		});
	}

	public getCallData(callId: any): Observable<CallDataResult> {
		let url = this.appConfig.ResgridApiUrl + '/Calls/GetCallExtraData';

		let params = new HttpParams().append('callId', callId);

		return this.http.get(url, { params: params }).map((item) => {
			let status: CallDataResult = <CallDataResult>item;

			status.Activity.forEach(activity => {
				if (activity.Type === "User") {
					activity.StatusText = this.typesProvider.statusToTextConverter(activity.StatusId);
					activity.StatusColor = this.typesProvider.statusToColorConverter(activity.StatusId);
				} else {
					activity.StatusText = this.typesProvider.unitStatusToTextConverter(activity.StatusId);
					activity.StatusColor = this.typesProvider.unitStatusToColorConverter(activity.StatusId);
				}
			});


			return status;
		});
	}

	public getCallNotes(callId: any): Observable<CallNoteResult[]> {
		let params = new HttpParams().append('callId', callId);

		return this.http.get<CallNoteResult[]>(this.appConfig.ResgridApiUrl + '/Calls/GetCallNotes', { params: params })
			.map((items) => {
				let notes: CallNoteResult[] = new Array<CallNoteResult>();

				items.forEach(item => {
					let note = <CallNoteResult>item;

					let localPerson = this.dataProvider.getPerson(note.Uid);
					if (localPerson) {
						note.FullName = localPerson.Fnm + " " + localPerson.Lnm;
					}

					notes.push(note);
				});

				return notes;
			});
	}

	public saveCallNote(callId: number, userId: string, note: string, location: Location): Observable<Object> {

		let data = {
			CallId: callId,
			UserId: userId,
			Note: note
		}

		if (location && location != null) {
			data["Lat"] = location.Latitude;
			data["Lon"] = location.Longitude;
		}

		return this.http.post(this.appConfig.ResgridApiUrl + '/Calls/AddCallNote', data);
	}

	public saveCallImage(callId: number, userId: string, note: string, location: Location, image: string): Observable<Object> {

		let data = {
			Cid: callId,
			Uid: userId,
			Typ: 2,
			Nme: 'cameraPhoneUpload.png',
			Lat: '',
			Lon: '',
			Not: note,
			Data: image
		}

		if (location && location != null) {
			data["Lat"] = location.Latitude.toString();
			data["Lon"] = location.Longitude.toString();
		}

		return this.http.post(this.appConfig.ResgridApiUrl + '/Calls/UploadFile', data);
	}

	public closeCall(callId: number, note: string, type: string): Observable<Object> {
		return this.http.put(this.appConfig.ResgridApiUrl + '/Calls/CloseCall', {
			Id: callId,
			Msg: note,
			Typ: type
		});
	}

	public createCall(priority: string, type: string, name: string, nature: string, latitude: number,
		longitude: number, contactName: string, contactNumber: string, callId: string, address: string,
		what3words: string, dispatch: string): Observable<Object> {

		let coordinates = "";
		if (latitude && latitude != 0 && longitude && longitude != 0) {
			coordinates = latitude + "," + longitude;
		}

		return this.http.post(this.appConfig.ResgridApiUrl + '/Calls/SaveCall', {
			Pri: priority,
			Nme: name,
			Noc: nature,
			Geo: coordinates,
			Add: address,
			W3W: what3words,
			Cid: callId,
			Typ: type,
			Dis: dispatch,
			CNme: contactName,
			CNum: contactNumber
		});
	}

	public updateCall(callId: Number, name: string, nature: string, latitude: number,
		longitude: number, contactName: string, contactNumber: string, callNumber: string, address: string, note: string): Observable<Object> {
		let test = contactName + contactNumber + callNumber + note;
		if (test) {

		}

		let coordinates = "";
		if (latitude && latitude != 0 && longitude && longitude != 0) {
			coordinates = latitude + "," + longitude;
		}

		return this.http.put(this.appConfig.ResgridApiUrl + '/Calls/EditCall', {
			Cid: callId,
			Nme: name,
			Noc: nature,
			Add: address
		});
	}

	public getCallImages(callId: number, includeData: boolean): Observable<CallFileResult[]> {
		return this.getFiles(callId, includeData, 2);
	}

	public getCallFiles(callId: number, includeData: boolean): Observable<CallFileResult[]> {
		return this.getFiles(callId, includeData, 3);
	}

	public getCallAudio(callId: number, includeData: boolean): Observable<CallFileResult[]> {
		return this.getFiles(callId, includeData, 1);
	}

	public getFiles(callId: number, includeData: boolean, type: number): Observable<CallFileResult[]> {
		let params = new HttpParams().append('callId', callId.toString()).append('includeData', includeData.toString()).append('type', type.toString());

		return this.http.get<CallFileResult[]>(this.appConfig.ResgridApiUrl + '/Calls/GetFilesForCall', { params: params })
			.map((items) => {
				let files: CallFileResult[] = new Array<CallFileResult>();

				items.forEach(item => {
					let file = <CallFileResult>item;
					files.push(file);
				});

				return files;
			});
	}

	public getCallTypes(): Observable<CallTypeResult[]> {
		return this.http.get<CallTypeResult[]>(this.appConfig.ResgridApiUrl + '/Calls/GetCallTypes')
			.map((items) => {
				let types: CallTypeResult[] = new Array<CallTypeResult>();

				types.push({
					Id: 0,
					Name: "No Type"
				})

				items.forEach(item => {
					let type = <CallTypeResult>item;
					types.push(type);
				});

				return types;
			});
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

		status.PriorityColor = this.typesProvider.priorityToColorConverter(status.Pri);
		status.PriorityText = this.typesProvider.priorityToTextConverter(status.Pri);

		return status;
	}
}
