// FieldDataType enum (see UDF_FIELD_TYPE in @/lib/udf/options)
// Text=0, Number=1, Decimal=2, Boolean=3, Date=4, DateTime=5, Dropdown=6, MultiSelect=7, Email=8, Phone=9, Url=10, ComboBox=11
// Dropdown, MultiSelect and ComboBox options live in ValidationRules (a JSON string); read them with parseUdfOptions.
export class UdfFieldResultData {
  public UdfFieldId: string = '';
  public UdfDefinitionId: string = '';
  public Name: string = '';
  public Label: string = '';
  public Description: string = '';
  public Placeholder: string = '';
  public FieldDataType: number = 0;
  public IsRequired: boolean = false;
  public IsReadOnly: boolean = false;
  public DefaultValue: string = '';
  public ValidationRules: string = '';
  public SortOrder: number = 0;
  public GroupName: string = '';
  public IsVisibleOnMobile: boolean = true;
  public IsVisibleOnReports: boolean = true;
  public IsEnabled: boolean = true;
  public Visibility: number = 0;
}
