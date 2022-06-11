import { Injectable } from "@angular/core";
import { Geocoder } from "@maptiler/geocoder";
import { GpsLocation, ResgridConfig, WindowRef } from "@resgrid/ngx-resgridlib";
import { bindCallback, ConnectableObservable, from, Observable, of, ReplaySubject, throwError } from "rxjs";
import { map, shareReplay, switchMap, publish, publishReplay, refCount } from "rxjs/operators";
import { environment } from "src/environments/environment";
//import { Loader } from "@googlemaps/js-api-loader"

@Injectable({
  providedIn: "root",
})
export class GeocodingProvider {
  protected readonly geocoder$: Observable<google.maps.Geocoder>;

  constructor(loader: LazyGoogleMapsLoader) {
    const connectableGeocoder$ = new Observable((subscriber) => {
      loader.load().then(() => subscriber.next());
    }).pipe(
      map(() => this._createGeocoder()),
      publishReplay(1)
    ) as ConnectableObservable<google.maps.Geocoder>;

    connectableGeocoder$.connect(); // ignore the subscription
    // since we will remain subscribed till application exits

    this.geocoder$ = connectableGeocoder$;
  }

  private _createGeocoder() {
    return new google.maps.Geocoder();
  }

  private _getGoogleResults(
    geocoder: google.maps.Geocoder,
    request: google.maps.GeocoderRequest
  ): Observable<google.maps.GeocoderResult[]> {
    //const loader = new Loader({
    //  apiKey: "YOUR_API_KEY",
   //   version: "weekly"
    //});
    
    //loader.load().then(() => {
    // 
    //});

    const geocodeObservable = bindCallback(geocoder.geocode);
    return geocodeObservable(request).pipe(
      switchMap(([results, status]) => {
        if (status === google.maps.GeocoderStatus.OK) {
          return of(results);
        }

        return throwError(status);
      })
    );
  }

  private geocode(request: google.maps.GeocoderRequest): Observable<google.maps.GeocoderResult[]> {
    return this.geocoder$.pipe(
      switchMap((geocoder) => this._getGoogleResults(geocoder, request))
    );
  }

  public getAddressFromLocation(location: GpsLocation) {
    return this.geocode({ location: new google.maps.LatLng(location.Latitude, location.Longitude) }).pipe(
      map((data) => {
        if (data && data.length > 0) {
          //console.log(JSON.stringify(data));
          return data[0].formatted_address;
        }

        return null;
      })
    );
  }

  public getLocationFromAddress(address: string) {
    return this.geocode({ address: address }).pipe(
      map((data) => {
        if (data && data.length > 0) {
          return new GpsLocation(
            data[0].geometry.location.lat(),
            data[0].geometry.location.lng()
          );
        }

        return null;
      })
    );



    var geocoder = new Geocoder({
      key: environment.osmMapKey,
    });
    const that = this;

    //from(
    //  geocoder.geocode(address).then(function (results) {
    //    console.log(JSON.stringify(results));
    //    //console.log(results.features[0]);
    //    //return results;
    //    return that.parseMapTilerResults(results);
    //  })
    //);

    return new Observable((observer) => {
      geocoder.geocode(address).then(function (results) {
        if (results) {
          console.log(JSON.stringify(results));
          //console.log(results.features[0]);
          //return results;
          //return that.parseMapTilerResults(results);
          let gpsLocation = that.parseMapTilerResults(results);
          observer.next(gpsLocation);
          observer.complete();
        } else {
          observer.error("No results");
        }
      });
    });
  }

  private parseMapTilerResults(results: any): GpsLocation | null {
    if (results && results.features && results.features.length > 0) {

      for (let index = 0; index < results.features.length; index++) {
        const feature = results.features[index];
        
        if (this.doesMapTilerPlaceTypeContain("street", feature.place_type)) {
          if (feature.center && feature.center.length === 2) {
            return new GpsLocation(feature.center[1], feature.center[0]);
          }
        }
      }
    }

    return null;
  }

  private doesMapTilerPlaceTypeContain(searchFor: string, placeTypes: any[]) {
    if (searchFor && placeTypes && placeTypes.length > 0) {
      return placeTypes.find((placeType) => {
        return placeType === searchFor;
      });
    }
  }
}

@Injectable({
  providedIn: 'root',
})
export class LazyGoogleMapsLoader {
  protected _scriptLoadingPromise: any;
  protected readonly _SCRIPT_ID: string = 'googleMapsApiScript';
  protected readonly callbackName: string = `lazyMapsAPILoader`;

  constructor(private config: ResgridConfig) {

  }

  load(): Promise<void> {
    //const window = this._windowRef.nativeWindow() as any;
    if (window.google && window.google.maps) {
      // Google maps already loaded on the page.
      return Promise.resolve();
    }

    if (this._scriptLoadingPromise) {
      return this._scriptLoadingPromise;
    }

    // this can happen in HMR situations or Stackblitz.io editors.
    const scriptOnPage = document
      .getElementById(this._SCRIPT_ID);
    if (scriptOnPage) {
      this._assignScriptLoadingPromise(scriptOnPage);
      return this._scriptLoadingPromise;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.defer = true;
    script.id = this._SCRIPT_ID;
    script.src = this._getScriptSrc(this.callbackName);
    this._assignScriptLoadingPromise(script);
    document.body.appendChild(script);
    return this._scriptLoadingPromise;
  }

  private _assignScriptLoadingPromise(scriptElem: HTMLElement) {
    this._scriptLoadingPromise = new Promise((resolve, reject) => {
      window[this.callbackName] = () => {
        resolve(true);
      };

      scriptElem.onerror = (error: any) => {
        reject(error);
      };
    });
  }

  protected _getScriptSrc(callbackName: string): string {
    const hostAndPath: string = 'maps.googleapis.com/maps/api/js';
    const queryParams: { [key: string]: string | string[] } = {
      v: 'quarterly',
      callback: callbackName,
      key: this.config.googleApiKey,
      //client: this._config.clientId,
      //channel: this._config.channel,
      //libraries: this._config.libraries,
      //region: this._config.region,
      language: 'en-US',
    };
    const params: string = Object.keys(queryParams)
      .filter((k: string) => queryParams[k] != null)
      .filter((k: string) => {
        // remove empty arrays
        return (
          !Array.isArray(queryParams[k]) ||
          (Array.isArray(queryParams[k]) && queryParams[k].length > 0)
        );
      })
      .map((k: string) => {
        // join arrays as comma seperated strings
        const i = queryParams[k];
        if (Array.isArray(i)) {
          return { key: k, value: i.join(',') };
        }
        return { key: k, value: queryParams[k] };
      })
      .map((entry: { key: string; value: string | string[] }) => {
        return `${entry.key}=${entry.value}`;
      })
      .join('&');
    return `https://${hostAndPath}?${params}`;
  }
}