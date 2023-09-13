import { Pipe } from "@angular/core";
import { UtilsProvider } from "../providers/utils";

@Pipe({
  name: "rgTimeAgo",
})
export class RGTimeAgoPipe {
  constructor(private utilsProvider: UtilsProvider) {}

  transform(value: string, args: string[]): string {
    return this.utilsProvider.getTimeAgo(value);
  }
}
