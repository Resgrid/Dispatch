import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { APP_CONFIG_TOKEN, AppConfig } from '../config/app.config-interface';
import { EmailCheckResult } from '../models/emailCheckResult';
import { DepartmentCheckResult } from '../models/departmentCheckResult';
import { UsernameCheckResult } from '../models/usernameCheckResult';
import { DepartmentCreationResult } from '../models/departmentCreationResult';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class RegisterProvider {

  constructor(public http: HttpClient, @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig) {

  }

  public isEmailAddressInUse(emailAddress: string): Observable<EmailCheckResult> {
    const params = new HttpParams().append('emailAddress', encodeURIComponent(emailAddress));

    return this.http.get<EmailCheckResult>(this.appConfig.BaseApiUrl + '/DepartmentRegistration/CheckIfEmailInUse', { params })
      .pipe(map((item) => {
        return item as EmailCheckResult;
      }));
  }

  public isDepartmentNameInUse(departmentName: string): Observable<DepartmentCheckResult> {
    const params = new HttpParams().append('departmentName', encodeURIComponent(departmentName));

    return this.http.get<DepartmentCheckResult>(this.appConfig.BaseApiUrl + '/DepartmentRegistration/CheckIfDepartmentNameUsed', { params })
      .pipe(map((item) => {
        return item as DepartmentCheckResult;
      }));
  }

  public isUserNameInUse(userName: string): Observable<UsernameCheckResult> {
    const params = new HttpParams().append('userName', encodeURIComponent(userName));

    return this.http.get<UsernameCheckResult>(this.appConfig.BaseApiUrl + '/DepartmentRegistration/CheckIfUserNameUsed', { params })
      .pipe(map((item) => {
        return item as UsernameCheckResult;
      }));
  }

  public registerDepartment(fullName: string, email: string, userName: string, password: string,
                            departmentName: string, departmentType: string): Observable<DepartmentCreationResult> {
    return this.http.post(this.appConfig.BaseApiUrl + '/DepartmentRegistration/Register', {
      FullName: fullName,
      Email: email,
      Username: userName,
      Password: password,
      DepartmentName: departmentName,
      DepartmentType: departmentType,
      AcceptedTos: true
    }).pipe(map((item) => {
      return item as DepartmentCreationResult;
    }));
  }
}
