import { Component, Input, OnInit } from "@angular/core";
import { NgbModal, NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { Store } from "@ngrx/store";
import { Observable } from "rxjs";
import {
  selectAuthState,
  selectHomeState,
  selectIsSavingUnitState,
} from "src/app/store";
import { HomeState } from "../../store/home.store";
import * as HomeActions from "../../actions/home.actions";
import { take } from "rxjs/operators";
import { Actions, ofType } from "@ngrx/effects";
import * as _ from "lodash";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { environment } from "../../../../../environments/environment";
import { AuthState } from "src/app/features/auth/store/auth.store";
import { CallResultData } from '@resgrid/ngx-resgridlib';

@Component({
  selector: "app-resgrid-modal-callNotes",
  templateUrl: "callNotes.modal.html",
  styleUrls: ["callNotes.modal.scss"],
})
export class CallNotesModalComponent implements OnInit {
  public homeState$: Observable<HomeState | null>;
  public selectedCallStatus: string = "1";
  public selectedCall: CallResultData;
  public note: string;
  public isSaving: boolean = false;
  @Input() auth: AuthState;
  public formData: FormGroup;

  constructor(
    public activeModal: NgbActiveModal,
    private store: Store<HomeState>,
    private actions$: Actions,
    public formBuilder: FormBuilder,
    private authStore: Store<AuthState>
  ) {
    this.homeState$ = this.store.select(selectHomeState);

    this.formData = this.formBuilder.group({
      message: ["", [Validators.required]],
    });
  }

  ngOnInit() {
    this.authStore
      .select(selectAuthState)
      .pipe(take(1))
      .subscribe((s) => (this.auth = s));

    this.store
      .select(selectHomeState)
      .pipe(take(1))
      .subscribe((state) => {
        this.selectedCall = _.find(state.calls, ["Selected", true]);
      });
  }

  public get form() {
    return this.formData.controls;
  }

  public getAvatarUrl(userId) {
    return (
      environment.baseApiUrl +
      environment.resgridApiUrl +
      "/Avatars/Get?id=" +
      userId
    );
  }

  public dismiss() {
    this.activeModal.close();
  }

  public save() {
    this.isSaving = true;
    this.store.dispatch(
      new HomeActions.SaveCallNote(
        this.selectedCall.CallId,
        this.form["message"].value,
        this.auth.user.userId
      )
    );
  }
}
