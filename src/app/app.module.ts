import { BrowserModule } from '@angular/platform-browser';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { HttpClientModule, HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';

import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { environment } from '../environments/environment';

import { LayoutsModule } from './layouts/layouts.module';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NgxPubSubModule } from '@pscoped/ngx-pub-sub';
import { NgxSpinnerModule } from "ngx-spinner";
//import { ErrorInterceptor } from './core/helpers/error.interceptor';
/*import { JwtInterceptor } from './core/helpers/jwt.interceptor';*/
import { DirectivesModule } from './directives/directives.module';
import { StoreModule } from '@ngrx/store';

import { metaReducers, reducers } from './store/reducers';
import { EffectsModule } from '@ngrx/effects';
import { StoreRouterConnectingModule } from '@ngrx/router-store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { HttpInterceptorModule } from './core/interceptors/http.interceptor.module';
import { AuthModule } from './features/auth/auth.module';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { AgmCoreModule } from '@agm/core';
import { VoiceModule } from './features/voice/voice.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

export function createTranslateLoader(http: HttpClient): any {
  return new TranslateHttpLoader(http, 'assets/i18n/', '.json');
}

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    DirectivesModule,
    HttpInterceptorModule,
    BrowserAnimationsModule,
    NgxPubSubModule,
    LeafletModule,
    NgxSpinnerModule,
    StoreModule.forRoot(reducers, { metaReducers }),
    AgmCoreModule.forRoot({apiKey: environment.googleMapsKey}),
    EffectsModule.forRoot([]),
    StoreRouterConnectingModule.forRoot(),
    StoreDevtoolsModule.instrument({
      maxAge: 10, // number of states to retain
      name: 'Resgrid Dispatch',
      logOnly: environment.production
    }),
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient]
      }
    }),
    AuthModule,
    VoiceModule,
    LayoutsModule
  ],
  providers: [
    //{ provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },
    //{ provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
    //{ provide: HTTP_INTERCEPTORS, useClass: FakeBackendInterceptor, multi: true },
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  bootstrap: [AppComponent]
})
export class AppModule { }
