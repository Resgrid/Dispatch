import {Pipe} from '@angular/core';
import { UtilsProvider } from '../providers/utils';

@Pipe({
  name: 'rgTimeAgoUtc'
})
export class RGTimeAgoUTCPipe {

	constructor(private utilsProvider: UtilsProvider) {

	}

  transform(value: string, args: string[]) : string {
    return this.utilsProvider.getTimeAgoUtc(value);
  }
}