import assert from "node:assert/strict";
import test from "node:test";
import { loadPagesWorkflow } from "../helpers/load-pages-workflow.mjs";

test("pull requests receive a production contract check without publication", async () => {
  const workflow = await loadPagesWorkflow();
  const buildJob = workflow.jobs.build;
  const deployJob = workflow.jobs.deploy;
  const configurePages = buildJob.steps.find((step) =>
    step.uses?.startsWith("actions/configure-pages@")
  );
  const uploadArtifact = buildJob.steps.find((step) =>
    step.uses?.startsWith("actions/upload-pages-artifact@")
  );

  assert.deepEqual(workflow.on.pull_request.branches, ["master"]);
  assert.ok(buildJob.steps.some((step) => step.run === "npm ci"));
  assert.ok(buildJob.steps.some((step) => step.run === "npm test"));
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.equal(buildJob.permissions, undefined);
  assert.equal(configurePages.if, "github.event_name != 'pull_request'");
  assert.equal(uploadArtifact.if, "github.event_name != 'pull_request'");
  assert.equal(deployJob.if, "github.event_name != 'pull_request'");
});
