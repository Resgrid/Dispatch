// From https://github.com/Mohammed9531/ngx-digital-clock

import { Subscription, timer } from 'rxjs';
import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { DAYS_SHORT, CLASS_LIST } from './calendar.constants';
import { UtilsProvider } from 'src/app/providers/utils';

@Component({
  selector: 'app-digital-clock',
  templateUrl: './digital-clock.component.html',
  styleUrls: ['./digital-clock.component.scss']
})
export class DigitalClockComponent implements OnInit, OnDestroy {
  /**
   * @public
   * @type: string
   */
  public today: string;
  /**
   * @public
   * @type: string[]
   */
  public borders: string[];
  /**
   * @public
   * @type: string
   */
  public monthYear: string;
  /**
   * @public
   * @type: string
   */
  public meridian: string;
  /**
   * @public
   * @type: boolean
   */
  @Input()
  public displayDots: boolean = false;
  /**
   * @public
   * @type: string[]
   */
  public days: string[] = DAYS_SHORT;
  /**
   * @public
   * @type: string[]
   */
  public timeFormatList: string[] = [];
  /**
   * @public
   * @type: Subscription[]
   */
  public subscriptions: Subscription[] = [];

  /**
   * @constructor
   * @param: {util<UtilService>}
   */
  constructor(private util: UtilsProvider) {
    this.borders = 'd1 d2 d3 d4 d5 d6 d7'.split(' ');
    this._init();
  }

  /**
   * @public
   * @type: method<life cycle hook>
   * @return: void
   * @description: N/A
   */
  public ngOnInit(): void {
    this.subscriptions.push(
      timer(0, 1000)
        .subscribe((t) => {
          this._init();
        })
    );
  }

  /**
   * @private
   * @return: void
   * @description: a helper method that initializes
   * the digital clock.
   */
  private _init(): void {
    const now: Date = new Date();
    const t: string[] = now.toLocaleTimeString().split(' ');

    if (Array.isArray(t) && t[0]) {
      let digits: any = t[0]
        .split(':')
        .map(v => this.util.to2Digit(v))
        .join(':')
        .split('');

      this.timeFormatList = [];
      for (const i of digits) {
        this.timeFormatList.push(CLASS_LIST[i]);
      }

      // run the other options.
      this._run(t[1]);
    }
  }

  /**
   * @private
   * @return: void
   * @description: a helper method that initializes
   * the calendar.
   */
  private _run(_meridian: string): void {
    const d: string[] = (new Date())
      .toDateString()
      .split(' ');

    // toggles the dots
    this.displayDots = !this.displayDots;

    // sets the day today
    this.today = (d[0] || '').toUpperCase();

    // sets the month & year
    this.monthYear = `${d[1]} ${d[2]}, ${d[3]}`;

    // sets am/pm
    this.meridian = (_meridian || '').toUpperCase();
  }

  /**
   * @public
   * @type: method<life cycle hook>
   * @return: void
   * @description: N/A
   */
  public ngOnDestroy(): void {
    for (let subscription of this.subscriptions) {
      if (!!subscription) {
        subscription.unsubscribe();
      }
    }
  }
}