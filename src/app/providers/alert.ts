import { Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { AlertOptions } from '@ionic/core';

@Injectable({
  providedIn: 'root'
})
export class AlertProvider {
  private alert;

  constructor(public alertCtrl: AlertController) {

  }

  public async showOkAlert(title: string, subTitle: string) {
    this.alert = await this.alertCtrl.create({
      header: title,
      subHeader: subTitle,
      buttons: ['OK']
    });

    await this.alert.present();
  }
}
