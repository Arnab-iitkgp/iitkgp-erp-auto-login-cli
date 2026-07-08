import { Command } from "commander";
import pc from "picocolors";
import { FileStorageService } from "../services/storage/file-storage.js";
import { FileSessionStorage } from "../services/storage/session-storage.js";
import { ErpClient } from "../services/erp/erp-client.js";
import { openBrowser } from "../utils/browser.js";
import { ConfigNotFoundError } from "../errors/config.js";

const TARGETS: Record<string, { path: string; label: string }> = {
  reg: {
    path: "/Academic/subjectRegistrationUGPG.htm",
    label: "Subject Registration",
  },
  home: {
    path: "/IIT_ERP3/home.htm",
    label: "Dashboard",
  },
};

function listTargets(): string {
  return Object.entries(TARGETS)
    .map(([k, v]) => `  ${pc.cyan(k.padEnd(10))} ${pc.dim(v.label)}`)
    .join("\n");
}

export const openAction = async function (target: string) {
  const key = target.toLowerCase();
  const dest = TARGETS[key];
  if (!dest) {
    console.log(pc.red(`Unknown target: ${target}`));
    console.log(pc.dim("Available:"));
    console.log(listTargets());
    process.exit(1);
  }

  const fileStorage = new FileStorageService();
  const sessionStorage = new FileSessionStorage();

  try {
    await fileStorage.loadConfig();
  } catch (e) {
    if (e instanceof ConfigNotFoundError) {
      console.log(pc.red("No config found. Run `erp setup` first."));
      process.exit(1);
    }
    throw e;
  }

  const session = await sessionStorage.loadSession();
  if (!session) {
    console.log(pc.red("No cached session. Run `erp login` first."));
    process.exit(1);
  }

  const alive = await ErpClient.sessionAlive(session.erpUrl, session.ssoToken);
  if (!alive) {
    console.log(pc.red("Cached session is dead. Run `erp login` to reconnect."));
    process.exit(1);
  }

  // Include ssoToken as a query param so the browser can bootstrap its cookie
  // jar even if the browser hadn't previously visited erp.iitkgp.ac.in.
  const url = `${session.erpUrl}${dest.path}?ssoToken=${session.ssoToken}`;

  console.log(pc.green(`✓ Opening ${dest.label}...`));
  await openBrowser(url);
};

export const openCommand = new Command("open")
  .description("Open a specific ERP page in your browser (e.g. `erp open reg`)")
  .argument("<target>", `page to open — one of: ${Object.keys(TARGETS).join(", ")}`)
  .action(openAction);
