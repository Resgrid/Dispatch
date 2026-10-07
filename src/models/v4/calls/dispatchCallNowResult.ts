import { BaseV4Request } from '../baseV4Request';

/** Response of `/Calls/DispatchCallNow`: the id of the call that was dispatched. */
export class DispatchCallNowResult extends BaseV4Request {
  public Id: string = '';
}
