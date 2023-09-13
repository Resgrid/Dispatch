import { Injectable, Inject } from "@angular/core";
import { combineLatest, concat, Observable, of } from "rxjs";
import { AuthService, ProfileModel, SecurityService } from "@resgrid/ngx-resgridlib";
import { concatMap, flatMap, map, mergeMap } from "rxjs/operators";
import { LoginResult } from "src/app/core/models/loginResult";

@Injectable({
  providedIn: "root",
})
export class AuthProvider {
  constructor(
    private authProvider: AuthService,
    private securityService: SecurityService,
  ) {}

  //public login(username: string, password: string): Observable<ProfileModel> {
  //  return this.authProvider.login({username: username, password: password, refresh_token: ''});
  // }

  public login(username: string, password: string): Observable<LoginResult> {
    const login = this.authProvider.login({
      username: username,
      password: password,
      refresh_token: "",
    });
    const getDepartmentRights = this.securityService.applySecurityRights();

    return login.pipe(
      mergeMap((loginResult) => {
        return combineLatest([of(loginResult), getDepartmentRights]);
      }),
      map(([loginResult, rightsResult]) => {
        let result: LoginResult = loginResult as LoginResult;
        result.Rights = rightsResult.Data;

        return result;
      }),
    );
  }

  public startTrackingRefreshToken(): void {
    this.authProvider.init();
  }
}
