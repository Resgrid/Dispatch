import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { APP_CONFIG_TOKEN, AppConfig } from '../config/app.config-interface';
import { DepartmentRightsResult } from '../models/departmentRightsResult';
import { PubSubService } from '../components/pubsub/angular2-pubsub.service';
import { Consts } from '../consts';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SecurityProvider {
  private groupRights: any[];
  private departmentAdmin: boolean = false;
  private canCreateCalls: boolean = false;
  private canCreateNotes: boolean = false;
  private canViewPII: boolean = false;
  private canCreateMessages: boolean = false;
  private firebaseJWT: string;

  constructor(public http: HttpClient,
    private pubsub: PubSubService,
    private consts: Consts,
    @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig) {
    this.groupRights = new Array<any>();
    this.departmentAdmin = false;
    this.canCreateCalls = false;
    this.canCreateNotes = false;
    this.canViewPII = false;
    this.canCreateMessages = false;
  }

  public applySecurityRights() {
    this.http.get<DepartmentRightsResult>(this.appConfig.ResgridApiUrl + '/Security/GetCurrentUsersRights')
      .pipe(map((item) => { return item as DepartmentRightsResult; })).subscribe(
        data => {
          this.setRights(data);
        },
        err => {

        });
  }


  public setRights(data: DepartmentRightsResult) {
    this.departmentAdmin = data.Adm;
    this.groupRights = data.Grps;

    if (data.VPii) {
      this.canViewPII = true;
    }

    if (data.CCls) {
      this.canCreateCalls = true;
    }

    if (data.ANot) {
      this.canCreateNotes = true;
    }

    if (data.CMsg) {
      this.canCreateMessages = true;
    }

    if (data.Adm) {
      this.canViewPII = true;
      this.canCreateCalls = true;
      this.canCreateNotes = true;
      this.canCreateMessages = true;
    }

    if (data.FirebaseApiToken) {
      this.firebaseJWT = data.FirebaseApiToken;
    }

    this.pubsub.$pub(this.consts.EVENTS.SECURITY_SET, '');
  }

  public isUserDepartmentAdmin(): boolean {
    return this.departmentAdmin;
  }

  public isUserGroupAdmin(groupId): boolean {
    if (this.groupRights && this.groupRights.length > 0) {
      for (var i = 0; i < this.groupRights.length; i++) {
        if (this.groupRights[i].Gid === groupId) {
          return this.groupRights[i].Adm;
        }
      }
    }

    return false;
  }

  public canUserCreateCalls(): boolean {
    return this.canCreateCalls;
  }

  public canUserCreateNotes(): boolean {
    return this.canCreateNotes;
  }

  public canUserCreateMessages(): boolean {
    return this.canCreateMessages;
  }

  public canUserViewPII(): boolean {
    return this.canViewPII;
  }

  public getFirebaseJWT(): string {
    return this.firebaseJWT;
  }
}
