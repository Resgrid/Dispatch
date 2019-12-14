export class CallFileResult  {
    public Id: number = 0;    // Call File Id
    public Cid: number = 0;   // Call Id
    public Typ: number = 0;   // Type of the file (Audio = 1, Image= 2, File	= 3, Video = 4)

    public Fln: string = "";  // Name of the File
    public Data: string = ""; // Unformatted Timestamp
    public Nme: string = "";  // Friendly name of the file

    public Sze: number = 0;   // Size of the file
    public Url: string = "";  // URL of the file
    public Uid: string = "";  // User Id
    public Tme: string = "";  // Timestamp
    public Mime: string = ""; // Mime type
}