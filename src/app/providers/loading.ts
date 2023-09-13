import { Injectable } from "@angular/core";
import { NgxSpinnerService } from "ngx-spinner";
import { from, Observable } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class LoadingProvider {
  constructor(private spinner: NgxSpinnerService) {}

  // Show loading
  public show() {
    return this.spinner.show();
  }

  // Hide loading
  public hide() {
    return this.spinner.hide();
  }
}
