import { readFile } from "node:fs/promises";
import { parse } from "yaml";

const workflowUrl = new URL("../../.github/workflows/pages.yml", import.meta.url);

export async function loadPagesWorkflow() {
  return parse(await readFile(workflowUrl, "utf8"));
}
