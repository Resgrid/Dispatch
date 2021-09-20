import { GroupInfo } from './groupInfo';
import { ChannelData } from './channelData';

export class ChatDataResult  {
    public Token: string = "";
    public Did: number = 0;
    public Name: string = "";

    public Groups: GroupInfo[];
    public Channels: ChannelData[];
} 