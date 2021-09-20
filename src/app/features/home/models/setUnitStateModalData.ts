import { CallResult } from 'src/app/core/models/callResult';
import { CustomStatusesResult } from 'src/app/core/models/customStatusesResult';
import { GroupInfo } from 'src/app/core/models/groupInfo';

export class SetUnitStateModalData {
    public UnitId: number;
    public UnitName: string;
    public Stations: GroupInfo[];
    public Calls: CallResult[];
    public Statuses: CustomStatusesResult[];
}
