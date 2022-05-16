import { Component, Input, OnInit } from "@angular/core";
import { NgbModal, NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { Store } from "@ngrx/store";
import { Observable, Subscription } from "rxjs";
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
import { CallResultData, FormResult, FormResultData } from '@resgrid/ngx-resgridlib';
declare var $: any;

@Component({
  selector: "app-resgrid-modal-callForm",
  templateUrl: "callForm.modal.html",
  styleUrls: ["callForm.modal.scss"],
})
export class CallFormModalComponent implements OnInit {
  public homeState$: Observable<HomeState | null>;
  public selectedCallStatus: string = "1";
  public selectedCall: CallResultData;
  public note: string;
  public isSaving: boolean = false;
  @Input() auth: AuthState;
  public formData: FormGroup;
  public searchTerm: string;
  public fileName = "";
  public uploadProgress: number;
  public uploadSub: Subscription;
  public newCallForm: FormResultData = null;
  private formRender: any;

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
        if (state && state.newCallForm && state.newCallForm.Data) {
          this.newCallForm =  state.newCallForm;
          var callData = state.newCallForm.Data;
          this.formRender = $(document.getElementById("fb-reader")).formRender({ dataType: 'json', formData: callData });
        }
      });
  }

  public get form() {
    return this.formData.controls;
  }

  public dismiss() {
    this.activeModal.close();
  }

  public save() {
    if (this.formRender) {
      var userData =  JSON.stringify(this.formRender.userData);

      this.store.dispatch(
        new HomeActions.SetNewCallFormData(userData)
      );
    }
  }
}
