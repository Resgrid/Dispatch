export class UnitStatusFullResult  {
    public Name: string = '';
    public Type: string = '';
    public State: string = '';
    public StateCss: string = '';
    public StateStyle: string = '';
    public Timestamp: string = '';
    public DestinationId: string = '';
    public Note: string = '';
    public Latitude: string = '';
    public Longitude: string = '';
    public GroupName: string = '';
    public GroupId: string = '';
    public Eta: string = '';
    public UnitId: number = 0;
    public DestinationName: string = '';

    // Local
    public Selected: boolean = false;
    public SelectedForDispatch: boolean = false;
    public Distance: number = 0;
}
