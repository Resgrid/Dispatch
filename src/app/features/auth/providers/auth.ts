import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthValidateResult } from '../models/authValidateResult';
import { Observable } from 'rxjs';
import { AuthModule } from '../auth.module';
import { environment } from '../../../../environments/environment';

@Injectable({
  // providedIn: AuthModule
  providedIn: 'root'
})
export class AuthProvider {

  constructor(private http: HttpClient) { }

  public login(username: string, password: string): Observable<AuthValidateResult> {
    return this.http.post<AuthValidateResult>(environment.baseApiUrl + environment.resgridApiUrl + '/Auth/Validate', {
      usr: username,
      Pass: password
    });
  }

  public loginToDepartment(username: string, password: string, departmentId: number): Observable<AuthValidateResult> {
    return this.http.post<AuthValidateResult>(environment.baseApiUrl + environment.resgridApiUrl + '/Auth/ValidateForDepartment', {
      usr: username,
      Pass: password,
      Did: departmentId
    });
  }
}
