import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { environment } from '../environments/environment';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { StoreRouterConnectingModule } from '@ngrx/router-store';
import { metaReducers, reducers } from './store/reducers';
import { AuthModule } from './features/auth/auth.module';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { APP_CONFIG_TOKEN } from './config/app.config-interface';
import { AppConfigValues } from './config/app.config';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { SignalRModule, SignalRConfiguration } from 'ng2-signalr';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { ComponentsModule } from './components/components.module';
import { PubSubModule } from './components/pubsub/angular2-pubsub.module';

export function createTranslateLoader(http: HttpClient) {
  return new TranslateHttpLoader(http, 'assets/i18n/', '.json');
}

export function createConfig(): SignalRConfiguration {
  const c = new SignalRConfiguration();
  c.hubName = AppConfigValues.ChannelHubName;
  // c.qs = { };
  c.url = AppConfigValues.BaseApiUrl;
  // c.logging = true;

  // c.executeEventsInZone = true; // optional, default is true
  // c.executeErrorsInZone = false; // optional, default is false
  // c.executeStatusChangeInZone = true; // optional, default is true
  return c;
}

@NgModule({
  declarations: [AppComponent],
  entryComponents: [],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    HttpClientModule,
    AppRoutingModule,
    ComponentsModule,
    PubSubModule.forRoot(),
    StoreModule.forRoot(reducers, { metaReducers }),
    EffectsModule.forRoot([]),
    StoreRouterConnectingModule.forRoot(),
    StoreDevtoolsModule.instrument({
      maxAge: 10, // number of states to retain
      name: 'Resgrid Dispatch',
      logOnly: environment.production
    }),
    SignalRModule.forRoot(createConfig),
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient]
      }
    }),
    AuthModule
  ],
  providers: [
    StatusBar,
    SplashScreen,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: APP_CONFIG_TOKEN, useValue: AppConfigValues }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
