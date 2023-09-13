import * as authAction from "../actions/auth.actions";
import { Action } from "@ngrx/store";
import { Actions, Effect, ofType } from "@ngrx/effects";
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
  // Listen for the 'LOGIN' action
  @Effect()
  login$: Observable<Action> = this.actions$.pipe(
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
        catchError(() => of({ type: authAction.LoginActionTypes.LOGIN_FAIL })),
      ),
    ),
  );

  /* Pass { dispatch: false } to the decorator to prevent dispatching.
  Sometimes you don't want effects to dispatch an action, for example when you only want to log or navigate.
  But when an effect does not dispatch another action, the browser will crash because the effect is both 'subscribing' to and 'dispatching'
  the exact same action, causing an infinite loop. To prevent this, add { dispatch: false } to the decorator. */
  @Effect({ dispatch: false })
  loginSuccess$ = this.actions$.pipe(
    ofType(authAction.LoginActionTypes.LOGIN_SUCCESS),
    tap(() => {
      this.loadingProvider.hide();
      this.router.navigate(["/home"]);
    }),
  );

  @Effect({ dispatch: false })
  loginDone$ = this.actions$.pipe(
    ofType<authAction.LoginDone>(authAction.LoginActionTypes.LOGIN_DONE),
    tap((action) => {
      console.log(action);
    }),
  );

  @Effect({ dispatch: false })
  loginFail$ = this.actions$.pipe(
    ofType<authAction.LoginDone>(authAction.LoginActionTypes.LOGIN_FAIL),
    tap(async (action) => {
      console.log(action);
      this.loadingProvider.hide();
      await this.alertProvider.showErrorAlert(
        "Login Error",
        "",
        "There was an issue trying to log you in, please check your username and password and try again.",
      );
    }),
  );

  @Effect({ dispatch: false })
  loggingIn$ = this.actions$.pipe(
    ofType<authAction.IsLogin>(authAction.LoginActionTypes.IS_LOGIN),
    tap((action) => {
      this.loadingProvider.show();
    }),
  );

  constructor(
    private actions$: Actions,
    private authProvider: AuthProvider,
    private router: Router,
    private loadingProvider: LoadingProvider,
    private alertProvider: AlertProvider,
  ) {}
}
