#!/usr/bin/env node
import { Command } from "commander";
import prompts from "prompts";
import pc from "picocolors";
import { loginCommand } from "./commands/login.js";
import { setupCommand } from "./commands/setup.js";
import { resetCommand } from "./commands/reset.js";
import { statusCommand } from "./commands/status.js";
import { banner } from "./utils/banner.js";

const program = new Command();

program
  .name("erp")
  .description("CLI tool for IIT KGP ERP auto-login")
  .version("1.0.0");

program
  .command("login")
  .description("Auto-login to ERP and open browser")
  .option("--fresh", "Skip cached session, force fresh OTP login")
  .action(loginCommand);

program
  .command("setup")
  .description("Configure credentials and security questions")
  .action(setupCommand);

program
  .command("reset")
  .description("Delete all saved credentials and config")
  .action(resetCommand);

program
  .command("status")
  .description("Show current configuration status (use --reveal to see secrets)")
  .option("--reveal", "Reveal secrets (requires ERP password)")
  .action(statusCommand);

async function main() {
  if (process.argv.length === 2) {
    console.log(pc.cyan(banner));

    const { action } = await prompts({
      type: "select",
      name: "action",
      message: "What would you like to do?",
      choices: [
        { title: "Login to ERP", value: "login" },
        { title: "Check status", value: "status" },
        { title: "Run setup", value: "setup" },
        { title: "Reset credentials", value: "reset" },
        { title: "See available commands", value: "help" },
        { title: "Exit", value: "exit" },
      ],
    });

    if (!action || action === "exit") {
      process.exit(0);
    }

    if (action === "help") {
      console.log(`\n${pc.dim("  Commands:")}`);
      console.log(`    ${pc.bold("erp login")}            Auto-login to ERP & open browser`);
      console.log(`    ${pc.bold("erp setup")}            Configure credentials & security questions`);
      console.log(`    ${pc.bold("erp status")}           Show saved config ${pc.dim("(--reveal to see secrets)")}`);
      console.log(`    ${pc.bold("erp reset")}            Delete all saved credentials`);
      console.log();
      return;
    }

    if (action === "login") await loginCommand();
    if (action === "status") await statusCommand({});
    if (action === "setup") await setupCommand();
    if (action === "reset") await resetCommand();
  } else {
    program.parse();
  }
}

main();