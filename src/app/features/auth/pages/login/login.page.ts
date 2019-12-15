import { Component, OnInit } from '@angular/core';
import { MenuController, LoadingController, Platform, AlertController } from '@ionic/angular';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { AuthState } from '../../reducers/auth.reducer';
import { selectIsLoginState } from 'src/app/store';
import * as AuthActions from '../../actions/auth.actions';

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
    private platform: Platform, public loadingController: LoadingController,
    private alertController: AlertController, private menuCtrl: MenuController) {
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
        account: [
          '', Validators.required
        ],
        password: [
          '',
          [Validators.required]
        ]
      });
  }

  ionViewDidEnter() {
    this.menuCtrl.enable(true, 'start');
    this.menuCtrl.enable(true, 'end');
  }

  login(formData) {
    this
      .store
      .dispatch(new AuthActions.IsLogin());

    const authData = {
      account: formData
        .account
        .trim(),
      password: formData
        .password
        .trim()
    };
  }
}
