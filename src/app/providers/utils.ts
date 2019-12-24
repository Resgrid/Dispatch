import { Injectable } from '@angular/core';
import { Platform, NavController } from '@ionic/angular';
import { Router } from '@angular/router';

@Injectable({
    providedIn: 'root'
})
export class UtilsProvider {
    private monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    private monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    constructor(private platform: Platform, private nav: NavController, private router: Router) {

    }

    public isDevice(): boolean {
        if (window['cordova']) {
            return true;
        }

        return false;
    }

    public isIOS(): boolean {
        if (!this.isDevice()) {
            return false;
        }

        if (this.platform.is('ios')) {
            return true;
        }

        return false;
    }

    public isAndroid(): boolean {
        if (!this.isDevice()) {
            return false;
        }

        if (this.platform.is('android')) {
            return true;
        }

        return false;
    }

    public navigate(link, forward?) {
        if (forward) {
            this.nav.navigateForward('/' + link);
        } else {
            this.router.navigateByUrl('/' + link);
        }
    }

    public to2Digit(str: string): string {
        if (!str) { return null; }

        const isString: boolean = (typeof str == 'string');
        if (isString && str.length == 1) {
            str = 0 + str;
        }
        return str;
    }

    public parseDateISOString(s) {
        let b = s.split(/\D/);
        return new Date(b[0], b[1] - 1, b[2], b[3], b[4], b[5]);
    }

    public getDate(date: string) {
        if (!date) {
            return 'Unknown';
        }

        const d = new Date(date);
        const datestring = ('0' + d.getDate()).slice(-2) + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
            d.getFullYear() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);

        return datestring;
    }

    public formatDateForDisplay(date: Date, format) {
        // Original idea from: https://weblog.west-wind.com/posts/2008/Mar/18/A-simple-formatDate-function-for-JavaScript

        if (!format) {
            format = 'MM/dd/yyyy';
        }

        const month = date.getMonth() + 1;
        const year = date.getFullYear();

        if (format.indexOf('MMMM') > -1) {
            format = format.replace('MMMM', this.monthNames[date.getMonth()]);
        } else if (format.indexOf('MMM') > -1) {
            format = format.replace('MMM', this.monthShortNames[date.getMonth()]);
        } else if (format.indexOf('MM') > -1) {
            format = format.replace('MM', this.padLeadingZero(month));
        }

        if (format.indexOf('yyyy') > -1) {
            format = format.replace('yyyy', year.toString());
        } else if (format.indexOf('yy') > -1) {
            format = format.replace('yy', year.toString().substr(2, 2));
        }

        format = format.replace('dd', this.padLeadingZero(date.getDate()));

        let hours = date.getHours();
        if (format.indexOf('t') > -1) {
            if (hours > 11) {
                format = format.replace('t', 'pm')
            } else {
                format = format.replace('t', 'am')
            }
        }
        if (format.indexOf('HH') > -1) {
            format = format.replace('HH', this.padLeadingZero(hours));
        }

        if (format.indexOf('hh') > -1) {
            if (hours > 12) {
                hours - 12;
            }

            if (hours === 0) {
                hours = 12;
            }
            format = format.replace('hh', this.padLeadingZero(hours));
        }
        if (format.indexOf('mm') > -1) {
            format = format.replace('mm', this.padLeadingZero(date.getMinutes()));
        }

        if (format.indexOf('ss') > -1) {
            format = format.replace('ss', this.padLeadingZero(date.getSeconds()));
        }
        if (format.indexOf('dd') > -1) {
            format = format.replace('ss', this.padLeadingZero(date.getDay()));
        }
        if (format.indexOf('Z') > -1) {
            let timeZone = '';
            try {
                // Chrome, Firefox
                timeZone = /.*\s(.+)/.exec((new Date()).toLocaleDateString(navigator.language, { timeZoneName: 'short' }))[1];
            } catch (e) {
                // IE, some loss in accuracy due to guessing at the abbreviation
                // Note: This regex adds a grouping around the open paren as a
                //       workaround for an IE regex parser bug
                timeZone = (new Date()).toTimeString().match(new RegExp('[A-Z](?!.*[\(])', 'g')).join('');
            }

            format = format.replace('Z', timeZone);
        }

        return format;
    }

    public formatDateString(date: Date) {
        const day = date.getDate();       	// yields date
        const month = (date.getMonth() + 1);    // yields month (add one as '.getMonth()' is zero indexed)
        const year = date.getFullYear();  	// yields year
        const hour = date.getHours();     	// yields hours
        const minute = date.getMinutes(); 	// yields minutes
        const second = date.getSeconds(); 	// yields seconds
        let timeZone = '';

        /*
        try {
            // Chrome, Firefox
            timeZone = /.*\s(.+)/.exec((new Date()).toLocaleDateString(navigator.language, { timeZoneName:'short' }))[1];
        } catch(e) {
            // IE, some loss in accuracy due to guessing at the abbreviation
            // Note: This regex adds a grouping around the open paren as a
            //       workaround for an IE regex parser bug
            timeZone = (new Date()).toTimeString().match(new RegExp('[A-Z](?!.*[\(])','g')).join('');
        }
        */

        timeZone = this.createDateUTCOffset(date);

        const time = this.padLeadingZero(month) + '/' + this.padLeadingZero(day) + '/' + year + ' ' +
            this.padLeadingZero(hour) + ':' + this.padLeadingZero(minute) + ':' + this.padLeadingZero(second) + ' ' + timeZone;

        return time;
    }

    public padLeadingZero(value) {
        return value < 10 ? '0' + value : value;
    }

    private createDateUTCOffset(date) {
        const sign = (date.getTimezoneOffset() > 0) ? '-' : '+';
        const offset = Math.abs(date.getTimezoneOffset());
        const hours = this.padLeadingZero(Math.floor(offset / 60));
        const minutes = this.padLeadingZero(offset % 60);
        return sign + hours + ':' + minutes;
    }

    public addDaysToDate(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    public subtractDaysFromDate(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() - days);
        return result;
    }

    public getTimeAgo(time) {
        if (!time) {
            return 'Unknown';
        }

        switch (typeof time) {
            case 'number':
                break;
            case 'string':
                time = +new Date(time);
                break;
            case 'object':
                if (time.constructor === Date) {
                    time = time.getTime();
                }
                break;
            default:
                time = +new Date();
        }

        const timeFormats = [
            [60, 'seconds', 1], // 60
            [120, '1 minute ago', '1 minute from now'], // 60*2
            [3600, 'minutes', 60], // 60*60, 60
            [7200, '1 hour ago', '1 hour from now'], // 60*60*2
            [86400, 'hours', 3600], // 60*60*24, 60*60
            [172800, 'Yesterday', 'Tomorrow'], // 60*60*24*2
            [604800, 'days', 86400], // 60*60*24*7, 60*60*24
            [1209600, 'Last week', 'Next week'], // 60*60*24*7*4*2
            [2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
            [4838400, 'Last month', 'Next month'], // 60*60*24*7*4*2
            [29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
            [58060800, 'Last year', 'Next year'], // 60*60*24*7*4*12*2
            [2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
            [5806080000, 'Last century', 'Next century'], // 60*60*24*7*4*12*100*2
            [58060800000, 'centuries', 2903040000] // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
        ];
        var seconds = (+new Date() - time) / 1000,
            token = 'ago',
            list_choice = 1;

        if (seconds == 0) {
            return 'Just now';
        }
        if (seconds < 0) {
            seconds = Math.abs(seconds);
            token = 'from now';
            list_choice = 2;
        }
        let i = 0,
            format;
        while (format = timeFormats[i++]) {
            if (seconds < format[0]) {
                if (typeof format[2] === 'string') {
                    return format[list_choice];
                } else {
                    return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ' + token;
                }
            }
        }
        return time;
    }

    public getTimeAgoUtc(time) {
        if (!time) {
            return 'Unknown';
        }

        switch (typeof time) {
            case 'number':
                break;
            case 'string':
                time = +new Date(time);
                break;
            case 'object':
                if (time.constructor === Date) {
                    time = time.getTime();
                }
                break;
            default:
                time = +new Date();
        }

        const currentDate = new Date();
        time = Number((new Date(time).getTime() + 0 * 60 * 1000));

        const timeFormats = [
            [60, 'seconds', 1], // 60
            [120, '1 minute ago', '1 minute from now'], // 60*2
            [3600, 'minutes', 60], // 60*60, 60
            [7200, '1 hour ago', '1 hour from now'], // 60*60*2
            [86400, 'hours', 3600], // 60*60*24, 60*60
            [172800, 'Yesterday', 'Tomorrow'], // 60*60*24*2
            [604800, 'days', 86400], // 60*60*24*7, 60*60*24
            [1209600, 'Last week', 'Next week'], // 60*60*24*7*4*2
            [2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
            [4838400, 'Last month', 'Next month'], // 60*60*24*7*4*2
            [29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
            [58060800, 'Last year', 'Next year'], // 60*60*24*7*4*12*2
            [2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
            [5806080000, 'Last century', 'Next century'], // 60*60*24*7*4*12*100*2
            [58060800000, 'centuries', 2903040000] // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
        ];
        let seconds = (Number((new Date(currentDate).getTime() + new Date(currentDate).getTimezoneOffset() * 60 * 1000)) - time) / 1000,
            token = 'ago',
            list_choice = 1;

        if (seconds == 0) {
            return 'Just now'
        }
        if (seconds < 0) {
            seconds = Math.abs(seconds);
            token = 'from now';
            list_choice = 2;
        }
        let i = 0,
            format;
        while (format = timeFormats[i++]) {
            if (seconds < format[0]) {
                if (typeof format[2] == 'string') {
                    return format[list_choice];
                } else {
                    return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ' + token;
                }
            }
        }
        return time;
    }
}
