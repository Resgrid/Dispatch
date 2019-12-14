export class CallNoteResult  {
    public Cid: number = 0;   // Call Id
    public Cnd: number = 0;   // Call Note Id

    public Uid: string = "";  // User Id for the note
    public Src: number = 0;   // Source of the Note

    public Tme: string = "";  // Formatted Timestamp

    public Tsp: string = "";  // Unformatted Timestamp
    public Not: string = "";  // Note Text

    public Lat: number = 0;
    public Lng: number = 0;

    public FullName: string = "";
}