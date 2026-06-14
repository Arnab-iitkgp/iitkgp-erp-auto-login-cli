#!/usr/bin/env node
import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { setupCommand } from "./commands/setup.js";
import { resetCommand } from "./commands/reset.js";
import { statusCommand } from "./commands/status.js";

const program = new Command();

program
  .name("erp")
  .description("CLI tool for IIT KGP ERP auto-login")
  .version("1.0.0");

program
  .command("login")
  .description("Auto-login to ERP and open browser")
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
  .description("Show current configuration status")
  .option("--reveal", "Reveal security answers (requires ERP password)")
  .action(statusCommand);

program.parse();