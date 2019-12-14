import { Component, Renderer } from '@angular/core';
import { NavController, NavParams, ViewController } from 'ionic-angular';

@Component({
  selector: 'notifying',
  templateUrl: 'notifying.html'
})
export class Notifying {

  // Variables
  type: string;
  image: string;
  title: string;
  message: string;
  textOk: string = 'Ok';
  textCancel: string = 'Cancel';
  buttons: string = '1';

  constructor(public navCtrl: NavController, public navParams: NavParams, public renderer: Renderer, public viewCtrl: ViewController) {
    this.renderer.setElementClass(viewCtrl.pageRef().nativeElement, 'my-popup', true);
    this.type = navParams.get('type');
    this.image = navParams.get('image');
    this.title = navParams.get('title');
    this.message = navParams.get('message');
    if (navParams.get('textOk') && navParams.get('textOk') != '') {
      this.textOk = navParams.get('textOk');
    }
    if (navParams.get('textCancel') && navParams.get('textCancel') != '') {
      this.textCancel = navParams.get('textCancel');
    }
    if (navParams.get('buttons') && navParams.get('buttons') != '') {
      this.buttons = navParams.get('buttons');
    }
  }

  isConfirm() {
    let data = { 'res': 'yes' }; // param for yes
    this.navParams.get('isConfirm')(); // exec function
    this.viewCtrl.dismiss(data); // dismiss with data
  }

  isCancel() {
    let data = { 'res': 'no' }; // param for No
    this.navParams.get('isCancel')(); // exec function
    this.viewCtrl.dismiss(data); // dismiss with data
  }

}
