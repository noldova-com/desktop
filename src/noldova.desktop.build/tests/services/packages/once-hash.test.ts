/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildVariant } from "../../../src/models/modules/build-variant.js";
import { ContentHash } from "../../../src/services/packages/content-hash.js";
import { OnceHash } from "../../../src/services/packages/once-hash.js";
import { PackageBuild } from "../../../src/services/packages/package-build.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";
import { ModuleAppFixture } from "../../fixtures/module-app.fixture.js";

@TestClass
export class OnceHashTests {
  private static readonly HASH: string = "first";
  private static readonly OTHER_HASH: string = "second";
  private static readonly FAILURE: string = "The folder can't be read.";

  @TestMethod
  public async readsOnceForCallersAtTheSameTimeAndForLaterOnes(): Promise<void> {
    let reads = 0;
    const hash = new OnceHash(() => Promise.resolve(++reads === 1 ? OnceHashTests.HASH : OnceHashTests.OTHER_HASH));

    const answers = await Promise.all([hash.readAsync(), hash.readAsync()]);
    answers.push(await hash.readAsync());

    Assert.areEqual([OnceHashTests.HASH, OnceHashTests.HASH, OnceHashTests.HASH].join(), answers.join());
    Assert.areEqual(1, reads);
  }

  @TestMethod
  public async readsAgainAfterARejectionInsteadOfKeepingIt(): Promise<void> {
    let reads = 0;
    const hash = new OnceHash(() => ++reads === 1 ? Promise.reject(new Error(OnceHashTests.FAILURE)) : Promise.resolve(OnceHashTests.HASH));

    const failure = await Assert.throwsAsync(() => hash.readAsync(), Error);

    Assert.areEqual(OnceHashTests.FAILURE, failure.message);
    Assert.areEqual(OnceHashTests.HASH, await hash.readAsync());
    Assert.areEqual(OnceHashTests.HASH, await hash.readAsync());
    Assert.areEqual(2, reads);
  }

  @TestMethod
  public async hashesTheBuildsOwnPackageAtMostOnceOverTwoFingerprints(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    const build = new PackageBuild(app.path, new ProcessRunner(), await app.writeNpmAsync());
    const original = ContentHash.ofTreeAsync.bind(ContentHash);
    const outside: string[] = [];
    ContentHash.ofTreeAsync = (directory: string): Promise<string> => {
      if (!directory.startsWith(app.path))
        outside.push(directory);
      return original(directory);
    };

    try {
      const first = await build.hashFingerprintAsync(BuildVariant.REGULAR);
      const second = await build.hashFingerprintAsync(BuildVariant.REGULAR);

      Assert.areEqual(first, second);
      Assert.isTrue(outside.length <= 1, outside.join());
    }
    finally {
      ContentHash.ofTreeAsync = original;
    }
  }
}
