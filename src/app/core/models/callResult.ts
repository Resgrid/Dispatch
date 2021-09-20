export class CallResult {
  public Cid: string = ""; // Current Action
  public Pri: number = 0; // Action Timestamp

  public Ctl: string = "";
  public Nme: string = "";

  public Noc: string = ""; // State Timestamp

  public Map: string = "";
  public Not: string = "";

  public Add: string = "";

  public Geo: string = "";
  public Lon: string = "";
  public Utc: string = "";
  public Ste: string = "";
  public Num: string = "";

  public Nts: number = 0;
  public Aud: number = 0;
  public Img: number = 0;
  public Fls: number = 0;

  public w3w: string = "";

  public Rnm: string = "";
  public Rci: string = "";
  public Rid: string = "";
  public Eid: string = "";

  public Aid: string = "";

  public Typ: string = "No Type";

  public Don: string = ""; // Dispatch On

  public Gla: string = '';  // Geolocation Latitude
  public Glo: string = '';  // Geolocation Longitude

  // Local Data
  public PriorityColor: string;
  public PriorityText: string;
  public Selected: boolean = false;
  public LoggedOnDate: string = "";
  public DispatchOnDate: string = "";
}
