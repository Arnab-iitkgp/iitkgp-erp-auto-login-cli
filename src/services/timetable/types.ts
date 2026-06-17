export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI';

export interface Period {
  day: DayOfWeek;
  period: number; // 1 to 9
}

export interface CourseSlot {
  name: string;      // e.g., 'D3', 'U4', 'LAB:J'
  type: 'Theory' | 'Lab';
  credits: number | 'variable';   //labs have 2, 3 credits
  periods: Period[]; // The exact periods required for this slot
}
