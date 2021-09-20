import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class AlertProvider {
  private alert;

  constructor() {

  }

  public showOkAlert(title: string, subTitle: string, body: string) {
    Swal.fire({
      icon: 'success',
      title: title,
      text: body,
      showConfirmButton: true
    });
  }

  public showErrorAlert(title: string, subTitle: string, body: string) {
    Swal.fire({
      title: title,
      text: body,
      icon: 'error',
      showConfirmButton: true
    });
  }

  public showAutoCloseSuccessAlert(title: string) {
    Swal.fire({
      position: 'top-end',
      icon: 'success',
      title: title,
      showConfirmButton: false,
      timer: 500
    });
  }
}
