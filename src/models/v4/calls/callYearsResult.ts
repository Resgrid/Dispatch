import { BaseV4Request } from '../baseV4Request';

/** Response of `/Calls/GetCallYears`: the years (e.g. "2026") the department has calls in, newest first. */
export class CallYearsResult extends BaseV4Request {
  public Data: string[] = [];
}
