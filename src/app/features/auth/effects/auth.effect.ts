import * as authAction from "../actions/auth.actions";
import { Action } from "@ngrx/store";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { AuthProvider } from "../providers/auth";
import { catchError, map, mergeMap, tap } from "rxjs/operators";
import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { Router } from "@angular/router";
import { LoadingProvider } from "src/app/providers/loading";
import { AlertProvider } from "src/app/providers/alert";

@Injectable()
export class AuthEffects {
  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType<authAction.Login>(authAction.LoginActionTypes.LOGIN),
      mergeMap((action) =>
        this.authProvider.login(action.payload.username, action.payload.password).pipe(
          // If successful, dispatch success action with result
          map((data) => ({
            type: authAction.LoginActionTypes.LOGIN_SUCCESS,
            user: {
              userId: data.sub,
              emailAddress: data.Rights.EmailAddress,
              fullName: data.Rights.FullName,
              departmentId: data.Rights.DepartmentId,
              departmentName: data.Rights.DepartmentName,
            },
          })),
          tap((data) => {
            this.authProvider.startTrackingRefreshToken();
          }),
          // If request fails, dispatch failed action
          catchError(() => of({ type: authAction.LoginActionTypes.LOGIN_FAIL }))
        )
      )
    )
  );

  loginSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(authAction.LoginActionTypes.LOGIN_SUCCESS),
        tap(() => {
          this.loadingProvider.hide();
          this.router.navigate(["/home"]);
        })
      ),
    { dispatch: false }
  );

  loginDone$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<authAction.LoginDone>(authAction.LoginActionTypes.LOGIN_DONE),
        tap((action) => {
          console.log(action);
        })
      ),
    { dispatch: false }
  );

  loginFail$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<authAction.LoginDone>(authAction.LoginActionTypes.LOGIN_FAIL),
        tap(async (action) => {
          console.log(action);
          this.loadingProvider.hide();
          await this.alertProvider.showErrorAlert(
            "Login Error",
            "",
            "There was an issue trying to log you in, please check your username and password and try again."
          );
        })
      ),
    { dispatch: false }
  );

  loggingIn$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType<authAction.IsLogin>(authAction.LoginActionTypes.IS_LOGIN),
        tap((action) => {
          this.loadingProvider.show();
        })
      ),
    { dispatch: false }
  );

  constructor(
    private actions$: Actions,
    private authProvider: AuthProvider,
    private router: Router,
    private loadingProvider: LoadingProvider,
    private alertProvider: AlertProvider
  ) {}
}
