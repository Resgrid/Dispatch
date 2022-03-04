import { NumberFormatStyle } from "@angular/common";

export class SaveCloseCallPayload {
    public callId: string;
    public stateType: NumberFormatStyle;
    public note: string;
    public date: Date;
}
