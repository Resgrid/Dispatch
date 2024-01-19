import { Action } from '@ngrx/store';
import { Actions, ofType } from '@ngrx/effects';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Router } from '@angular/router';
import { LoadingProvider } from 'src/app/providers/loading';
import { AlertProvider } from 'src/app/providers/alert';

@Injectable()
export class ProfileEffects {
 

  constructor(private actions$: Actions, 
    private router: Router, private loadingProvider: LoadingProvider, private alertProvider: AlertProvider) { }
}
