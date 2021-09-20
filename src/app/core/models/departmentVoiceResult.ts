import { DepartmentVoiceChannelResult } from "./departmentVoiceChannelResult";
import { DepartmentVoiceUserInfoResult } from "./departmentVoiceUserInfoResult";

export class DepartmentVoiceResult {
    public VoiceEnabled: boolean;
    public Realm: string = '';
    public VoipServerWebsocketSslAddress: string = '';
    public CallerIdName: string = '';
    public Channels: DepartmentVoiceChannelResult[];
    public UserInfo: DepartmentVoiceUserInfoResult = null;
}