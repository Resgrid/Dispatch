import { Injectable, Inject, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { APP_CONFIG_TOKEN, AppConfig } from '../config/app.config-interface';
import { StatusesInfo } from '../models/statusesInfo';
import { Consts } from '../consts';
import { StatusResult } from '../models/statusResult';
import { SubmitStatus } from '../models/submitStatus';
import { TypesProvider } from './types';
import { PubSubService } from '../components/pubsub/angular2-pubsub.service';
import { Subscription, Observable } from 'rxjs';
import { TimerObservable } from "rxjs/observable/TimerObservable";

@Injectable({
  providedIn: 'root'
})
export class StatusProvider implements OnDestroy {
  private currentStatusesInfo: StatusesInfo;
  private currentDestination: any;
  private cachedStatuses: SubmitStatus[];
  private subscription: Subscription;
  private timer;

  constructor(public http: HttpClient, private consts: Consts, private typesProvider: TypesProvider, private pubsub: PubSubService,
    @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig) {
    this.cachedStatuses = new Array<SubmitStatus>();
    this.pubsub.$sub(this.consts.EVENTS.STATUS_QUEUED).subscribe((e) => {
      this.processStatus(e);
    });

    this.timer = TimerObservable.create(5000, 30000);
    this.subscription = this.timer.subscribe(t => this.updatePending());
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  public getCurrentStatus(): Observable<StatusResult> {
    return this.http.get<StatusResult>(this.appConfig.ResgridApiUrl + '/Status/GetCurrentUserStatus')
      .map((item) => {
        let status = new StatusResult();
        status.Uid = item.Uid;
        status.Act = item.Act;
        status.Ats = item.Ats;

        status.Atxt = this.typesProvider.statusToTextConverter(item.Act);
        status.AClr = this.typesProvider.statusToColorConverter(item.Act);

        status.Ste = item.Ste;
        status.Sts = item.Uid;
        status.Did = item.Did;

        status.Stxt = this.typesProvider.staffingToTextConverter(item.Ste);
        status.SClr = this.typesProvider.staffingToColorConverter(item.Ste);

        return status;
      });
  }

  public setStatus(userId: string, type: number, geolocation: string, respondingTo: number, destionationType: number, note: string): void {
    let status = new SubmitStatus();
    status.Uid = userId;
    status.Typ = type;
    status.Geo = geolocation;

    if (respondingTo && respondingTo != 0) {
      status.Rto = respondingTo;
    }

    if (destionationType && destionationType != 0) {
      status.Dtp = destionationType;
    }
    status.Not = note;

    //this.smq.publish(this.consts.EVENTS.STATUS_QUEUED, status);
    this.processStatus(status);
  }

  public setWorkingStatus(statusInfo: StatusesInfo): void {
    this.currentStatusesInfo = statusInfo;
  }

  public getWorkingStatus(): StatusesInfo {
    return this.currentStatusesInfo;
  }

  public setWorkingDestination(id: Number, type: Number): void {
    this.currentDestination = {
      Id: id,
      Type: type
    };
  }

  public getWorkingDestination(): any {
    return this.currentDestination;
  }

  private processStatus(event: SubmitStatus) {
    if (event) {
      return this.http.put(this.appConfig.ResgridApiUrl + '/Status/SetStatusForUser', {
        Uid: event.Uid,
        Typ: event.Typ,
        Geo: event.Geo,
        Rto: event.Rto,
        Dtp: event.Dtp,
        Not: event.Not
      }).toPromise()
        .then(() => {
          event.Sent = true;
          this.pubsub.$pub(this.consts.EVENTS.STATUS_UPDATED, event);
        })
        .catch((error: Response | any) => {
          event.Sent = false;
          this.cachedStatuses.push(event);

          let errMsg: string;
          if (error instanceof Response) {

          } else {
            errMsg = error.message ? error.message : error.toString();
          }
          console.error(errMsg);
          return Observable.throw(errMsg);
        });
    } else if (event) {

    }
  }

  private updatePending() {
    this.cachedStatuses.forEach(status => {
      if (!status.Sent) {
        this.processStatus(status);
      }
    });
  }
}
