import { Injectable } from '@angular/core';

import { Consts } from '../consts';
import { StatusesInfo } from '../models/statusesInfo';
import { CustomStatesProvider } from './custom-states'
import { PubSubService } from '../components/pubsub/angular2-pubsub.service';

@Injectable({
	providedIn: 'root'
})
export class TypesProvider {
	private statuses: StatusesInfo[];
	private staffings: StatusesInfo[];
	private unitStates: StatusesInfo[];
	private localDataSetSub: any;

	constructor(private customStatesProvider: CustomStatesProvider, private consts: Consts, private pubsub: PubSubService) {
		this.localDataSetSub = this.pubsub.$sub(this.consts.EVENTS.LOCAL_DATA_SET).subscribe((from) => {
			this.populateStatuses();
		});
	}

	ngOnInit() {
		this.populateStatuses();
	}

	public populateStatuses() {
		this.customStatesProvider.getPersonnelStatuses().then((customStatuses) => {
			this.statuses = customStatuses;
		});

		this.customStatesProvider.getPersonnelStaffing().then((customStaffings) => {
			this.staffings = customStaffings;
		});

		this.customStatesProvider.getUnitStates().then((customUnitStaffings) => {
			this.unitStates = customUnitStaffings;
		});
	}

	public statusToTextConverter(value: number): string {
		if (value <= 25) {
			if (value === 0) {
				return 'Standing By';
			}
			else if (value === 1) {
				return 'Not Responding';
			}
			else if (value === 2) {
				return 'Responding';
			}
			else if (value === 3) {
				return 'On Scene';
			}
			else if (value === 4) {
				return 'Available Station';
			}
			else if (value === 5) {
				return 'Responding Station';
			}
			else if (value === 6) {
				return 'Responding Scene';
			}
			else {
				return 'Unknown';
			}
		} else if (this.statuses) {
			var state;

			this.statuses.forEach(element => {
				if (element.Id == value) {
					state = element;
				}
			});

			if (state) {
				return state.Text;
			} else {
				return 'Unknown';
			}
		} else {
			return 'Unknown';
		}
	}

	public statusTextToValueConverter(text: string): number {
		if (text === 'Standing By') {
			return 0;
		}
		else if (text === 'Not Responding') {
			return 1;
		}
		else if (text === 'Responding') {
			return 2;
		}
		else if (text === 'On Scene') {
			return 3;
		}
		else if (text === 'Available Station') {
			return 4;
		}
		else if (text === 'Responding Station') {
			return 5;
		}
		else if (text === 'Responding Scene') {
			return 6;
		}
		else {
			return 0;
		}
	}

	public statusToColorConverter(value: number): string {
		if (value <= 25) {
			if (value === 0) {
				return '#000000';
			}
			else if (value === 1) {
				return '#d2322d';
			}
			else if (value === 2) {
				return '#47a447';
			}
			else if (value === 3) {
				return '#000000';
			}
			else if (value === 4) {
				return '#5bc0de';
			}
			else if (value === 5) {
				return '#47a447';
			}
			else if (value === 6) {
				return '#47a447';
			}
			else {
				return '#000000';
			}
		} else if (this.statuses) {
			var state;

			this.statuses.forEach(element => {
				if (element.Id == value) {
					state = element;
				}
			});

			if (state) {
				return state.BColor;
			} else {
				return '#000000';
			}
		} else {
			return '#000000';
		}
	}

	public staffingToTextConverter(value: number): string {
		if (value <= 25) {
			if (value === 0) {
				return 'Available';
			}
			else if (value === 1) {
				return 'Delayed';
			}
			else if (value === 2) {
				return 'Unavailable';
			}
			else if (value === 3) {
				return 'Committed';
			}
			else if (value === 4) {
				return 'On Shift';
			}
			else {
				return 'Unknown';
			}
		} else if (this.staffings) {
			var staffing;

			this.staffings.forEach(element => {
				if (element.Id == value) {
					staffing = element;
				}
			});

			if (staffing) {
				return staffing.Text;
			} else {
				return 'Unknown';
			}
		} else {
			return 'Unknown';
		}
	}

	public staffingTextToValueConverter(text: string): number {
		if (text === 'Available') {
			return 0;
		}
		else if (text === 'Delayed') {
			return 1;
		}
		else if (text === 'Unavailable') {
			return 2;
		}
		else if (text === 'Committed') {
			return 3;
		}
		else if (text === 'On Shift') {
			return 4;
		}
		else {
			return 0;
		}
	}

	public staffingToColorConverter(value: number): string {
		if (value <= 25) {
			if (value === 0) {
				return '#000000';
			}
			else if (value === 1) {
				return '#f0ad4e';
			}
			else if (value === 2) {
				return '#d43f3a';
			}
			else if (value === 3) {
				return '#5bc0de';
			}
			else if (value === 4) {
				return '#000000';
			}
			else {
				return '#000000';
			}
		} else if (this.staffings) {
			var staffing;

			this.staffings.forEach(element => {
				if (element.Id == value) {
					staffing = element;
				}
			});

			if (staffing) {
				return staffing.BColor;
			} else {
				return '#000000';
			}
		} else {
			return '#000000';
		}
	}

	public unitStatusToTextConverter(value: number): string {
		if (value <= 25) {
			if (value === 0) {
				return 'Available';
			}
			else if (value === 1) {
				return 'Delayed';
			}
			else if (value === 2) {
				return 'Unavailable';
			}
			else if (value === 3) {
				return 'Committed';
			}
			else if (value === 4) {
				return 'Out Of Service';
			}
			else if (value === 5) {
				return 'Responding';
			}
			else if (value === 6) {
				return 'On Scene';
			}
			else if (value === 7) {
				return 'Staging';
			}
			else if (value === 8) {
				return 'Returning';
			}
			else if (value === 9) {
				return 'Cancelled';
			}
			else if (value === 10) {
				return 'Released';
			}
			else if (value === 11) {
				return 'Manual';
			}
			else if (value === 12) {
				return 'Enroute';
			}
			else {
				return 'Unknown';
			}
		} else if (this.unitStates) {
			var state;

			this.unitStates.forEach(element => {
				if (element.Id == value) {
					state = element;
				}
			});

			if (state) {
				return state.Text;
			} else {
				return 'Unknown';
			}
		} else {
			return 'Unknown';
		}
	}

	public unitStatusToColorConverter(value: number): string {
		if (value <= 25) {
			if (value === 0) {
				return '#000000';
			}
			else if (value === 1) {
				return '#f0ad4e';
			}
			else if (value === 2) {
				return '#d2322d';
			}
			else if (value === 3) {
				return '#000000';
			}
			else if (value === 4) {
				return '#d2322d';
			}
			else if (value === 5) {
				return '#47a447';
			}
			else if (value === 6) {
				return '#000000';
			}
			else if (value === 7) {
				return '#000000';
			}
			else if (value === 8) {
				return '#000000';
			}
			else if (value === 9) {
				return '#000000';
			}
			else if (value === 10) {
				return '#000000';
			}
			else if (value === 11) {
				return '#000000';
			}
			else if (value === 12) {
				return '#47a447';
			}
			else {
				return '#000000';
			}
		} else if (this.unitStates) {
			var state;

			this.unitStates.forEach(element => {
				if (element.Id == value) {
					state = element;
				}
			});

			if (state) {
				return state.BColor;
			} else {
				return '#000000';
			}
		} else {
			return '#000000';
		}
	}

	public unitStatusTextToValueConverter(value: string): number {
		var returnValue = null;

		if (value === 'Available') {
			returnValue = 0;
		}
		else if (value === 'Delayed') {
			returnValue = 1;
		}
		else if (value === 'Unavailable') {
			returnValue = 2;
		}
		else if (value === 'Committed') {
			returnValue = 3;
		}
		else if (value === 'Out Of Service') {
			returnValue = 4;
		}
		else if (value === 'Responding') {
			returnValue = 5;
		}
		else if (value === 'On Scene') {
			returnValue = 6;
		}
		else if (value === 'Staging') {
			returnValue = 7;
		}
		else if (value === 'Returning') {
			returnValue = 8;
		}
		else if (value === 'Cancelled') {
			returnValue = 9;
		}
		else if (value === 'Released') {
			returnValue = 10;
		}
		else if (value === 'Manual') {
			returnValue = 11;
		}
		else if (value === 'Enroute') {
			returnValue = 12;
		}

		if (returnValue == null && this.unitStates) {
			var state;

			this.unitStates.forEach(element => {
				if (element.Text == value) {
					state = element;
				}
			});

			if (state) {
				return state.DetailId;
			} else {
				return 0;
			}
		} else if (returnValue == null) {
			return 0;
		} else {
			return returnValue;
		}
	}

	public priorityToColorConverter(value: number): string {
		if (value === 0)
			return '#47a447';
		else if (value === 1)
			return '#428bca';
		else if (value === 2)
			return '#FF8300';
		else if (value === 3)
			return '#d2322d';
		else
			return '#000000';
	}

	public priorityToTextConverter(value: number): string {
		if (value === 0) {
			return 'Low';
		}
		else if (value === 1) {
			return 'Medium';
		}
		else if (value === 2) {
			return 'High';
		}
		else if (value === 3) {
			return 'Emergency';
		}
		else {
			return 'Unknown';
		}
	}
}
