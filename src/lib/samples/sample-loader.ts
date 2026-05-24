import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  isAgentSampleMetadata,
  isStandardSampleDirectoryName,
  type AgentSampleMetadata,
} from "./sample-schema";

export type LoadedAgentSample = {
  id: string;
  directory: string;
  metadata: AgentSampleMetadata | null;
  files: Set<string>;
};

export async function getSamplesRoot(cwd = process.cwd()) {
  return path.join(cwd, "docs", "agent-samples");
}

async function pathExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listRelativeFiles(root: string) {
  const files = new Set<string>();

  async function walk(current: string, prefix = "") {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, relative);
      } else {
        files.add(relative.replaceAll("\\", "/"));
      }
    }
  }

  await walk(root);
  return files;
}

export async function loadStandardSamples(
  cwd = process.cwd(),
): Promise<LoadedAgentSample[]> {
  const root = await getSamplesRoot(cwd);
  const entries = await readdir(root, { withFileTypes: true });
  const samples: LoadedAgentSample[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !isStandardSampleDirectoryName(entry.name)) continue;
    const directory = path.join(root, entry.name);
    const samplePath = path.join(directory, "sample.json");
    const metadata = (await pathExists(samplePath))
      ? JSON.parse(await readFile(samplePath, "utf8"))
      : null;

    samples.push({
      id: entry.name,
      directory,
      metadata: isAgentSampleMetadata(metadata) ? metadata : null,
      files: await listRelativeFiles(directory),
    });
  }

  return samples;
}
