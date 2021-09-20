import { GroupInfo } from './groupInfo';
import { CallResult } from './callResult';
import { CustomStatusesResult } from './customStatusesResult';

export class GetSetUnitStatusResult  {
    public UnitId: number = 0;
    public UnitName: string = "";
    public Stations: GroupInfo[];
    public Calls: CallResult[];
    public Statuses: CustomStatusesResult[];
}