import { Injectable } from '@angular/core';
import { LoadingController } from '@ionic/angular';
import { LoadingOptions, SpinnerTypes } from '@ionic/core';

@Injectable({
  providedIn: 'root'
})
export class LoadingProvider {
  private spinner = {
    message: 'Please wait...'
  };
  private loading;

  constructor(public loadingController: LoadingController) {

  }

  // Show loading
  public async show() {
    if (!this.loading) {
      this.loading = await this.loadingController.create(this.spinner);
      this.loading.present();
    }
  }

  // Hide loading
  public hide() {
    if (this.loading) {
      this.loading.dismiss();
      this.loading = null;
    }
  }
}
