import { Injectable, NgModule } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest } from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SettingsProvider } from '../providers/settings';

@Injectable()
export class HttpsRequestInterceptor implements HttpInterceptor {
    constructor(private settingsProvider: SettingsProvider) { }

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const dupReq = req.clone({ headers: req.headers.set('Authorization', 'Basic ' + this.settingsProvider.getAuthToken()) });
        return next.handle(dupReq);
    }
}

@NgModule({
    providers: [
        { provide: HTTP_INTERCEPTORS, useClass: HttpsRequestInterceptor, multi: true }
    ]
})
export class HttpInterceptorModule { }
