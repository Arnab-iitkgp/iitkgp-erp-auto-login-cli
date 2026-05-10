import * as fs from "fs/promises";

export async function ensureDir(path: string) {
  await fs.mkdir(path, { recursive: true });
}