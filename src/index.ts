#!/usr/bin/env node
import { Command } from "commander";
import prompts from "prompts";
import pc from "picocolors";
import { loginCommand, loginAction } from "./commands/login.js";
import { setupCommand, setupAction } from "./commands/setup.js";
import { resetCommand, resetAction } from "./commands/reset.js";
import { statusCommand, statusAction } from "./commands/status.js";
import { slotCommand, slotMenu } from "./commands/slot.js";
import { guideCommand, renderGuide } from "./commands/guide.js";
import { devnoteCommand, renderDevnote } from "./commands/devnote.js";
import { banner } from "./utils/banner.js";

const program = new Command();

program
  .name("erp")
  .description("CLI tool for IIT KGP ERP auto-login")
  .version("1.0.0");

program.addCommand(loginCommand);
program.addCommand(setupCommand);
program.addCommand(resetCommand);
program.addCommand(statusCommand);
program.addCommand(slotCommand);
program.addCommand(guideCommand);
program.addCommand(devnoteCommand);

async function main() {
  if (process.argv.length === 2) {
    console.log(pc.cyan(banner));

    const { action } = await prompts({
      type: "select",
      name: "action",
      message: "What would you like to do?",
      choices: [
        { title: "Login to ERP", value: "login" },
        { title: "Manage timetable", value: "slot" },
        { title: "Check status", value: "status" },
        { title: "Run setup", value: "setup" },
        { title: "Reset credentials", value: "reset" },
        { title: "See available commands", value: "help" },
        { title: "A note from the dev", value: "devnote" },
        { title: "Exit", value: "exit" },
      ],
    });

    if (!action || action === "exit") {
      process.exit(0);
    }

    if (action === "help") {
      renderGuide();
      return;
    }

    if (action === "devnote") {
      renderDevnote();
      return;
    }

    if (action === "slot") {
      await slotMenu();
      return;
    }

    if (action === "login") await loginAction();
    if (action === "status") await statusAction({});
    if (action === "setup") await setupAction();
    if (action === "reset") await resetAction();
  } else {
    program.parse();
  }
}

main();