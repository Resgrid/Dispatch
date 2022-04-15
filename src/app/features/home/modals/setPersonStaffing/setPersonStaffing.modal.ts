import { Component, Input, OnInit } from "@angular/core";
import { NgbModal, NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { Store } from "@ngrx/store";
import { Observable } from "rxjs";
import { selectHomeState, selectIsSavingUnitState } from "src/app/store";
import { HomeState } from "../../store/home.store";
import * as HomeActions from "../../actions/home.actions";
import { take } from "rxjs/operators";
import { Actions, ofType } from "@ngrx/effects";
import { CallResultData, CustomStatesService, CustomStatusResultData, GroupResultData } from "@resgrid/ngx-resgridlib";

@Component({
  selector: "app-resgrid-modal-setPersonStaffing",
  templateUrl: "setPersonStaffing.modal.html",
  styleUrls: ["setPersonStaffing.modal.scss"],
})
export class SetPersonStaffingModalComponent implements OnInit {
  public homeState$: Observable<HomeState | null>;

  public selectedStatus: CustomStatusResultData;

  public selectedCall: CallResultData;
  public selectedStation: GroupResultData;
  public selectedDestination: any;
  public note: string;
  public isSaving: boolean = false;

  constructor(
    public activeModal: NgbActiveModal,
    private store: Store<HomeState>,
    private actions$: Actions
  ) {
    this.homeState$ = this.store.select(selectHomeState);
  }

  ngOnInit() {

  }

  public dismiss() {
    this.activeModal.close();
  }

  public save() {
    if (this.selectedStatus) {
      this.isSaving = true;

      this.store
        .select(selectHomeState)
        .pipe(take(1))
        .subscribe((state) => {
          var userIds: string[] = [];
          state.personnelForGrid.forEach(person => {
            if (person.Selected) {
              userIds.push(person.UserId);
            }
          });

          const setUnitStatusData = {
            userIds: userIds,
            staffingType: this.selectedStatus.Id,
            note: this.note,
            date: new Date(),
          };

          this.store.dispatch(new HomeActions.SavingPersonStaffing(setUnitStatusData));
        });
    }
  }
}
