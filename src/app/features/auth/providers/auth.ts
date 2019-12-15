import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { APP_CONFIG_TOKEN, AppConfig } from '../../../config/app.config-interface';
import { AuthValidateResult } from '../models/authValidateResult';
import { Observable } from 'rxjs';
import { AuthModule } from '../auth.module';

@Injectable({
  // providedIn: AuthModule
  providedIn: 'root'
})
export class AuthProvider {

  constructor(private http: HttpClient,
              @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig) { }

  public login(username: string, password: string): Observable<AuthValidateResult> {
    return this.http.post<AuthValidateResult>(this.appConfig.ResgridApiUrl + '/Auth/Validate', {
      usr: username,
      Pass: password
    });
  }

  public loginToDepartment(username: string, password: string, departmentId: number): Observable<AuthValidateResult> {
    return this.http.post<AuthValidateResult>(this.appConfig.ResgridApiUrl + '/Auth/ValidateForDepartment', {
      usr: username,
      Pass: password,
      Did: departmentId
    });
  }
}
