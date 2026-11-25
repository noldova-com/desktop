/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import "@noldova/context.core";

import { UiWorkflowBuild } from "../ui-workflow-build.ts";
import { UiWorkflowsResources } from "../ui-workflows.resources.ts";

const VARIANT = new UiWorkflowBuild(["--test", "--output", "_build/variants/a"], ["_build", "variants", "a"]);
const SPEC_VARIANT = new UiWorkflowBuild(["--test", "--document-tabs", "--output", "_build/variants/b"], ["_build", "variants", "b"], "b.spec.ts");
const WINDOW = new UiWorkflowBuild(["--test"], ["_build", "window"]);
const BUILDS = [VARIANT, SPEC_VARIANT, WINDOW];

function choose(listing: string | null, built: readonly UiWorkflowBuild[] = []): readonly UiWorkflowBuild[] {
  return UiWorkflowBuild.choose(BUILDS, listing, t => built.includes(t));
}

describe("the UI workflows' builds", () => {
  it("builds a spec's variant when the run lists that spec, keeping the order with the test build last", () => {
    assert.deepEqual(choose("Listing tests:\n  a.spec.ts:4:3 › a\n  b.spec.ts:12:5 › b\nTotal: 2 tests in 2 files\n"), BUILDS);
  });

  it("leaves a spec's variant out when the run, such as another shard, doesn't list that spec", () => {
    assert.deepEqual(choose("Listing tests:\n  a.spec.ts:4:3 › a\n  ab.spec.ts:7:3 › ab\nTotal: 2 tests in 2 files\n"), [VARIANT, WINDOW]);
  });

  it("keeps a spec's variant that is already built, so a run of other specs doesn't make the record stale", () => {
    assert.deepEqual(choose(null, [SPEC_VARIANT]), BUILDS);
  });

  it("builds every variant without a spec of its own in every run", () => {
    assert.deepEqual(choose(String.empty), [VARIANT, WINDOW]);
  });

  it("names the document-tabs variant's spec and ends with the test build, which writes the window's product file back for the app as it is", () => {
    const documentTabs = UiWorkflowsResources.builds.filter(t => t.buildArguments.includes("--document-tabs"));

    assert.deepEqual(documentTabs.map(t => [t.spec, t.output.join("/")]), [[UiWorkflowsResources.documentTabsSpec, "_build/variants/document-tabs"]]);
    assert.deepEqual(UiWorkflowsResources.builds.at(-1)?.buildArguments, ["--test"]);
  });
});
