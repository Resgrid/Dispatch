import { Injectable, OnInit } from "@angular/core";
import { NgxPubSubService } from "@pscoped/ngx-pub-sub";
import { Consts } from '../consts';

@Injectable({
  providedIn: "root",
})
export class PubSubProvider implements OnInit {
  constructor(private pubsubSvc: NgxPubSubService, private consts: Consts) {}

  ngOnInit(): void {
    this.pubsubSvc.registerEventWithLastValue(this.consts.EVENTS.LOGGED_IN, undefined);
    this.pubsubSvc.registerEventWithLastValue(this.consts.EVENTS.SYSTEM_READY, undefined);
    this.pubsubSvc.registerEventWithLastValue(this.consts.EVENTS.COREDATASYNCED, undefined);
    this.pubsubSvc.registerEventWithLastValue(this.consts.EVENTS.LOCAL_DATA_SET, undefined);
    this.pubsubSvc.registerEventWithLastValue(this.consts.EVENTS.SETTINGS_SAVED, undefined);
    this.pubsubSvc.registerEventWithLastValue(this.consts.EVENTS.STATUS_UPDATED, undefined);
    this.pubsubSvc.registerEventWithLastValue(this.consts.EVENTS.STAFFING_UPDATED, undefined);
    this.pubsubSvc.registerEventWithLastValue(this.consts.EVENTS.SECURITY_SET, undefined);
  }
}
