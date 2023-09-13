import { BrowserModule } from "@angular/platform-browser";
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from "@angular/core";
import { HttpClientModule, HTTP_INTERCEPTORS, HttpClient } from "@angular/common/http";
import { TranslateHttpLoader } from "@ngx-translate/http-loader";
import { environment } from "../environments/environment";
import { LayoutsModule } from "./layouts/layouts.module";
import { NgxResgridLibModule } from "@resgrid/ngx-resgridlib";
import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { NgxSpinnerModule } from "ngx-spinner";
import { StoreModule } from "@ngrx/store";
import { metaReducers, reducers } from "./store/reducers";
import { EffectsModule } from "@ngrx/effects";
import { StoreRouterConnectingModule } from "@ngrx/router-store";
import { StoreDevtoolsModule } from "@ngrx/store-devtools";
import { AuthModule } from "./features/auth/auth.module";
import { LeafletModule } from "@asymmetrik/ngx-leaflet";
import { VoiceModule } from "./features/voice/voice.module";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { MappingModule } from "./features/mapping/mapping.module";
import { TranslateModule, TranslateLoader } from "@ngx-translate/core";

export function createTranslateLoader(http: HttpClient): any {
  return new TranslateHttpLoader(http, "assets/i18n/", ".json");
}

let getBaseUrl = (): string => {
  const storedValue = localStorage.getItem(`RgDispatchApp.serverAddress`);

  if (storedValue) {
    return JSON.parse(storedValue).trim();
  }
  return environment.baseApiUrl;
};

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    NgxResgridLibModule.forRoot({
      baseApiUrl: getBaseUrl,
      apiVersion: "v4",
      clientId: "RgDispatchApp",
      googleApiKey: environment.googleMapsKey,
      channelUrl: environment.channelUrl,
      channelHubName: environment.channelHubName,
      logLevel: environment.logLevel,
      isMobileApp: false,
    }),
    BrowserAnimationsModule,
    LeafletModule,
    NgxSpinnerModule,
    StoreModule.forRoot(reducers, { metaReducers }),
    EffectsModule.forRoot([]),
    StoreRouterConnectingModule.forRoot(),
    StoreDevtoolsModule.instrument({
      maxAge: 10, // number of states to retain
      name: "Resgrid Dispatch",
      logOnly: environment.production,
    }),
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient],
      },
    }),
    AuthModule,
    VoiceModule,
    LayoutsModule,
    MappingModule,
  ],
  providers: [
    //{ provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },
    //{ provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
    //{ provide: HTTP_INTERCEPTORS, useClass: FakeBackendInterceptor, multi: true },
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  bootstrap: [AppComponent],
})
export class AppModule {}
