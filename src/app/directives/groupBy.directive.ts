import { Pipe, PipeTransform } from "@angular/core";

@Pipe({ name: "groupBy" })
export class GroupByPipe implements PipeTransform {
  transform(value: Array<any>, field: string): Array<any> {
    if (value && value.length > 0) {
      const groupedObj = value.reduce((prev, cur) => {
        if (!prev[cur[field]]) {
          prev[cur[field]] = [cur];
        } else {
          prev[cur[field]].push(cur);
        }
        return prev;
      }, {});

      return Object.keys(groupedObj).map((key) => ({ key, value: groupedObj[key] }));
    }

    return value;
  }
}
