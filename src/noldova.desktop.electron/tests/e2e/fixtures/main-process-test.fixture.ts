/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { test as base, expect } from "@playwright/test";

import { BuildVariantFixture } from "./build-variant.fixture.ts";
import { CleanupSteps } from "./cleanup-steps.ts";
import { MainProcessFixture } from "./main-process.fixture.ts";

export const test = base.extend<{
  mainProcess: MainProcessFixture;
  mainProcessEnvironment: Readonly<Record<string, string>>;
  mainProcessDataFiles: Readonly<Record<string, string>>;
  mainProcessArguments: readonly string[];
  mainProcessVariant: string | null;
  mainProcessWindowPlacement: boolean;
}>({
  mainProcessEnvironment: [{}, { option: true }],
  mainProcessDataFiles: [{}, { option: true }],
  mainProcessArguments: [[], { option: true }],
  mainProcessVariant: [null, { option: true }],
  mainProcessWindowPlacement: [false, { option: true }],
  mainProcess: async ({ mainProcessEnvironment, mainProcessDataFiles, mainProcessArguments, mainProcessVariant, mainProcessWindowPlacement }, use, testInfo) => {
    let mainProcess: MainProcessFixture | null = null;
    let failure: { readonly error: unknown } | null = null;
    try {
      if (!Object.isNull(mainProcessVariant))
        await BuildVariantFixture.swapInAsync(mainProcessVariant);
      mainProcess = await MainProcessFixture.launchAsync(testInfo, mainProcessEnvironment, mainProcessDataFiles, mainProcessArguments, mainProcessWindowPlacement);
      await use(mainProcess);
    }
    catch (error) {
      failure = { error };
    }
    const cleanup = await CleanupSteps.collectFailuresAsync([
      async () => {
        await mainProcess?.disposeAsync();
      },
      () => BuildVariantFixture.restoreAsync()
    ]);
    await CleanupSteps.attachAsync(testInfo, cleanup);
    if (!Object.isNull(failure))
      throw failure.error;
    CleanupSteps.throwFailures(cleanup);
    expect(mainProcess?.failures).toEqual([]);
  }
});

export { expect };
