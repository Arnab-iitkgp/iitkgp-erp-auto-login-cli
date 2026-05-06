#!/usr/bin/env node
import {Command} from 'commander'
import { loginCommand } from './commands/login.js';
import { setupCommand } from './commands/setup.js';

const program = new Command();

program.name('erp').description('ERP cli tool').version('1.0.0');

program.command('login').description('Login to erp').action(loginCommand)
program.command('setup').description('Setup ERP').action(setupCommand)
program.option("--debug", "Enable debug mode");
program.parse();

//TODO - ctrl +c exit.
// process.on("SIGINT", () => {
//   console.log("\nExiting...");
//   process.exit(0);
// });



// console.log("Hello from ERP CLI");