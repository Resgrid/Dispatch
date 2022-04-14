export class SetPersonStatusesPayload {
    public userIds: string[];
    public stateType: string;
    public destination: string;
    public destinationType: number;
    public note: string;
    public date: Date;
}
