import { FormDataAutomationResult } from "./formDataAutomationResult";

export class FormDataResult {
    public Id: string;
    public Name: string;
    public Type: number;
    public Data: string;

    public Automations: FormDataAutomationResult[];
}