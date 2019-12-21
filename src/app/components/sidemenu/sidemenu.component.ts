import { Component, OnInit, Inject, Input } from '@angular/core';
import { APP_CONFIG_TOKEN, AppConfig } from 'src/app/config/app.config-interface';
import { AuthState } from 'src/app/features/auth/store/auth.store';

@Component({
  selector: 'app-sidemenu',
  templateUrl: './sidemenu.component.html',
  styleUrls: ['./sidemenu.component.scss']
})
export class SidemenuComponent implements OnInit {
  @Input() auth: AuthState;

  public version: string = '1.0.0';

  public appPages = [
    {
      title: 'Home',
      icon: 'home',
      active: true
    },
    {
      title: 'Settings',
      icon: 'settings'
    },
    {
      title: 'Logout',
      icon: 'log-out'
    }
  ];
// img: this.appConfig.BaseApiUrl + '/api/v3/Avatars/Get?id=' + this.settingsProvider.settings.UserId,
  constructor(@Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig) {
    this.version = this.appConfig.Version;
  }

  ngOnInit() { }

}
