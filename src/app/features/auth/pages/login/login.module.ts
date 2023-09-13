import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { NgbAlertModule } from "@ng-bootstrap/ng-bootstrap";
import { LoginPage } from "./login.page";
import { BrowserModule } from "@angular/platform-browser";

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    NgbAlertModule,
    ReactiveFormsModule,
    RouterModule.forChild([
      {
        path: "",
        component: LoginPage,
      },
    ]),
  ],
  declarations: [LoginPage],
})
export class LoginPageModule {}
