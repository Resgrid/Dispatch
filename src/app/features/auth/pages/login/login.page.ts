import { Component, OnInit } from "@angular/core";
import { UntypedFormGroup, UntypedFormBuilder, Validators } from "@angular/forms";
import { Store } from "@ngrx/store";
import { selectAuthState, selectIsLoginState, selectLoginState } from "src/app/store";
import * as AuthActions from "../../actions/auth.actions";
import { LoadingProvider } from "src/app/providers/loading";
import { AuthState } from "../../store/auth.store";
import { environment } from "../../../../../environments/environment";
import { Observable } from "rxjs";

@Component({
  selector: "app-login",
  templateUrl: "./login.page.html",
  styleUrls: ["./login.page.scss"],
})
export class LoginPage implements OnInit {
  loginForm: UntypedFormGroup;
  error$ = null;
  isLogging$ = false;
  year: number = new Date().getFullYear();
  public version: string;
  public authState$: Observable<AuthState | null>;

  constructor(
    private fb: UntypedFormBuilder,
    private store: Store<AuthState>,
  ) {
    this.authState$ = this.store.select(selectAuthState);
  }

  // convenience getter for easy access to form fields
  get f() {
    return this.loginForm.controls;
  }

  ngOnInit() {
    this.version = environment.version;
    document.body.removeAttribute("data-layout");
    document.body.classList.add("auth-body-bg");

    this.store.select(selectIsLoginState).subscribe((res) => {
      this.isLogging$ = res;
    });
    this.loginForm = this.fb.group({
      username: ["", Validators.required],
      password: ["", [Validators.required]],
    });
  }

  public currentYear() {
    return new Date().getFullYear();
  }

  public login() {
    this.store.dispatch(new AuthActions.IsLogin());

    const authData = {
      username: this.f.username.value.trim(),
      password: this.f.password.value.trim(),
    };

    this.store.dispatch(new AuthActions.Login(authData));

    this.store.select(selectIsLoginState).subscribe((res) => {
      this.isLogging$ = res;
    });

    this.store.select(selectLoginState).subscribe(async (res) => {
      if (res) {
        this.error$ = res;

        if (this.error$) {
          this.isLogging$ = false;
        }
      }
    });
  }
}
