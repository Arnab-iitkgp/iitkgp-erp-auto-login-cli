import pc from "picocolors";
import { banner } from "./utils/banner.js";

console.log(pc.cyan(banner));
console.log(pc.green("Successfully installed kgp-erp-cli!\n"));
console.log(pc.yellow("To get started, run the following command to configure your credentials:"));
console.log(pc.bold(pc.white("  erp setup\n")));
console.log(pc.yellow("After setup, just type:"));
console.log(pc.bold(pc.white("  erp\n")));
