/*
 Currently the engine is based on brute force lookup map
 TODO: optional: Add matrix based bitwise operation for fast lookup

*/ 

import type { Period } from './types.js';
import { STANDARD_SLOTS } from './constants.js';

export class TimetableEngine {
  
  /**
   * Converts an array of enrolled slot names (e.g., ['A3', 'U2', 'LAB:Q']) into a fast lookup map.
   * Maps "DAY:PERIOD" -> "SlotName" so we know exactly who is occupying the slot!
   */
  public static buildBusyMap(enrolledSlotNames: string[]): Map<string, string> {
    const busyMap = new Map<string, string>();
    
    for (const slotName of enrolledSlotNames) {
      const slot = STANDARD_SLOTS.find(s => s.name.toUpperCase() === slotName.toUpperCase());
      if (slot) {
        for (const p of slot.periods) {
          busyMap.set(`${p.day}:${p.period}`, slot.name);
        }
      } else {
        console.warn(`Warning: Slot ${slotName} not found in central timetable.`);
      }
    }
    
    return busyMap;
  }

  /**
   * Answers: "is D3 free?"
   * Returns an array of your saved slot names that it crashes with. 
   * If it returns an empty array [], the slot is completely free
   */
  public static checkClashes(busyMap: Map<string, string>, targetSlotName: string): string[] {
    const targetSlot = STANDARD_SLOTS.find(s => s.name.toUpperCase() === targetSlotName.toUpperCase());
    if (!targetSlot) throw new Error(`Slot ${targetSlotName} not found in central timetable.`);

    const clashes = new Set<string>();

    for (const period of targetSlot.periods) {
      const occupant = busyMap.get(`${period.day}:${period.period}`);
      if (occupant) {
        clashes.add(occupant); // Record exactly who is causing the crash
      }
    }

    return Array.from(clashes);
  }

  /**
   * Answers: "tell me free slots of 3 cred"
   */
  public static getFreeSlotsByCredits(busyMap: Map<string, string>, targetCredits: number | 'variable'): string[] {
    const freeSlots: string[] = [];

    const slotsWithTargetCredits = STANDARD_SLOTS.filter(s => s.credits === targetCredits);

    for (const slot of slotsWithTargetCredits) {
      const clashes = this.checkClashes(busyMap, slot.name);
      if (clashes.length === 0) {
        freeSlots.push(slot.name);
      }
    }

    return freeSlots; 
  }
}
