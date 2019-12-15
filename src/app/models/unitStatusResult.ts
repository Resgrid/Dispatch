export class UnitStatusResult  {
    public Uid: number = 0;    // UnitId of the unit
    public Did: number = 0;    // Destionation Id
    public Typ: number = 0;    // Current State/Status Type
    public Tmp: string = '';   // State Timestamp

    // Local Data
    public Name: string = '';
    public Type: string = '';
    public StateText: string = '';
    public StateColor: string = '';
}
