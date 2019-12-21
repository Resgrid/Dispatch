import { Component, Inject } from '@angular/core';
import { Platform } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { Router } from '@angular/router';
import { APP_CONFIG_TOKEN, AppConfig } from './config/app.config-interface';
import { SettingsProvider } from './providers/settings';
import { Store } from '@ngrx/store';
import { AppState } from './store/appState';
import { Observable } from 'rxjs';
import { AuthState } from './features/auth/store/auth.store';
import { State, selectAuthState } from './store';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss']
})
export class AppComponent {
  public authInfo$: Observable<AuthState | null>;

  constructor(
    private platform: Platform,
    private splashScreen: SplashScreen,
    private statusBar: StatusBar,
    private router: Router,
    private store: Store<State>,
    @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig
  ) {
    this.initializeApp();
  }

  public appPages = [
    {
      title: 'Home',
      icon: 'home',
      active: true
    },
    {
      title: 'My Wallet',
      icon: 'wallet'
    },
    {
      title: 'Settings',
      icon: 'settings'
    },
    {
      title: 'Logout',
      icon: 'log-out'
    },
  ];

  initializeApp() {
    this.platform.ready().then(() => {
      this.statusBar.styleDefault();
      this.splashScreen.hide();

      this.authInfo$ = this.store.select(selectAuthState);
    });
  }

  public navViewProfile() {

  }

  public openPage(page) {
    this.router.navigate([page]).then(
      response => {
        console.log('Response ' + response);
      },
      error => {
        console.log('Error: ' + error);
      }
    ).catch(exception => {
      console.log('Exception ' + exception);
    });
  }
}
