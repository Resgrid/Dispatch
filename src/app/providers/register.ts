import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { EmailCheckResult } from '../core/models/emailCheckResult';
import { DepartmentCheckResult } from '../core/models/departmentCheckResult';
import { UsernameCheckResult } from '../core/models/usernameCheckResult';
import { DepartmentCreationResult } from '../core/models/departmentCreationResult';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class RegisterProvider {

  constructor(public http: HttpClient) {

  }

  public isEmailAddressInUse(emailAddress: string): Observable<EmailCheckResult> {
    const params = new HttpParams().append('emailAddress', encodeURIComponent(emailAddress));

    return this.http.get<EmailCheckResult>(environment.baseApiUrl + environment.baseApiUrl + '/DepartmentRegistration/CheckIfEmailInUse', { params })
      .pipe(map((item) => {
        return item as EmailCheckResult;
      }));
  }

  public isDepartmentNameInUse(departmentName: string): Observable<DepartmentCheckResult> {
    const params = new HttpParams().append('departmentName', encodeURIComponent(departmentName));

    return this.http.get<DepartmentCheckResult>(environment.baseApiUrl + environment.baseApiUrl + '/DepartmentRegistration/CheckIfDepartmentNameUsed', { params })
      .pipe(map((item) => {
        return item as DepartmentCheckResult;
      }));
  }

  public isUserNameInUse(userName: string): Observable<UsernameCheckResult> {
    const params = new HttpParams().append('userName', encodeURIComponent(userName));

    return this.http.get<UsernameCheckResult>(environment.baseApiUrl + environment.baseApiUrl + '/DepartmentRegistration/CheckIfUserNameUsed', { params })
      .pipe(map((item) => {
        return item as UsernameCheckResult;
      }));
  }

  public registerDepartment(fullName: string, email: string, userName: string, password: string,
                            departmentName: string, departmentType: string): Observable<DepartmentCreationResult> {
    return this.http.post(environment.baseApiUrl + environment.baseApiUrl + '/DepartmentRegistration/Register', {
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
