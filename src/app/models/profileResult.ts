import { AddressResult } from './addressResult';

export class ProfileResult  {
    public Uid: string = "";   // User Id
    public Adm: Boolean = false;    // Department Admin
    public Hid: Boolean = false;   // Hidden
    public Dis: Boolean = false;    // Disabled
    public Lkd: Boolean = false;   // Locked Out
    public Fnm: string = "";   // First  Name
    public Lnm: string = "";   // Last Name
    public Eml: string = "";   // Email Address
    public Tz: string = "";   // Time Zone Name
    public Mob: string = "";    // Mobile Number
    public Moc: string = "";   // Mobile Carrier
   
    public Sce: Boolean = false;    // Send Call Emails
    public Scp: Boolean = false;   // Send Call Push
    public Scs: Boolean = false;    // Send Call SMS
    
    public Sme: Boolean = false;    // Send Call Emails
    public Smp: Boolean = false;   // Send Call Push
    public Sms: Boolean = false;    // Send Call SMS

    public Sne: Boolean = false;    // Send Call Emails
    public Snp: Boolean = false;   // Send Call Push
    public Sns: Boolean = false;    // Send Call SMS

    public Id: string = "" // Department Issued Id
    public Lup: string = "" // Last Updated

    public Val: Boolean = false;    // Allowed for Voice
    public Voc: Boolean = false;   //   Enabled Voice for Calls
    public Vcm: Boolean = false;    // Voice call mobile
    public Vch: Boolean = false;    // Voice call home

    public Hme: AddressResult;  // Home Address
    public Mal: AddressResult;  // Mailing Address
}