import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthState } from '../features/auth/store/auth.store';
import { UtilsProvider } from '../providers/utils';
import { Observable, of } from 'rxjs';
import { selectAuthState } from '../store';
import { map, catchError } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class GuardsService implements CanActivate {
    public authInfo$: Observable<AuthState | null>;

    constructor(private util: UtilsProvider, private store: Store<AuthState>) {
        this.authInfo$ = this.store.select(selectAuthState);
    }

    canActivate(route: ActivatedRouteSnapshot): Observable<boolean> | boolean {
        return this.authInfo$
            .pipe(
                map((user: AuthState) => {
                    if (user && user.loggedIn) {
                        return true;
                    } else {
                        this.util.navigate('');
                        return false;
                    }
                }),
                catchError(() => {
                    this.util.navigate('');
                    return of(false);
                })
            );
    }
}
