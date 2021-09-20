import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { MobileCarriersResult } from '../core/models/mobileCarriersResult';
import { ProfileResult } from '../core/models/profileResult';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ProfileProvider {

  constructor(public http: HttpClient) {
  }

  public getProfile(): Observable<ProfileResult> {
    return this.http.get<ProfileResult>(environment.baseApiUrl + environment.resgridApiUrl + '/Profile/GetProfile')
      .pipe(map((item) => {
        let profile: ProfileResult = item as ProfileResult;

        return profile;
      }));
  }

  public getMobileCarriers(): Observable<MobileCarriersResult[]> {
    return this.http.get<MobileCarriersResult[]>(environment.baseApiUrl + environment.resgridApiUrl + '/Profile/GetMobileCarriers')
      .pipe(map((items) => {
        return items as MobileCarriersResult[];
      }));
  }

  public updateProfile(profile: ProfileResult): Observable<object> {

    const updateProfile = {
      Id: profile.Id,
      FirstName: profile.Fnm,
      LastName: profile.Lnm,
      Email: profile.Eml,
      // HomePhone: this.profile.Hmn,
      MobilePhone: profile.Mob,
      MobileCarrier: profile.Moc,
      SendCallSms: profile.Scs,
      SendCallPush: profile.Scp,
      SendCallEmail: profile.Sce,
      SendMessageSms: profile.Sms,
      SendMessagePush: profile.Smp,
      SendMessageEmail: profile.Sme,
      SendNotificationSms: profile.Sns,
      SendNotificationPush: profile.Snp,
      SendNotificationEmail: profile.Sne
    }

    return this.http.post(environment.baseApiUrl + environment.resgridApiUrl + '/Profile/UpdateProfile', updateProfile);
  }

  public toggleCustomSounds(enableCustomSounds: boolean): Observable<object> {
    const params = new HttpParams().append('enableCustomPushSounds', enableCustomSounds.toString());

    return this.http.get(environment.baseApiUrl + environment.resgridApiUrl + '/Profile/ToggleCustomPushSounds', { params });
  }
}
