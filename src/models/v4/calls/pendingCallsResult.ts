import { BaseV4Request } from '../baseV4Request';
import { type CallResultData } from './callResultData';

/** Response of `/Calls/GetPendingCalls`: calls saved as Pending (State 8), oldest first. */
export class PendingCallsResult extends BaseV4Request {
  public Data: CallResultData[] = [];
}
