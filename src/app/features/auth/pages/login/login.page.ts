import { Component, OnInit } from '@angular/core';
import { MenuController, LoadingController, Platform, AlertController } from '@ionic/angular';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { selectIsLoginState, selectLoginState } from 'src/app/store';
import * as AuthActions from '../../actions/auth.actions';
import { LoadingProvider } from 'src/app/providers/loading';
import { AuthState } from '../../store/auth.store';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  loginForm: FormGroup;
  error$ = null;
  isLogging$ = false;

  constructor(private fb: FormBuilder, private store: Store<AuthState>,
    private loadingProvider: LoadingProvider, private menuCtrl: MenuController) {
  }

  ngOnInit() {
    this
      .store
      .select(selectIsLoginState)
      .subscribe(res => {
        this.isLogging$ = res;
      });
    this.loginForm = this
      .fb
      .group({
        username: [
          '', Validators.required
        ],
        password: [
          '',
          [Validators.required]
        ]
      });
  }

  ionViewDidEnter() {
    this.menuCtrl.enable(false, 'start');
    this.menuCtrl.enable(false, 'end');
  }

  login(formData) {
    this.store.dispatch(new AuthActions.IsLogin());

    const authData = {
      username: formData.username.trim(),
      password: formData.password.trim()
    };

    this.store.dispatch(new AuthActions.Login(authData));

    this.store
      .select(selectIsLoginState)
      .subscribe(res => {
        this.isLogging$ = res;
      });

    this.store
      .select(selectLoginState)
      .subscribe(res => {
        if (res) {
          this.error$ = res;
        }
      });
  }
}
