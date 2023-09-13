import { Component, OnInit, Inject, Output, EventEmitter, Input } from "@angular/core";
import { DOCUMENT } from "@angular/common";
import { CookieService } from "ngx-cookie-service";
import { Router } from "@angular/router";

import { LanguageService } from "../../../core/services/language.service";
import { environment } from "../../../../environments/environment";
import { AuthState } from "src/app/features/auth/store/auth.store";
import { Store } from "@ngrx/store";
import { take } from "rxjs/operators";
import { selectAuthState } from "src/app/store";

@Component({
  selector: "app-topbar",
  templateUrl: "./topbar.component.html",
  styleUrls: ["./topbar.component.scss"],
})
export class TopbarComponent implements OnInit {
  @Input() auth: AuthState;

  element: any;
  configData: any;
  cookieValue;
  flagvalue;
  countryName;
  valueset: string;

  listLang = [
    { text: "English", flag: "assets/images/flags/us.jpg", lang: "en" },
    //{ text: 'Spanish', flag: 'assets/images/flags/spain.jpg', lang: 'es' },
    //{ text: 'German', flag: 'assets/images/flags/germany.jpg', lang: 'de' },
    //{ text: 'Italian', flag: 'assets/images/flags/italy.jpg', lang: 'it' },
    //{ text: 'Russian', flag: 'assets/images/flags/russia.jpg', lang: 'ru' },
  ];

  // tslint:disable-next-line: max-line-length
  constructor(
    @Inject(DOCUMENT) private document: any,
    private router: Router,
    public languageService: LanguageService,
    public cookiesService: CookieService,
    private authStore: Store<AuthState>,
  ) {}

  @Output() mobileMenuButtonClicked = new EventEmitter();
  @Output() settingsButtonClicked = new EventEmitter();

  ngOnInit(): void {
    this.authStore
      .select(selectAuthState)
      .pipe(take(1))
      .subscribe((s) => (this.auth = s));

    this.element = document.documentElement;
    this.configData = {
      suppressScrollX: true,
      wheelSpeed: 0.3,
    };

    this.cookieValue = this.cookiesService.get("lang");
    const val = this.listLang.filter((x) => x.lang === this.cookieValue);
    this.countryName = val.map((element) => element.text);
    if (val.length === 0) {
      if (this.flagvalue === undefined) {
        this.valueset = "assets/images/flags/us.jpg";
      }
    } else {
      this.flagvalue = val.map((element) => element.flag);
    }
  }

  /**
   * Toggle the menu bar when having mobile screen
   */
  toggleMobileMenu(event: any) {
    event.preventDefault();
    this.mobileMenuButtonClicked.emit();
  }

  /**
   * Toggles the right sidebar
   */
  toggleRightSidebar() {
    this.settingsButtonClicked.emit();
  }

  /**
   * Translate language
   */
  setLanguage(text: string, lang: string, flag: string) {
    this.countryName = text;
    this.flagvalue = flag;
    this.cookieValue = lang;
    this.languageService.setLanguage(lang);
  }

  /**
   * Logout the user
   */
  logout() {
    this.router.navigate(["/auth/login"]);
  }

  navToEditProfile() {
    this.router.navigate(["/profile/edit-profile"]);
  }

  getAvatarUrl() {
    return environment.baseApiUrl + environment.resgridApiUrl + "/Avatars/Get?id=" + this.auth?.user?.userId;
  }
}
