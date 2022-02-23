import { Injectable, PipeTransform } from "@angular/core";
import { DecimalPipe } from "@angular/common";

import { BehaviorSubject, Observable, of, Subject } from "rxjs";
import { debounceTime, delay, switchMap, tap } from "rxjs/operators";
import * as CallsActions from "../../actions/calls.actions";
import { SortDirection } from "../../directives/calls-sortable.directive";
import { Store } from "@ngrx/store";
import { CallsState } from "../../store/calls.store";
import { selectCallsState } from "src/app/store";
import { CallResultData } from '@resgrid/ngx-resgridlib';
import { CallLocalResult } from "src/app/core/models/callLocalResult";

// Search Data
export interface SearchResult {
  calls: CallLocalResult[];
  total: number;
}

interface State {
  page: number;
  pageSize: number;
  searchTerm: string;
  sortColumn: string;
  sortDirection: SortDirection;
  startIndex: number;
  endIndex: number;
  totalRecords: number;
}

function compare(v1, v2) {
  return v1 < v2 ? -1 : v1 > v2 ? 1 : 0;
}

/**
 * Sort the table data
 * @param orders Table field value
 * @param column Fetch the column
 * @param direction Sort direction Ascending or Descending
 */
function sort(
  calls: CallLocalResult[],
  column: string,
  direction: string
): CallLocalResult[] {
  if (direction === "") {
    return calls;
  } else {
    return [...calls].sort((a, b) => {
      const res = compare(a[column], b[column]);
      return direction === "asc" ? res : -res;
    });
  }
}

/**
 * Table Data Match with Search input
 * @param tables Table field value fetch
 * @param term Search the value
 */
function matches(call: CallLocalResult, term: string) {
  return (
    call.Name.toLowerCase().includes(term) ||
    call.Nature.toLowerCase().includes(term) ||
    call.Note.toLowerCase().includes(term) ||
    call.Number.toLowerCase().includes(term) ||
    call.PriorityText.toLowerCase().includes(term)
  );
}

@Injectable({
  providedIn: "root",
})
export class ScheduledCallsPageService {
  // tslint:disable-next-line: variable-name
  private _loading$ = new BehaviorSubject<boolean>(true);
  // tslint:disable-next-line: variable-name
  private _search$ = new Subject<void>();
  // tslint:disable-next-line: variable-name
  private _calls$ = new BehaviorSubject<CallLocalResult[]>([]);
  private _total$ = new BehaviorSubject<number>(0);
  private _storeCalls$: Observable<CallLocalResult[] | null>;
  private _pendingCalls: CallLocalResult[] = new Array();

  // tslint:disable-next-line: variable-name
  private _state: State = {
    page: 1,
    pageSize: 10,
    searchTerm: "",
    sortColumn: "",
    sortDirection: "",
    startIndex: 1,
    endIndex: 10,
    totalRecords: 0,
  };

  constructor(private store: Store<CallsState>) {
    this.store.select(selectCallsState).subscribe((state) => {
      if (state.pendingScheduledCalls) {
        this._pendingCalls = state.pendingScheduledCalls;
        this._search();
      }
    });

    this._search$
      .pipe(
        tap(() => this._loading$.next(true)),
        debounceTime(200),
        switchMap(() => this._search()),
        delay(200),
        tap(() => this._loading$.next(false))
      )
      .subscribe((result) => {
        this._calls$.next(result.calls);
        this._total$.next(result.total);
      });

    this._search$.next();
    this.store.dispatch(new CallsActions.GetScheduledCalls());
  }

  /**
   * Returns the value
   */
  get calls$() {
    return this._calls$.asObservable();
  }
  get loading$() {
    return this._loading$.asObservable();
  }
  get total$() {
    return this._total$.asObservable();
  }
  get page() {
    return this._state.page;
  }
  get pageSize() {
    return this._state.pageSize;
  }
  get searchTerm() {
    return this._state.searchTerm;
  }
  get startIndex() {
    return this._state.startIndex;
  }
  get endIndex() {
    return this._state.endIndex;
  }
  get totalRecords() {
    return this._state.totalRecords;
  }

  /**
   * set the value
   */
  // tslint:disable-next-line: adjacent-overload-signatures
  set page(page: number) {
    this._set({ page });
  }
  // tslint:disable-next-line: adjacent-overload-signatures
  set pageSize(pageSize: number) {
    this._set({ pageSize });
  }
  // tslint:disable-next-line: adjacent-overload-signatures
  // tslint:disable-next-line: adjacent-overload-signatures
  set startIndex(startIndex: number) {
    this._set({ startIndex });
  }
  // tslint:disable-next-line: adjacent-overload-signatures
  set endIndex(endIndex: number) {
    this._set({ endIndex });
  }
  // tslint:disable-next-line: adjacent-overload-signatures
  set totalRecords(totalRecords: number) {
    this._set({ totalRecords });
  }
  // tslint:disable-next-line: adjacent-overload-signatures
  set searchTerm(searchTerm: string) {
    this._set({ searchTerm });
  }
  set sortColumn(sortColumn: string) {
    this._set({ sortColumn });
  }
  set sortDirection(sortDirection: SortDirection) {
    this._set({ sortDirection });
  }

  private _set(patch: Partial<State>) {
    Object.assign(this._state, patch);
    this._search$.next();
  }

  /**
   * Search Method
   */
  private _search(): Observable<SearchResult> {
    const { sortColumn, sortDirection, pageSize, page, searchTerm } =
      this._state;

    // 1. sort
    let calls = sort(this._pendingCalls, sortColumn, sortDirection);

    if (!calls) {
      calls = new Array();
    }

    // 2. filter
    calls = calls.filter((table) => matches(table, searchTerm));
    const total = calls.length;

    // 3. paginate
    this.totalRecords = calls.length;
    this._state.startIndex = (page - 1) * this.pageSize + 1;
    this._state.endIndex = (page - 1) * this.pageSize + this.pageSize;
    if (this.endIndex > this.totalRecords) {
      this.endIndex = this.totalRecords;
    }
    calls = calls.slice(this._state.startIndex - 1, this._state.endIndex);

    return of({ calls, total });
  }
}
