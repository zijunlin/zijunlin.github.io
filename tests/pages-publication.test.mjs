import assert from "node:assert/strict";
import test from "node:test";
import { loadPagesWorkflow } from "./helpers/load-pages-workflow.mjs";

test("successful builds publish and verify the canonical Pages URL", async () => {
  const workflow = await loadPagesWorkflow();
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
  assert.deepEqual(verifyJob.env, {
    DEPLOYED_URL: "${{ needs.deploy.outputs.page_url }}",
    CANONICAL_URL: "https://zijunlin.github.io/"
  });

  const verificationCommand = verifyJob.steps.find((step) => step.run).run;
  assert.match(verificationCommand, /DEPLOYED_URL/);
  assert.match(verificationCommand, /CANONICAL_URL/);
  assert.match(verificationCommand, /--fail/);
  assert.match(verificationCommand, /--location/);
  assert.match(verificationCommand, /--retry/);
  assert.match(verificationCommand, /--write-out/);
  assert.match(verificationCommand, /%\{url_effective\}/);
  assert.match(verificationCommand, /text\/html/);
});
