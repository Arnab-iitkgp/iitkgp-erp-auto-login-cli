import { Command } from "commander";
import pc from "picocolors";

const REPO_URL = "https://github.com/Arnab-iitkgp/erp-auto-login-cli";
const ISSUES_URL = `${REPO_URL}/issues`;

function render(): void {
  console.log();
  console.log(pc.bold(pc.cyan("A note from the dev")));
  console.log();
  console.log(`  Hey, I'm ${pc.bold("Arnab")} -- built this CLI to make ERP a little less painful.`);
  console.log(`  Hope it saves you some time during login, slot checking and registration.`);
  console.log();
  console.log(`  ${pc.bold("It's safe.")} The codebase is fully open-source -- go read it, audit it,`);
  console.log(`  or fork it. Your credentials never leave your pc.`);
  console.log();
  console.log(`  ${pc.bold("Repo:")}     ${pc.cyan(REPO_URL)}`);
  console.log(`  ${pc.bold("Feedback:")} ${pc.cyan(ISSUES_URL)}`);
  console.log();
  console.log(pc.dim(`  If this tool helped you, a ⭐ on the repo means a lot. Thanks!`));
  console.log();
}

export const devnoteCommand = new Command("devnote")
  .description("A short note from the dev -- repo link, feedback, and why this exists")
  .action(render);

export { render as renderDevnote };
