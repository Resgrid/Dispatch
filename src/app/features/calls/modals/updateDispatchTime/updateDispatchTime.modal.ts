import { Component, Input, OnInit } from "@angular/core";
import { NgbModal, NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { Store } from "@ngrx/store";
import { Observable } from "rxjs";
import { selectCallsState } from "src/app/store";
import { take } from "rxjs/operators";
import { Actions, ofType } from "@ngrx/effects";
import * as _ from "lodash";
import { CallsState } from "../../store/calls.store";
import * as CallsActions from "../../actions/calls.actions";
import { UntypedFormBuilder, UntypedFormGroup, Validators } from "@angular/forms";

@Component({
  selector: "app-resgrid-modal-updateDispatchTime",
  templateUrl: "updateDispatchTime.modal.html",
  styleUrls: ["updateDispatchTime.modal.scss"],
})
export class UpdateDispatchTimeModalComponent implements OnInit {
  public callsState$: Observable<CallsState | null>;
  public updateCallForm: UntypedFormGroup;

  constructor(
    public activeModal: NgbActiveModal,
    private store: Store<CallsState>,
    private actions$: Actions,
    public formBuilder: UntypedFormBuilder,
  ) {
    this.callsState$ = this.store.select(selectCallsState);

    this.updateCallForm = this.formBuilder.group({
      dispatchOn: ["", Validators.required],
    });
  }

  ngOnInit() {}

  public dismiss() {
    this.activeModal.close();
  }

  get form() {
    return this.updateCallForm.controls;
  }

  public save() {
    this.store
      .select(selectCallsState)
      .pipe(take(1))
      .subscribe((state) => {
        this.store.dispatch(new CallsActions.IsUpdatingCallDispatchTime());

        const call = this.form;
        this.store.dispatch(new CallsActions.UpdateCallDispatchTime(state.callIdToUpdateDispatchTime, call["dispatchOn"].value));
      });
  }
}
