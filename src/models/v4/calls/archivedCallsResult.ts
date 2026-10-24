import { BaseV4Request } from '../baseV4Request';
import { type CallResultData } from './callResultData';

/** Response of `/Calls/GetArchivedCalls`: the closed calls (States 1-7) logged in one year, newest first. */
export class ArchivedCallsResult extends BaseV4Request {
  public Data: CallResultData[] = [];
}
