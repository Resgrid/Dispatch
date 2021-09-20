import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthState } from 'src/app/features/auth/store/auth.store';
import { Observable, of } from 'rxjs';
import { Store } from '@ngrx/store';
import { UtilsProvider } from 'src/app/providers/utils';
import { selectAuthState } from 'src/app/store';
import { map, catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
    public authInfo$: Observable<AuthState | null>;

    constructor(private router: Router, private store: Store<AuthState>) {
        this.authInfo$ = this.store.select(selectAuthState);
    }

    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> | boolean {
        return this.authInfo$
            .pipe(
                map((user: AuthState) => {
                    if (user && user.loggedIn) {
                        return true;
                    } else {
                        this.router.navigate([''], { queryParams: { returnUrl: state.url } });
                        return false;
                    }
                }),
                catchError((caught): Observable<boolean> => {
                    this.router.navigate([''], { queryParams: { returnUrl: state.url } });
                    return of(false);
                })
            );
    }
}