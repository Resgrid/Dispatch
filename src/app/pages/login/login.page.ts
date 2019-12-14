import { Component, OnInit } from '@angular/core';
import { MenuController, LoadingController, Platform, AlertController } from '@ionic/angular';

@Component({
    selector: 'app-login',
    templateUrl: './login.page.html',
    styleUrls: ['./login.page.scss'],
  })
  export class LoginPage implements OnInit {

    email = '';
    password = '';

    constructor(private platform: Platform, public loadingController: LoadingController,
        private alertController: AlertController, private menuCtrl: MenuController) {
    }

    ngOnInit() {
    }

    ionViewDidEnter() {
      this.menuCtrl.enable(true, 'start');
      this.menuCtrl.enable(true, 'end');
    }
  }
