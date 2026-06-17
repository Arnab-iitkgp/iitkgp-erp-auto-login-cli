import type { CourseSlot } from './types.js';

// THE CENTRAL TIMETABLE MASTER MAP (Autumn 2026-2027)
//TODO: UPDATE NEEDED IF CHNAGED

export const STANDARD_SLOTS: CourseSlot[] = [
  // --- A Slots ---
  { name: 'A2', type: 'Theory', credits: 2, periods: [{day: 'MON', period: 1}, {day: 'MON', period: 2}] },
  { name: 'A3', type: 'Theory', credits: 3, periods: [{day: 'MON', period: 1}, {day: 'MON', period: 2}, {day: 'TUE', period: 5}] },

  // --- B Slots ---
  { name: 'B2', type: 'Theory', credits: 2, periods: [{day: 'TUE', period: 1}, {day: 'TUE', period: 2}] },
  { name: 'B3', type: 'Theory', credits: 3, periods: [{day: 'MON', period: 4}, {day: 'TUE', period: 1}, {day: 'TUE', period: 2}] },

  // --- C Slots ---
  { name: 'C2', type: 'Theory', credits: 2, periods: [{day: 'WED', period: 1}, {day: 'WED', period: 2}] },
  { name: 'C3', type: 'Theory', credits: 3, periods: [{day: 'MON', period: 3}, {day: 'WED', period: 1}, {day: 'WED', period: 2}] },
  { name: 'C4', type: 'Theory', credits: 4, periods: [{day: 'MON', period: 3}, {day: 'WED', period: 1}, {day: 'WED', period: 2}, {day: 'THU', period: 3}] },

  // --- D Slots ---
  { name: 'D2', type: 'Theory', credits: 2, periods: [{day: 'TUE', period: 3}, {day: 'TUE', period: 4}] },
  { name: 'D3', type: 'Theory', credits: 3, periods: [{day: 'MON', period: 5}, {day: 'TUE', period: 3}, {day: 'TUE', period: 4}] },
  { name: 'D4', type: 'Theory', credits: 4, periods: [{day: 'MON', period: 5}, {day: 'TUE', period: 3}, {day: 'TUE', period: 4}, {day: 'THU', period: 1}] },

  // --- E Slots ---
  { name: 'E2', type: 'Theory', credits: 2, periods: [{day: 'FRI', period: 2}, {day: 'FRI', period: 3}] },
  { name: 'E3', type: 'Theory', credits: 3, periods: [{day: 'WED', period: 5}, {day: 'THU', period: 4}, {day: 'FRI', period: 2}] },
  { name: 'E4', type: 'Theory', credits: 4, periods: [{day: 'WED', period: 5}, {day: 'THU', period: 4}, {day: 'FRI', period: 2}, {day: 'FRI', period: 3}] },

  // --- F Slots ---
  { name: 'F2', type: 'Theory', credits: 2, periods: [{day: 'FRI', period: 4}, {day: 'FRI', period: 5}] },
  { name: 'F3', type: 'Theory', credits: 3, periods: [{day: 'WED', period: 3}, {day: 'THU', period: 2}, {day: 'FRI', period: 4}] },
  { name: 'F4', type: 'Theory', credits: 4, periods: [{day: 'WED', period: 3}, {day: 'THU', period: 2}, {day: 'FRI', period: 4}, {day: 'FRI', period: 5}] },

  // --- G Slots ---
  { name: 'G2', type: 'Theory', credits: 2, periods: [{day: 'WED', period: 4}, {day: 'THU', period: 5}] },
  { name: 'G3', type: 'Theory', credits: 3, periods: [{day: 'WED', period: 4}, {day: 'THU', period: 5}, {day: 'FRI', period: 1}] },

  // --- H Slots ---
  { name: 'H2', type: 'Theory', credits: 2, periods: [{day: 'TUE', period: 8}, {day: 'TUE', period: 9}] },
  { name: 'H3', type: 'Theory', credits: 3, periods: [{day: 'MON', period: 6}, {day: 'TUE', period: 8}, {day: 'TUE', period: 9}] },

  // --- I Slots ---
  { name: 'I2', type: 'Theory', credits: 2, periods: [{day: 'THU', period: 6}, {day: 'FRI', period: 8}] },

  // --- S Slots ---
  { name: 'S2', type: 'Theory', credits: 2, periods: [{day: 'MON', period: 9}, {day: 'THU', period: 9}] },
  { name: 'S3', type: 'Theory', credits: 3, periods: [{day: 'MON', period: 9}, {day: 'THU', period: 9}, {day: 'FRI', period: 9}] },

  // --- U Slots ---
  { name: 'U2', type: 'Theory', credits: 2, periods: [{day: 'MON', period: 7}, {day: 'MON', period: 8}] },
  { name: 'U3', type: 'Theory', credits: 3, periods: [{day: 'MON', period: 7}, {day: 'MON', period: 8}, {day: 'TUE', period: 7}] },
  { name: 'U4', type: 'Theory', credits: 4, periods: [{day: 'MON', period: 7}, {day: 'MON', period: 8}, {day: 'TUE', period: 6}, {day: 'TUE', period: 7}] },

  // --- V Slots ---
  { name: 'V2', type: 'Theory', credits: 2, periods: [{day: 'THU', period: 7}, {day: 'THU', period: 8}] },
  { name: 'V3', type: 'Theory', credits: 3, periods: [{day: 'THU', period: 7}, {day: 'THU', period: 8}, {day: 'FRI', period: 7}] },
  { name: 'V4', type: 'Theory', credits: 4, periods: [{day: 'THU', period: 7}, {day: 'THU', period: 8}, {day: 'FRI', period: 6}, {day: 'FRI', period: 7}] },

  // --- X Slots ---
  { name: 'X4', type: 'Theory', credits: 4, periods: [{day: 'WED', period: 6}, {day: 'WED', period: 7}, {day: 'WED', period: 8}, {day: 'WED', period: 9}] },

  // ---------------------------------------------------------
// LAB SLOTS
  // ---------------------------------------------------------
  
  // Morning Labs (Periods 1 to 4)
  { name: 'LAB:Q', type: 'Lab', credits: 'variable', periods: [{day: 'MON', period: 3}, {day: 'MON', period: 4}, {day: 'MON', period: 5}] },
  { name: 'LAB:K', type: 'Lab', credits: 'variable', periods: [{day: 'TUE', period: 3}, {day: 'TUE', period: 4}, {day: 'TUE', period: 5}] },
  { name: 'LAB:R', type: 'Lab', credits: 'variable', periods: [{day: 'WED', period: 3}, {day: 'WED', period: 4}, {day: 'WED', period: 5}] },
  { name: 'LAB:M', type: 'Lab', credits: 'variable', periods: [{day: 'THU', period: 3}, {day: 'THU', period: 4}, {day: 'THU', period: 5}] },
  { name: 'LAB:O', type: 'Lab', credits: 'variable', periods: [{day: 'FRI', period: 3}, {day: 'FRI', period: 4}, {day: 'FRI', period: 5}] },

  // Afternoon Labs (Periods 6 to 8)
  { name: 'LAB:J', type: 'Lab', credits: 'variable', periods: [{day: 'MON', period: 6}, {day: 'MON', period: 7}, {day: 'MON', period: 8}] },
  { name: 'LAB:L', type: 'Lab', credits: 'variable', periods: [{day: 'TUE', period: 6}, {day: 'TUE', period: 7}, {day: 'TUE', period: 8}] },
  { name: 'LAB:X', type: 'Lab', credits: 'variable', periods: [{day: 'WED', period: 6}, {day: 'WED', period: 7}, {day: 'WED', period: 8}] },
  { name: 'LAB:N', type: 'Lab', credits: 'variable', periods: [{day: 'THU', period: 6}, {day: 'THU', period: 7}, {day: 'THU', period: 8}] },
  { name: 'LAB:P', type: 'Lab', credits: 'variable', periods: [{day: 'FRI', period: 6}, {day: 'FRI', period: 7}, {day: 'FRI', period: 8}] }
];
