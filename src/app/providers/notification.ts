import { Injectable } from '@angular/core';
import { Notifying } from '../components/notifying/notifying';
import { ModalController, ToastController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class NotificationProvider {
  constructor(private modalCtrl: ModalController, private toastCtrl: ToastController) {
  }

  public showErrorDialog(title: string, message: string) {
    let errorNotify = this.modalCtrl.create(Notifying,
      {
        type: 'error',
        title: title,
        message: message,
        textOk: 'Try again',
        isConfirm: function () {
          // write here your code of function
        }
      }
    );
    errorNotify.present();
  }

  public showInfoDialog(title: string, message: string) {
    let infoNotify = this.modalCtrl.create(Notifying,
      {
        type: 'info',
        title: title,
        message: message,
        textOk: 'Okay',
        isConfirm: function () {
          // write here your code of function
        }
      }
    );
    infoNotify.present();
  }

  public showToastMessage(message) {
    let toast = this.toastCtrl.create({
      message: message,
      duration: 3000,
      position: 'top',
      showCloseButton: true,
      closeButtonText: 'Ok'
    });

    toast.onDidDismiss(() => {

    });

    toast.present();
  }
}