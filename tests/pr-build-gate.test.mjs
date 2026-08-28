import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("../.github/workflows/pages.yml", import.meta.url);

test("pull requests receive a production contract check without publication", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const buildStart = workflow.indexOf("\n  build:");
  const deployStart = workflow.indexOf("\n  deploy:");

  assert.notEqual(buildStart, -1, "the workflow should define a build job");
  assert.notEqual(deployStart, -1, "the workflow should define a deploy job");

  const buildJob = workflow.slice(buildStart, deployStart);
  const deployJob = workflow.slice(deployStart);

  assert.match(workflow, /pull_request:\s*\n\s+branches:\s*\n\s+- master/);
  assert.match(buildJob, /run: npm ci/);
  assert.match(buildJob, /run: npm test/);
  assert.doesNotMatch(buildJob, /pages: write|id-token: write/);
  assert.match(
    buildJob,
    /if: github\.event_name != 'pull_request'\s*\n\s+uses: actions\/configure-pages@/
  );
  assert.match(
    buildJob,
    /if: github\.event_name != 'pull_request'\s*\n\s+uses: actions\/upload-pages-artifact@/
  );
  assert.match(deployJob, /if: github\.event_name != 'pull_request'/);
});
