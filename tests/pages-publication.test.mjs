import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";

const workflowUrl = new URL("../.github/workflows/pages.yml", import.meta.url);

test("successful builds publish and verify the canonical Pages URL", async () => {
  const source = await readFile(workflowUrl, "utf8");
  const workflow = parse(source);
  const buildJob = workflow.jobs.build;
  const deployJob = workflow.jobs.deploy;
  const verifyJob = workflow.jobs.verify;
  const deployStep = deployJob.steps.find((step) =>
    step.uses?.startsWith("actions/deploy-pages@")
  );

  assert.deepEqual(workflow.on.push.branches, ["master"]);
  assert.ok(Object.hasOwn(workflow.on, "workflow_dispatch"));
  assert.deepEqual(workflow.concurrency, {
    group: "pages",
    "cancel-in-progress": false
  });
  assert.ok(buildJob.steps.some((step) => step.run === "npm ci"));
  assert.ok(buildJob.steps.some((step) => step.run === "npm test"));
  assert.equal(deployJob.needs, "build");
  assert.deepEqual(deployJob.permissions, {
    pages: "write",
    "id-token": "write"
  });
  assert.equal(deployJob.environment.name, "github-pages");
  assert.equal(deployStep.id, "deployment");
  assert.equal(
    deployJob.outputs.page_url,
    "${{ steps.deployment.outputs.page_url }}"
  );
  assert.equal(verifyJob.needs, "deploy");
  assert.ok(
    verifyJob.steps.some(
      (step) =>
        step.run?.includes("curl") &&
        step.run.includes("--fail") &&
        step.run.includes("--retry") &&
        step.run.includes("${{ needs.deploy.outputs.page_url }}")
    )
  );
});
