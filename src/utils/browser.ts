import pc from "picocolors";

// Cross-platform browser open
export async function openBrowser(url: string): Promise<void> {
  const { exec } = await import("child_process");
  const openCmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;

  exec(openCmd, (err) => {
    if (err) {
      console.log(pc.yellow("Could not open browser. Open this URL manually:"));
      console.log(url);
    }
  });
}
