import { AfterViewInit, ChangeDetectorRef, Component, OnInit, QueryList, ViewChildren } from "@angular/core";
import { Store } from "@ngrx/store";
import * as _ from "lodash";
import { CallsState } from "../../store/calls.store";
import * as CallsActions from "../../actions/calls.actions";
import { CallsSortableDirective, SortEvent } from "../../directives/calls-sortable.directive";
import { ScheduledCallsPageService } from "./scheduled.page.service";
import { UtilsProvider } from "src/app/providers/utils";
import { Router } from "@angular/router";

@Component({
  selector: "app-scheduled",
  templateUrl: "scheduled.page.html",
  styleUrls: ["scheduled.page.scss"],
})
export class ScheduledPage implements AfterViewInit {
  @ViewChildren(CallsSortableDirective) headers: QueryList<CallsSortableDirective>;
  public breadCrumbItems: Array<{}>;

  constructor(
    private store: Store<CallsState>,
    public service: ScheduledCallsPageService,
    public utilsProvider: UtilsProvider,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngAfterViewInit(): void {
    this.store.dispatch(new CallsActions.GetScheduledCalls());

    this.breadCrumbItems = [{ label: "Resgrid Dispatch" }, { label: "Scheduled Calls", active: true }];

    this.cdr.detectChanges();
  }

  onSort({ column, direction }: SortEvent) {
    // resetting other headers
    this.headers.forEach((header) => {
      if (header.sortable !== column) {
        header.direction = "";
      }
    });
    this.service.sortColumn = column;
    this.service.sortDirection = direction;
  }

  public editCall(callId: string) {
    this.router.navigate(["/calls/edit-call", callId, "1"]);
  }

  public updateDispatchTime(callId: string) {
    this.store.dispatch(new CallsActions.ShowUpdateCallDispatchTimeModal(callId));
  }
}

function SortableDirective(CallsSortableDirective: any) {
  throw new Error("Function not implemented.");
}
