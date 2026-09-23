import { BaseV4Request } from '../baseV4Request';
import { CallExtraDataResultData } from './callExtraDataResultData';

/**
 * Response of `/Calls/GetCallExtraData`: the standard v4 envelope plus the call's form data,
 * `Activity` (unit/personnel status events on the call), `Dispatches`, priority and protocols.
 */
export class CallExtraDataResult extends BaseV4Request {
  public Data: CallExtraDataResultData = new CallExtraDataResultData();
}
