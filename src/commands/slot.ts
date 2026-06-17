import { Command } from "commander";
import prompts from "prompts";
import pc from "picocolors";
import { FileStorageService } from "../services/storage/file-storage.js";
import { TimetableEngine } from "../services/timetable/engine.js";
import { ConfigNotFoundError } from "../errors/config.js";
import type { AppConfig } from "../config/schema.js";

import { STANDARD_SLOTS } from "../services/timetable/constants.js";
import type { DayOfWeek } from "../services/timetable/types.js";

const configStorage = new FileStorageService();

async function safeLoadConfig(): Promise<AppConfig | null> {
  try {
    return await configStorage.loadConfig();
  } catch (e) {
    if (e instanceof ConfigNotFoundError) return null;
    throw e;
  }
}

const PERIOD_TIMES: Record<number, string> = {
  1: "8:00 AM - 8:55 AM",
  2: "9:00 AM - 9:55 AM",
  3: "10:00 AM - 10:55 AM",
  4: "11:00 AM - 11:55 AM",
  5: "12:00 PM - 12:55 PM",
  6: "2:00 PM - 2:55 PM",
  7: "3:00 PM - 3:55 PM",
  8: "4:00 PM - 4:55 PM",
  9: "5:00 PM - 5:55 PM"
};

const PERIOD_START: Record<number, string> = {
  1: "8:00 AM",  2: "9:00 AM",  3: "10:00 AM", 4: "11:00 AM", 5: "12:00 PM",
  6: "2:00 PM", 7: "3:00 PM", 8: "4:00 PM", 9: "5:00 PM"
};
const PERIOD_END: Record<number, string> = {
  1: "8:55 AM", 2: "9:55 AM", 3: "10:55 AM", 4: "11:55 AM", 5: "12:55 PM",
  6: "2:55 PM", 7: "3:55 PM", 8: "4:55 PM", 9: "5:55 PM"
};

function formatPeriodRanges(periods: number[]): string {
  if (periods.length === 0) return "";
  const sorted = [...periods].sort((a, b) => a - b);
  const runs: Array<[number, number]> = [];
  let runStart = sorted[0]!;
  let prev = sorted[0]!;

  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i]!;
    // Period 5 -> 6 spans the 1pm lunch hour; not contiguous.
    const isContiguous = p === prev + 1 && !(prev === 5 && p === 6);
    if (!isContiguous) {
      runs.push([runStart, prev]);
      runStart = p;
    }
    prev = p;
  }
  runs.push([runStart, prev]);

  return runs.map(([s, e]) => `${PERIOD_START[s]} - ${PERIOD_END[e]}`).join(", ");
}

function normalizeSlots(rawSlots: string[]): { valid: string[], invalid: string[] } {
  const labLetters = new Set(
    STANDARD_SLOTS
      .filter(s => s.type === 'Lab')
      .map(s => s.name.split(':')[1]?.toUpperCase())
      .filter((c): c is string => !!c)
  );

  const normalized = rawSlots
    .map(s => {
      const trimmed = s.trim().toUpperCase();
      return labLetters.has(trimmed) ? `LAB:${trimmed}` : trimmed;
    })
    .filter(s => s.length > 0);

  const valid: string[] = [];
  const invalid: string[] = [];

  for (const s of normalized) {
    if (STANDARD_SLOTS.find(slot => slot.name.toUpperCase() === s)) {
      valid.push(s);
    } else {
      invalid.push(s);
    }
  }

  return { valid, invalid };
}

export const slotCommand = new Command("slot")
  .description("Manage and analyze timetable slots")
  .action(async () => {
    const config = await safeLoadConfig();
    const savedSlots = config?.savedSlots || [];

    if (savedSlots.length === 0) {
      console.log(pc.yellow("⚠️ You have no saved slots. Run 'erp slot add <slots>' to add some."));
      return;
    }

    console.log(pc.cyan(`\n📅 Your Booked Timetable Slots:\n`));

    for (const slotName of savedSlots) {
      const slot = STANDARD_SLOTS.find(s => s.name.toUpperCase() === slotName.toUpperCase());
      
      if (!slot) {
         console.log(`${pc.red("✖")} ${pc.bold(slotName)} ${pc.dim("(Not found in central timetable)")}\n`);
         continue;
      }

      const courseName = config?.slotNames?.[slot.name];
      const courseLabel = courseName ? ` ${pc.cyan(`— ${courseName}`)}` : '';
      console.log(`${pc.green("✔")} ${pc.bold(slot.name)}${courseLabel} ${pc.dim(`(${slot.type}, ${slot.credits} credits)`)}`);
      
      const dayMap: Record<string, number[]> = {};
      for (const p of slot.periods) {
         if (!dayMap[p.day]) dayMap[p.day] = [];
         dayMap[p.day]!.push(p.period);
      }

      for (const [day, periods] of Object.entries(dayMap)) {
         console.log(`  ${pc.blue("•")} ${pc.yellow(day)}: ${formatPeriodRanges(periods)}`);
      }
      console.log(); // empty line between slots
    }
  });

slotCommand
  .command("add <slots...>")
  .description("Add slots, optionally with course names (e.g., erp slot add D3=Algo U2 \"LAB:Q=AI Lab\")")
  .action(async (slots) => {
    const currentConfig = await safeLoadConfig();
    if (!currentConfig) return console.log(pc.red("Config not found. Please run 'erp setup' first."));

    const tokenized = (slots as string[]).map(raw => {
      const i = raw.indexOf('=');
      return i === -1
        ? { slotPart: raw, name: undefined as string | undefined }
        : { slotPart: raw.slice(0, i), name: raw.slice(i + 1).trim() || undefined };
    });

    const parsed = normalizeSlots(tokenized.map(t => t.slotPart));

    if (parsed.invalid.length > 0) {
      console.log(pc.red(`\n❌ Error: Invalid slots: ${pc.bold(parsed.invalid.join(", "))}`));
      console.log(pc.yellow("Please provide valid slots (e.g. A3, D4, Q). Nothing was saved."));
      return;
    }

    const nameBySlot = new Map<string, string>();
    parsed.valid.forEach((slotName, i) => {
      const inputName = tokenized[i]?.name;
      if (inputName) nameBySlot.set(slotName, inputName);
    });

    const currentSaved = currentConfig.savedSlots || [];
    const newSlots = parsed.valid.filter(s => !currentSaved.includes(s));
    const skipped = parsed.valid.filter(s => currentSaved.includes(s));

    if (newSlots.length === 0) {
      console.log(pc.yellow("⚠️ All specified slots are already in your timetable."));
      return;
    }

    // Add each candidate to busyMap as we go so self-clashes within the batch surface too.
    const busyMap = TimetableEngine.buildBusyMap(currentSaved);
    const clashReports: { slot: string, clashesWith: string[] }[] = [];

    for (const candidate of newSlots) {
      const clashes = TimetableEngine.checkClashes(busyMap, candidate);
      if (clashes.length > 0) {
        clashReports.push({ slot: candidate, clashesWith: clashes });
      }
      const slotDef = STANDARD_SLOTS.find(s => s.name.toUpperCase() === candidate);
      if (slotDef) {
        for (const p of slotDef.periods) {
          if (!busyMap.has(`${p.day}:${p.period}`)) {
            busyMap.set(`${p.day}:${p.period}`, candidate);
          }
        }
      }
    }

    if (clashReports.length > 0) {
      console.log(pc.red(`\n❌ Clash detected — nothing was saved:`));
      for (const r of clashReports) {
        console.log(`   ${pc.bold(r.slot)} clashes with ${pc.yellow(r.clashesWith.join(", "))}`);
      }
      console.log(pc.dim(`\nTip: run 'erp slot check <slot>' to inspect, or remove the conflicting slot first.`));
      return;
    }

    const updatedNames = { ...(currentConfig.slotNames ?? {}) };
    for (const [slot, name] of nameBySlot) updatedNames[slot] = name;

    await configStorage.saveConfig({
      ...currentConfig,
      savedSlots: [...currentSaved, ...newSlots],
      slotNames: updatedNames,
    });

    const addedDisplay = newSlots.map(s => updatedNames[s] ? `${s} (${updatedNames[s]})` : s).join(", ");
    console.log(pc.green(`✅ Added ${addedDisplay} to your timetable.`));
    if (skipped.length > 0) {
      console.log(pc.dim(`   (already present, skipped: ${skipped.join(", ")})`));
    }
  });

slotCommand
  .command("remove <slots...>")
  .description("Remove slots from your timetable (e.g., erp slot remove a3)")
  .action(async (slots) => {
    const currentConfig = await safeLoadConfig();
    if (!currentConfig) return console.log(pc.red("Config not found. Please run 'erp setup' first."));

    const parsed = normalizeSlots(slots);
    const currentSaved = currentConfig.savedSlots || [];
    const targets = [...parsed.valid, ...parsed.invalid];

    const actuallyRemoved = currentSaved.filter(s => targets.includes(s));
    const missed = targets.filter(t => !currentSaved.includes(t));
    const newSaved = currentSaved.filter(s => !targets.includes(s));

    if (actuallyRemoved.length === 0) {
      console.log(pc.yellow(`⚠️ None of those slots were in your timetable: ${targets.join(", ")}`));
      return;
    }

    const updatedNames = { ...(currentConfig.slotNames ?? {}) };
    for (const s of actuallyRemoved) delete updatedNames[s];

    await configStorage.saveConfig({
      ...currentConfig,
      savedSlots: newSaved,
      slotNames: updatedNames,
    });

    console.log(pc.green(`✅ Removed: ${actuallyRemoved.join(", ")}. ${newSaved.length} slots remaining.`));
    if (missed.length > 0) {
      console.log(pc.yellow(`⚠️  Not removed (never in your timetable): ${missed.join(", ")}`));
    }
  });

slotCommand
  .command("name <slot> [course_name...]")
  .description("Attach (or update) a course name to a saved slot. Omit name to clear.")
  .action(async (rawSlot, courseNameParts: string[]) => {
    const currentConfig = await safeLoadConfig();
    if (!currentConfig) return console.log(pc.red("Config not found. Please run 'erp setup' first."));

    const { valid, invalid } = normalizeSlots([rawSlot]);
    if (invalid.length > 0 || valid.length === 0) {
      console.log(pc.red(`❌ Invalid slot: ${pc.bold(rawSlot)}`));
      return;
    }
    const slot = valid[0]!;

    const savedSlots = currentConfig.savedSlots ?? [];
    if (!savedSlots.includes(slot)) {
      console.log(pc.yellow(`⚠️ ${slot} is not in your saved slots. Add it first with 'erp slot add ${slot}'.`));
      return;
    }

    const updatedNames = { ...(currentConfig.slotNames ?? {}) };
    const newName = courseNameParts?.join(" ").trim();

    if (!newName) {
      if (!updatedNames[slot]) {
        console.log(pc.yellow(`⚠️ ${slot} has no course name to clear.`));
        return;
      }
      const prev = updatedNames[slot];
      delete updatedNames[slot];
      await configStorage.saveConfig({ ...currentConfig, slotNames: updatedNames });
      console.log(pc.green(`✅ Cleared course name for ${slot} (was: ${prev}).`));
      return;
    }

    updatedNames[slot] = newName;
    await configStorage.saveConfig({ ...currentConfig, slotNames: updatedNames });
    console.log(pc.green(`✅ ${slot} is now labelled: ${pc.cyan(newName)}`));
  });

slotCommand
  .command("reset")
  .description("Clear all your saved timetable slots")
  .action(async () => {
    const currentConfig = await safeLoadConfig();
    if (!currentConfig) {
      console.log(pc.red("Config not found. Please run 'erp setup' first."));
      return;
    }

    await configStorage.saveConfig({
      ...currentConfig,
      savedSlots: [],
      slotNames: {},
    });

    console.log(pc.green("✅ All saved timetable slots have been cleared!"));
  });

slotCommand
  .command("week")
  .description("Render your enrolled timetable as a week grid")
  .action(async () => {
    const config = await safeLoadConfig();
    const savedSlots = config?.savedSlots || [];

    if (savedSlots.length === 0) {
      console.log(pc.yellow("⚠️ You have no saved slots. Run 'erp slot add <slots>' to add some."));
      return;
    }

    const cellMap = new Map<string, string>();
    for (const slotName of savedSlots) {
      const slot = STANDARD_SLOTS.find(s => s.name.toUpperCase() === slotName.toUpperCase());
      if (!slot) continue;
      for (const p of slot.periods) {
        cellMap.set(`${p.day}:${p.period}`, slot.name);
      }
    }

    const palette: Array<(s: string) => string> = [pc.green, pc.cyan, pc.yellow, pc.magenta, pc.blue, pc.red];
    const slotColor = new Map<string, (s: string) => string>();
    savedSlots.forEach((s, i) => slotColor.set(s, palette[i % palette.length]!));

    const DAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    const SHORT_TIMES = ['8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '2 PM', '3 PM', '4 PM', '5 PM'];
    const CELL_W = 8;

    console.log();
    console.log(pc.bold(pc.cyan('📅 Your Timetable Week\n')));

    let header = '      ';
    SHORT_TIMES.forEach((t, i) => {
      header += pc.dim(t.padEnd(CELL_W));
      if (i === 4) header += pc.dim('║ ');
    });
    console.log(header);
    console.log(pc.dim('      ' + '─'.repeat(CELL_W * 9 + 2)));

    for (const day of DAYS) {
      let row = pc.bold(day.padEnd(6));
      for (let p = 1; p <= 9; p++) {
        const slot = cellMap.get(`${day}:${p}`);
        if (slot) {
          const color = slotColor.get(slot)!;
          row += color(pc.bold(slot.padEnd(CELL_W)));
        } else {
          row += pc.dim('·'.padEnd(CELL_W));
        }
        if (p === 5) row += pc.dim('║ ');
      }
      console.log(row);
    }

    console.log();
    console.log(pc.dim('Legend:'));
    const slotNames = config?.slotNames ?? {};
    for (const s of savedSlots) {
      const slot = STANDARD_SLOTS.find(x => x.name.toUpperCase() === s.toUpperCase());
      if (slot) {
        const color = slotColor.get(s)!;
        const courseLabel = slotNames[s] ? ` ${pc.cyan(`— ${slotNames[s]}`)}` : '';
        console.log(`  ${color('■')} ${color(pc.bold(s))}${courseLabel} ${pc.dim(`(${slot.type}, ${slot.credits} cr)`)}`);
      } else {
        console.log(`  ${pc.red('✖')} ${pc.bold(s)} ${pc.dim('(not in central timetable)')}`);
      }
    }
    console.log(pc.dim(`  · = free   ║ = lunch break (1-2 PM)`));
    console.log();
  });

slotCommand
  .command("check <slot_name>")
  .description("Check if a specific slot clashes with your saved schedule")
  .action(async (slotName) => {
    const config = await safeLoadConfig();
    const savedSlots = config?.savedSlots || [];

    if (savedSlots.length === 0) {
      console.log(pc.yellow("⚠️ You have no saved slots. Assuming an empty schedule. (Run 'erp slot add <slots>' to add some)"));
    }

    const busyMap = TimetableEngine.buildBusyMap(savedSlots);
    
    try {
      const clashes = TimetableEngine.checkClashes(busyMap, slotName);
      if (clashes.length === 0) {
        console.log(pc.green(`✅ ${slotName.toUpperCase()} is completely free!`));
      } else {
        console.log(pc.red(`❌ Clash Detected! ${slotName.toUpperCase()} clashes with your saved slots: ${clashes.join(', ')}`));
      }
    } catch (e: any) {
      console.log(pc.red(`❌ ${e.message}`));
    }
  });

slotCommand
  .command("free [credits]")
  .description("Find free slots. Optionally specify credits (e.g. 3) to filter.")
  .action(async (creditsStr) => {
    const config = await safeLoadConfig();
    const savedSlots = config?.savedSlots || [];

    if (savedSlots.length === 0) {
      console.log(pc.yellow("⚠️ You have no saved slots. Assuming an empty schedule. (Run 'erp slot add <slots>' to add some)"));
    }

    const busyMap = TimetableEngine.buildBusyMap(savedSlots);
    
    if (creditsStr && creditsStr.toLowerCase() === 'lab') {
      const freeLabs = TimetableEngine.getFreeSlotsByCredits(busyMap, 'variable');
      console.log(pc.cyan(`\n📅 Free Lab slots:`));
      console.log(freeLabs.length > 0 ? pc.green(freeLabs.join(", ")) : pc.red("None found!"));
      console.log();
      return;
    }

    const credits = creditsStr ? parseInt(creditsStr, 10) : undefined;

    if (credits && !isNaN(credits)) {
      const freeSlots = TimetableEngine.getFreeSlotsByCredits(busyMap, credits);
      console.log(pc.cyan(`\n📅 Free ${credits}-credit slots:`));
      console.log(freeSlots.length > 0 ? pc.green(freeSlots.join(", ")) : pc.red("None found!"));
    } else {
      const free2 = TimetableEngine.getFreeSlotsByCredits(busyMap, 2);
      const free3 = TimetableEngine.getFreeSlotsByCredits(busyMap, 3);
      const free4 = TimetableEngine.getFreeSlotsByCredits(busyMap, 4);
      const freeLabs = TimetableEngine.getFreeSlotsByCredits(busyMap, 'variable');

      console.log(pc.cyan(`\n📅 Free 2-credit slots:`));
      console.log(free2.length > 0 ? pc.green(free2.join(", ")) : pc.red("None found!"));

      console.log(pc.cyan(`\n📅 Free 3-credit slots:`));
      console.log(free3.length > 0 ? pc.green(free3.join(", ")) : pc.red("None found!"));

      console.log(pc.cyan(`\n📅 Free 4-credit slots:`));
      console.log(free4.length > 0 ? pc.green(free4.join(", ")) : pc.red("None found!"));

      console.log(pc.cyan(`\n📅 Free Lab slots:`));
      console.log(freeLabs.length > 0 ? pc.green(freeLabs.join(", ")) : pc.red("None found!"));
    }
    console.log();
  });

slotCommand
  .command("stats")
  .description("Show a health-check summary of your saved timetable")
  .action(async () => {
    const config = await safeLoadConfig();
    const savedSlots = config?.savedSlots ?? [];
    const slotNames = config?.slotNames ?? {};

    if (savedSlots.length === 0) {
      console.log(pc.yellow("⚠️ You have no saved slots. Run 'erp slot add <slots>' to add some."));
      return;
    }

    let theoryCredits = 0;
    let labCount = 0;
    const periodsByDay: Record<string, number[]> = { MON: [], TUE: [], WED: [], THU: [], FRI: [] };
    let totalPeriods = 0;
    const unknown: string[] = [];

    for (const slotName of savedSlots) {
      const slot = STANDARD_SLOTS.find(s => s.name.toUpperCase() === slotName.toUpperCase());
      if (!slot) { unknown.push(slotName); continue; }

      if (slot.type === 'Lab') {
        labCount++;
      } else if (typeof slot.credits === 'number') {
        theoryCredits += slot.credits;
      }

      for (const p of slot.periods) {
        periodsByDay[p.day]!.push(p.period);
        totalPeriods++;
      }
    }

    let longestStretch = 0;
    let longestStretchDay = '';
    let longestStretchRange: [number, number] = [0, 0];
    for (const [day, plist] of Object.entries(periodsByDay)) {
      if (plist.length === 0) continue;
      const sorted = [...plist].sort((a, b) => a - b);
      let runStart = sorted[0]!;
      let prev = sorted[0]!;
      let runLen = 1;
      const finalize = (start: number, end: number, len: number) => {
        if (len > longestStretch) {
          longestStretch = len;
          longestStretchDay = day;
          longestStretchRange = [start, end];
        }
      };
      for (let i = 1; i < sorted.length; i++) {
        const p = sorted[i]!;
        const contiguous = p === prev + 1 && !(prev === 5 && p === 6);
        if (contiguous) { runLen++; }
        else { finalize(runStart, prev, runLen); runStart = p; runLen = 1; }
        prev = p;
      }
      finalize(runStart, prev, runLen);
    }

    const freeDays = Object.entries(periodsByDay).filter(([, ps]) => ps.length === 0).map(([d]) => d);
    const busiestEntry = Object.entries(periodsByDay).reduce((best, cur) => cur[1].length > best[1].length ? cur : best, ['', [] as number[]]);
    const busiestDay = busiestEntry[1].length > 0 ? busiestEntry[0] : null;

    console.log(pc.bold(pc.cyan('\n📊 Timetable Stats\n')));

    console.log(`  ${pc.bold('Slots saved:')}      ${savedSlots.length}  ${pc.dim(`(${savedSlots.length - labCount} theory, ${labCount} lab${labCount === 1 ? '' : 's'})`)}`);
    console.log(`  ${pc.bold('Theory credits:')}   ${theoryCredits}${labCount > 0 ? pc.dim(`  + ${labCount} lab${labCount === 1 ? '' : 's'} (variable)`) : ''}`);
    console.log(`  ${pc.bold('Periods used:')}     ${totalPeriods} / 45  ${pc.dim(`(${Math.round(totalPeriods / 45 * 100)}% of the week)`)}`);

    if (busiestDay) {
      console.log(`  ${pc.bold('Busiest day:')}      ${pc.yellow(busiestDay)}  ${pc.dim(`(${periodsByDay[busiestDay]!.length} periods)`)}`);
    }

    if (freeDays.length > 0) {
      console.log(`  ${pc.bold('Free days:')}        ${pc.green(freeDays.join(', '))}`);
    } else {
      console.log(`  ${pc.bold('Free days:')}        ${pc.dim('none — classes every weekday')}`);
    }

    if (longestStretch > 0) {
      const [s, e] = longestStretchRange;
      const rangeStr = s === e ? PERIOD_START[s]! : `${PERIOD_START[s]} – ${PERIOD_END[e]}`;
      const color = longestStretch >= 4 ? pc.red : longestStretch >= 3 ? pc.yellow : pc.green;
      console.log(`  ${pc.bold('Longest stretch:')}  ${color(`${longestStretch} periods`)}  ${pc.dim(`(${longestStretchDay} ${rangeStr})`)}`);
      if (longestStretch >= 4) {
        console.log(pc.dim(`    ⚠️  4+ back-to-back periods — consider a break.`));
      }
    }

    if (unknown.length > 0) {
      console.log(`  ${pc.red('Unknown slots:')}    ${unknown.join(', ')}  ${pc.dim('(not in central timetable)')}`);
    }

    const named = savedSlots.filter(s => slotNames[s]).length;
    if (named < savedSlots.length) {
      console.log(pc.dim(`\n  Tip: ${savedSlots.length - named} slot(s) have no course name. Use 'erp slot name <slot> <course>' to label them.`));
    }
    console.log();
  });

async function runSlot(...args: string[]) {
  await slotCommand.parseAsync(args, { from: "user" });
}

export async function slotMenu() {
  const { sub } = await prompts({
    type: "select",
    name: "sub",
    message: "Timetable — what do you want to see?",
    choices: [
      { title: "Week grid", value: "week" },
      { title: "List my saved slots", value: "list" },
      { title: "Stats summary", value: "stats" },
      { title: "Find free slots", value: "free" },
      { title: "Check if a slot fits", value: "check" },
      { title: "Back", value: "back" },
    ],
  });

  if (!sub || sub === "back") return;

  if (sub === "week")  return runSlot("week");
  if (sub === "list")  return runSlot();
  if (sub === "stats") return runSlot("stats");
  if (sub === "free")  return runSlot("free");

  if (sub === "check") {
    const { slot } = await prompts({
      type: "text",
      name: "slot",
      message: "Slot to check (e.g. D3, U4, q):",
    });
    if (!slot) return;
    return runSlot("check", slot);
  }
}
