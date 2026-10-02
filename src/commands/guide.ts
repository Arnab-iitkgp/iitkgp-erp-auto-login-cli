import { Command } from "commander";
import pc from "picocolors";

type Example = { cmd: string; note?: string };
type Entry = { name: string; purpose: string; examples: Example[]; flags?: string };
type Section = { title: string; intro?: string; entries: Entry[] };

const GUIDE: Section[] = [
  {
    title: "Getting started",
    intro: "Run these once when you set up the CLI.",
    entries: [
      {
        name: "erp setup",
        purpose: "Configure your ERP roll, password, Gmail (for OTP), and security questions.",
        examples: [{ cmd: "erp setup", note: "interactive prompts" }],
      },
      {
        name: "erp status",
        purpose: "See what's currently saved. Pass --reveal to print secrets after re-entering your ERP password.",
        examples: [
          { cmd: "erp status" },
          { cmd: "erp status --reveal", note: "shows masked values unmasked" },
        ],
      },
      {
        name: "erp reset",
        purpose: "Wipe all credentials and saved config. Destructive — you'll need to re-run setup.",
        examples: [{ cmd: "erp reset" }],
      },
    ],
  },
  {
    title: "Logging in",
    entries: [
      {
        name: "erp login",
        purpose: "Auto-login to ERP and open the dashboard in your browser. Uses cached session if available.",
        examples: [
          { cmd: "erp login" },
          { cmd: "erp login --fresh", note: "skip cache, force a new OTP" },
          { cmd: "erp login --debug", note: "verbose request/response logging" },
        ],
      },
    ],
  },
  {
    title: "Manage your timetable",
    intro: "Slots are the building blocks. Lab slots accept either the bare letter (q) or canonical form (LAB:Q).",
    entries: [
      {
        name: "erp slot",
        purpose: "List every slot you've saved, with the time-of-day for each period and any course names.",
        examples: [{ cmd: "erp slot" }],
      },
      {
        name: "erp slot add <slots>",
        purpose: "Add one or more slots. Refuses the batch if any clash with each other or with your existing slots. Use slot=name to attach a course name in the same command.",
        examples: [
          { cmd: "erp slot add D3 U2 q", note: "three slots, no course names" },
          { cmd: "erp slot add D3=Algorithms U2=DSA", note: "with names via =" },
          { cmd: 'erp slot add "LAB:Q=AI Lab"', note: "quote when the name has spaces" },
        ],
      },
      {
        name: "erp slot remove <slots>",
        purpose: "Remove slots from your timetable. Reports what was removed and what wasn't found.",
        examples: [{ cmd: "erp slot remove D3 q" }],
      },
      {
        name: "erp slot name <slot> [course name...]",
        purpose: "Attach or update a course name on an already-saved slot. Omit the name to clear it.",
        examples: [
          { cmd: "erp slot name D3 Algorithms" },
          { cmd: "erp slot name D3 Operating Systems II", note: "multi-word, no quotes needed" },
          { cmd: "erp slot name D3", note: "clears the name" },
        ],
      },
      {
        name: "erp slot reset",
        purpose: "Clear every saved slot at once.",
        examples: [{ cmd: "erp slot reset" }],
      },
    ],
  },
  {
    title: "Plan & inspect",
    intro: "Use these during course and right before registration.",
    entries: [
      {
        name: "erp slot when <slot>",
        purpose: "Show when a slot meets — days, periods, and time-of-day. Works for any slot, whether saved or not.",
        examples: [
          { cmd: "erp slot when D3" },
          { cmd: "erp slot when q", note: "lab shortcut" },
        ],
      },
      {
        name: "erp slot check <slot>",
        purpose: "Check whether a single slot fits your saved schedule. Shows which slots it clashes with if not.",
        examples: [{ cmd: "erp slot check D3" }],
      },
      {
        name: "erp slot free [credits|lab]",
        purpose: "List slots that are completely free. With no argument: shows 2, 3, 4-credit, and lab options. Pass a credit count or 'lab' to filter.",
        examples: [
          { cmd: "erp slot free", note: "full summary" },
          { cmd: "erp slot free 3" },
          { cmd: "erp slot free lab" },
        ],
      },
      {
        name: "erp slot week",
        purpose: "Render your saved schedule as a color-coded 5x9 week grid with time-of-day headers.",
        examples: [{ cmd: "erp slot week" }],
      },
      {
        name: "erp slot stats",
        purpose: "Health-check summary: total credits, periods used, busiest day, free days, longest unbroken stretch.",
        examples: [{ cmd: "erp slot stats" }],
      },
    ],
  },
  {
    title: "About",
    entries: [
      {
        name: "erp devnote",
        purpose: "A short note from the dev — repo link, safety info, and where to drop feedback.",
        examples: [{ cmd: "erp devnote" }],
      },
    ],
  },
];

function render(): void {
  console.log();
  console.log(pc.bold(pc.cyan("ERP CLI -- Command Guide")));
  console.log(pc.dim("   Use 'erp <command> --help' for full flag details on any command.\n"));

  for (const section of GUIDE) {
    console.log(pc.bold(pc.yellow(`▌ ${section.title}`)));
    if (section.intro) console.log(pc.dim(`  ${section.intro}`));
    console.log();

    for (const entry of section.entries) {
      console.log(`  ${pc.bold(pc.green(entry.name))}`);
      console.log(`    ${entry.purpose}`);
      for (const ex of entry.examples) {
        const note = ex.note ? `  ${pc.dim(`# ${ex.note}`)}` : "";
        console.log(`    ${pc.cyan("$")} ${ex.cmd}${note}`);
      }
      console.log();
    }
  }

  console.log(pc.dim("Tip: every command supports --help for its own option list."));
  console.log();
}

export const guideCommand = new Command("guide")
  .alias("commands")
  .description("Show all commands grouped by intent, with examples and workflows")
  .action(render);

export { render as renderGuide };
