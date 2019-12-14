export class StatusesInfo  {
    public Id: number = 0;    // Id of the Set
    public Type: number = 0;   // Type of the Set
    public StateId: number = 0;    // State Id
    public Text: string = "";   // Button Text
    public BColor: string = "";   // Button Color
    public Color: string = "";   // Text Color
    public Gps: boolean = false;   // Require GPS
    public Note: number = 0;    // Note Type
    public Detail: number = 0;    // Detail Type
    public IsDeleted: boolean = false;

    constructor(id: number, text: string) {
        this.Id = id;
        this.Text = text;
    }
}