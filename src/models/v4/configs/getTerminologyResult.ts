import { BaseV4Request } from '../baseV4Request';

/** One term a department can rename (Department -> Terminology on the website). */
export interface DepartmentTermData {
  /** Stable key, e.g. "module.records" or "record-type.run". Never changes. */
  Key: string;
  /** "Module" or "RecordType". */
  Category: string;
  /** Resgrid's English name for the term. */
  DefaultName: string;
  /** The department's own name; null when it uses Resgrid's. */
  Name: string | null;
}

export class GetTerminologyResult extends BaseV4Request {
  public Data: DepartmentTermData[] = [];
}
