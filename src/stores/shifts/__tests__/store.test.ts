import { renderHook, act } from '@testing-library/react-native';
import { useShiftsStore } from '../store';
import * as shiftsApi from '@/api/shifts/shifts';
import { logger } from '@/lib/logging';

// Mock the API
jest.mock('@/api/shifts/shifts');
jest.mock('@/lib/logging');

const mockedShiftsApi = shiftsApi as jest.Mocked<typeof shiftsApi>;

// Mock data
const createBaseMockResult = () => ({
	PageSize: 0,
	Timestamp: '',
	Version: '',
	Node: '',
	RequestId: '',
	Status: '',
	Environment: '',
});

const mockShifts = [
	{
		ShiftId: '1',
		Name: 'Day Shift',
		Code: 'DAY',
		Color: '#FF0000',
		ScheduleType: 0,
		AssignmentType: 0,
		InShift: false,
		PersonnelCount: 5,
		GroupCount: 2,
		NextDay: '2024-01-15T00:00:00Z',
		NextDayId: 'day1',
		Days: [],
	},
	{
		ShiftId: '2',
		Name: 'Night Shift',
		Code: 'NIGHT',
		Color: '#0000FF',
		ScheduleType: 1,
		AssignmentType: 1,
		InShift: true,
		PersonnelCount: 3,
		GroupCount: 1,
		NextDay: '2024-01-16T00:00:00Z',
		NextDayId: 'night1',
		Days: [],
	},
];

const mockTodaysShifts = [
	{
		ShiftId: '1',
		ShiftName: 'Day Shift',
		ShiftDayId: 'day1',
		ShiftDay: '2024-01-15T00:00:00Z',
		Start: '2024-01-15T08:00:00Z',
		End: '2024-01-15T16:00:00Z',
		SignedUp: false,
		ShiftType: 0,
		Signups: [],
		Needs: [],
	},
];

const mockShiftDay = {
	ShiftId: '1',
	ShiftName: 'Day Shift',
	ShiftDayId: 'day1',
	ShiftDay: '2024-01-15T00:00:00Z',
	Start: '2024-01-15T08:00:00Z',
	End: '2024-01-15T16:00:00Z',
	SignedUp: false,
	ShiftType: 0,
	Signups: [
		{
			UserId: 'user1',
			Name: 'John Doe',
			Roles: [1, 2],
		},
	],
	Needs: [
		{
			GroupId: 'group1',
			GroupName: 'EMT',
			GroupNeeds: [
				{
					RoleId: 'role1',
					RoleName: 'EMT Basic',
					Needed: 2,
				},
			],
		},
	],
};

const mockShiftsResult = { ...createBaseMockResult(), Data: mockShifts };
const mockTodaysShiftsResult = { ...createBaseMockResult(), Data: mockTodaysShifts };
const mockShiftDayResult = { ...createBaseMockResult(), Data: mockShiftDay };
const mockSignupResult = { ...createBaseMockResult(), Id: 'signup1' };

describe('useShiftsStore', () => {
	beforeEach(() => {
		// Reset store state
		useShiftsStore.setState({
			shifts: [],
			todaysShiftDays: [],
			selectedShift: null,
			selectedShiftDay: null,
			selectedShiftDays: [],
			shiftCalendarData: {},
			currentView: 'today',
			searchQuery: '',
			isShiftDetailsOpen: false,
			isShiftDayDetailsOpen: false,
			selectedDate: null,
			isLoading: false,
			isTodaysLoading: false,
			isShiftLoading: false,
			isShiftDayLoading: false,
			isSignupLoading: false,
			isCalendarLoading: false,
			error: null,
			signupError: null,
		});

		// Reset mocks
		jest.clearAllMocks();
	});

	describe('initialization', () => {
		it('should initialize with default state', () => {
			const { result } = renderHook(() => useShiftsStore());

			expect(result.current.shifts).toEqual([]);
			expect(result.current.todaysShiftDays).toEqual([]);
			expect(result.current.currentView).toBe('today');
			expect(result.current.isLoading).toBe(false);
			expect(result.current.error).toBeNull();
		});

		it('should initialize store with data', async () => {
			mockedShiftsApi.getAllShifts.mockResolvedValue(mockShiftsResult);
			mockedShiftsApi.getTodaysShifts.mockResolvedValue(mockTodaysShiftsResult);

			const { result } = renderHook(() => useShiftsStore());

			await act(async () => {
				await result.current.init();
			});

			expect(result.current.shifts).toEqual(mockShifts);
			expect(result.current.todaysShiftDays).toEqual(mockTodaysShifts);
			expect(result.current.isLoading).toBe(false);
		});

		it('should handle initialization error', async () => {
			const error = new Error('Failed to fetch');
			mockedShiftsApi.getAllShifts.mockRejectedValue(error);

			const { result } = renderHook(() => useShiftsStore());

			await act(async () => {
				await result.current.init();
			});

			expect(result.current.error).toBe('Failed to initialize shifts data');
			expect(result.current.isLoading).toBe(false);
			expect(logger.error).toHaveBeenCalled();
		});
	});

	describe('fetchAllShifts', () => {
		it('should fetch all shifts successfully', async () => {
			mockedShiftsApi.getAllShifts.mockResolvedValue(mockShiftsResult);

			const { result } = renderHook(() => useShiftsStore());

			await act(async () => {
				await result.current.fetchAllShifts();
			});

			expect(result.current.shifts).toEqual(mockShifts);
			expect(result.current.isLoading).toBe(false);
			expect(result.current.error).toBeNull();
		});

		it('should handle fetch error', async () => {
			const error = new Error('Network error');
			mockedShiftsApi.getAllShifts.mockRejectedValue(error);

			const { result } = renderHook(() => useShiftsStore());

			await act(async () => {
				await result.current.fetchAllShifts();
			});

			expect(result.current.error).toBe('Failed to fetch shifts');
			expect(result.current.isLoading).toBe(false);
		});
	});

	describe('fetchTodaysShifts', () => {
		it("should fetch today's shifts successfully", async () => {
			mockedShiftsApi.getTodaysShifts.mockResolvedValue(mockTodaysShiftsResult);

			const { result } = renderHook(() => useShiftsStore());

			await act(async () => {
				await result.current.fetchTodaysShifts();
			});

			expect(result.current.todaysShiftDays).toEqual(mockTodaysShifts);
			expect(result.current.isTodaysLoading).toBe(false);
			expect(result.current.error).toBeNull();
		});

		it('should handle fetch error', async () => {
			const error = new Error('Network error');
			mockedShiftsApi.getTodaysShifts.mockRejectedValue(error);

			const { result } = renderHook(() => useShiftsStore());

			await act(async () => {
				await result.current.fetchTodaysShifts();
			});

			expect(result.current.error).toBe("Failed to fetch today's shifts");
			expect(result.current.isTodaysLoading).toBe(false);
		});
	});

	describe('fetchShiftDay', () => {
		it('should fetch shift day successfully', async () => {
			mockedShiftsApi.getShiftDay.mockResolvedValue(mockShiftDayResult);

			const { result } = renderHook(() => useShiftsStore());

			await act(async () => {
				await result.current.fetchShiftDay('day1');
			});

			expect(result.current.selectedShiftDay).toEqual(mockShiftDay);
			expect(result.current.isShiftDayLoading).toBe(false);
			expect(result.current.error).toBeNull();
		});

		it('should handle fetch error', async () => {
			const error = new Error('Not found');
			mockedShiftsApi.getShiftDay.mockRejectedValue(error);

			const { result } = renderHook(() => useShiftsStore());

			await act(async () => {
				await result.current.fetchShiftDay('day1');
			});

			expect(result.current.error).toBe('Failed to fetch shift day details');
			expect(result.current.isShiftDayLoading).toBe(false);
		});
	});

	describe('signup functionality', () => {
		it('should sign up for shift successfully', async () => {
			mockedShiftsApi.signupForShiftDay.mockResolvedValue({ Id: 'signup1' } as Awaited<ReturnType<typeof shiftsApi.signupForShiftDay>>);
			mockedShiftsApi.getTodaysShifts.mockResolvedValue(mockTodaysShiftsResult);
			mockedShiftsApi.getShiftDay.mockResolvedValue(mockShiftDayResult);

			const { result } = renderHook(() => useShiftsStore());

			await act(async () => {
				await result.current.signupForShift('day1', 'group1');
			});

			expect(mockedShiftsApi.signupForShiftDay).toHaveBeenCalledWith('day1', 'group1');
			expect(mockedShiftsApi.getTodaysShifts).toHaveBeenCalled();
			expect(mockedShiftsApi.getShiftDay).toHaveBeenCalledWith('day1');
			expect(result.current.isSignupLoading).toBe(false);
			expect(result.current.signupError).toBeNull();
		});

		it('should handle signup error', async () => {
			const error = new Error('Signup failed');
			mockedShiftsApi.signupForShiftDay.mockRejectedValue(error);

			const { result } = renderHook(() => useShiftsStore());

			await act(async () => {
				await result.current.signupForShift('day1', 'group1');
			});

			expect(result.current.signupError).toBe('Failed to sign up for shift');
			expect(result.current.isSignupLoading).toBe(false);
		});

		// Note: withdrawFromShift is not currently implemented in the store
		// it('should withdraw from shift successfully', async () => {
		// 	mockedShiftsApi.withdrawFromShiftDay.mockResolvedValue({ Id: 'withdraw1' });
		// 	mockedShiftsApi.getTodaysShifts.mockResolvedValue({ Data: mockTodaysShifts });
		// 	mockedShiftsApi.getShiftDay.mockResolvedValue({ Data: mockShiftDay });

		// 	const { result } = renderHook(() => useShiftsStore());

		// 	await act(async () => {
		// 		await result.current.withdrawFromShift('day1', 'user1');
		// 	});

		// 	expect(mockedShiftsApi.withdrawFromShiftDay).toHaveBeenCalledWith('day1', 'user1');
		// 	expect(result.current.isSignupLoading).toBe(false);
		// 	expect(result.current.signupError).toBeNull();
		// });
	});

	describe('UI state management', () => {
		it('should update current view', () => {
			const { result } = renderHook(() => useShiftsStore());

			act(() => {
				result.current.setCurrentView('all');
			});

			expect(result.current.currentView).toBe('all');
		});

		it('should update search query', () => {
			const { result } = renderHook(() => useShiftsStore());

			act(() => {
				result.current.setSearchQuery('emergency');
			});

			expect(result.current.searchQuery).toBe('emergency');
		});

		it('should select shift and open details', () => {
			const { result } = renderHook(() => useShiftsStore());

			act(() => {
				const shift = mockShifts[0];
				if (shift) {
					result.current.selectShift(shift);
				}
			});

			expect(result.current.selectedShift).toEqual(mockShifts[0]);
			expect(result.current.isShiftDetailsOpen).toBe(true);
		});

		it('should close shift details', () => {
			const { result } = renderHook(() => useShiftsStore());

			// First select a shift
			act(() => {
				const shift = mockShifts[0];
				if (shift) {
					result.current.selectShift(shift);
				}
			});

			// Then close details
			act(() => {
				result.current.closeShiftDetails();
			});

			expect(result.current.isShiftDetailsOpen).toBe(false);
			expect(result.current.selectedShift).toBeNull();
		});

		it('should select shift day and open details', () => {
			const { result } = renderHook(() => useShiftsStore());

			act(() => {
				result.current.selectShiftDay(mockShiftDay);
			});

			expect(result.current.selectedShiftDay).toEqual(mockShiftDay);
			expect(result.current.isShiftDayDetailsOpen).toBe(true);
		});

		it('should clear errors', () => {
			const { result } = renderHook(() => useShiftsStore());

			// Set some errors first
			act(() => {
				useShiftsStore.setState({
					error: 'Some error',
					signupError: 'Signup error',
				});
			});

			// Clear them
			act(() => {
				result.current.clearError();
				result.current.clearSignupError();
			});

			expect(result.current.error).toBeNull();
			expect(result.current.signupError).toBeNull();
		});
	});

	describe('computed properties', () => {
		it('should get shift days for specific date', () => {
			useShiftsStore.setState({
				selectedShift: mockShifts[0] || null,
				shiftCalendarData: {
					'1': [mockShiftDay],
				},
			});

			const { result } = renderHook(() => useShiftsStore());

			const shiftDaysForDate = result.current.getShiftDaysForDate('2024-01-15');
			expect(shiftDaysForDate).toHaveLength(1);
			expect(shiftDaysForDate[0]).toEqual(mockShiftDay);
		});
	});

	describe('calendar data management', () => {
		// Note: fetchShiftDaysForDateRange is not currently implemented in the store
		// it('should fetch shift days for date range', async () => {
		// 	const mockShiftDays = [mockShiftDay];
		// 	mockedShiftsApi.getShiftDaysForDateRange.mockResolvedValue({ Data: mockShiftDays });

		// 	const { result } = renderHook(() => useShiftsStore());

		// 	await act(async () => {
		// 		await result.current.fetchShiftDaysForDateRange('1', '2024-01-01', '2024-01-31');
		// 	});

		// 	expect(result.current.shiftCalendarData['1']).toEqual(mockShiftDays);
		// 	expect(result.current.isCalendarLoading).toBe(false);
		// 	expect(result.current.error).toBeNull();
		// });

		// it('should handle calendar fetch error', async () => {
		// 	const error = new Error('Calendar error');
		// 	mockedShiftsApi.getShiftDaysForDateRange.mockRejectedValue(error);

		// 	const { result } = renderHook(() => useShiftsStore());

		// 	await act(async () => {
		// 		await result.current.fetchShiftDaysForDateRange('1', '2024-01-01', '2024-01-31');
		// 	});

		// 	expect(result.current.error).toBe('Failed to fetch shift calendar data');
		// 	expect(result.current.isCalendarLoading).toBe(false);
		// });

		it('should manage calendar data state', () => {
			const { result } = renderHook(() => useShiftsStore());

			// Test setting calendar data manually
			act(() => {
				useShiftsStore.setState({
					shiftCalendarData: {
						'1': [mockShiftDay],
					},
					isCalendarLoading: false,
				});
			});

			expect(result.current.shiftCalendarData['1']).toEqual([mockShiftDay]);
			expect(result.current.isCalendarLoading).toBe(false);
		});
	});
});
