/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { SandboxValidator } from "../../../src/services/desktop/sandbox.validator.js";

@TestClass
export class SandboxValidatorTests {
  private static readonly EXECUTABLE: string = "/apps/sample/_build/development-app/sample-app";
  private static readonly HELPER: string = "/apps/sample/_build/development-app/chrome-sandbox";
  private static readonly RESTRICTED: Readonly<Record<string, string>> = { "/proc/sys/kernel/apparmor_restrict_unprivileged_userns": "1\n" };

  @TestMethod
  public async findsNoProblemOffLinuxOrWhereUserNamespacesAreAllowedAsync(): Promise<void> {
    const stats: string[] = [];
    const statAsync = (file: string): Promise<null> => {
      stats.push(file);
      return Promise.resolve(null);
    };

    const offLinux = await new SandboxValidator("darwin", SandboxValidatorTests.read(SandboxValidatorTests.RESTRICTED), statAsync).findProblemAsync(SandboxValidatorTests.EXECUTABLE);
    const allowed = await new SandboxValidator("linux", SandboxValidatorTests.read({}), statAsync).findProblemAsync(SandboxValidatorTests.EXECUTABLE);

    Assert.isNull(offLinux);
    Assert.isNull(allowed);
    Assert.areEqual(0, stats.length);
  }

  @TestMethod
  public async findsNoProblemWithoutAHelperOrWithARootSetuidHelperAsync(): Promise<void> {
    const statuses = [null, { uid: 0, mode: 0o104755 }];
    const files: string[] = [];

    for (const status of statuses) {
      const validator = new SandboxValidator("linux", SandboxValidatorTests.read(SandboxValidatorTests.RESTRICTED), t => {
        files.push(t);
        return Promise.resolve(status);
      });

      Assert.isNull(await validator.findProblemAsync(SandboxValidatorTests.EXECUTABLE));
    }
    Assert.areEqual(`${SandboxValidatorTests.HELPER}|${SandboxValidatorTests.HELPER}`, files.map(t => t.replaceAll("\\", "/")).join("|"));
  }

  @TestMethod
  public async asksForTheHelperToBeRootsWithTheSetuidBitAsync(): Promise<void> {
    for (const status of [{ uid: 1000, mode: 0o104755 }, { uid: 0, mode: 0o100755 }]) {
      const validator = new SandboxValidator("linux", SandboxValidatorTests.read(SandboxValidatorTests.RESTRICTED), () => Promise.resolve(status));

      const problem = await validator.findProblemAsync(SandboxValidatorTests.EXECUTABLE);

      const helper = path.join(path.dirname(SandboxValidatorTests.EXECUTABLE), "chrome-sandbox");
      Assert.isTrue(problem?.startsWith("This system restricts unprivileged user namespaces, so Chromium's sandbox needs its helper owned by root with the setuid bit.") === true, String(problem));
      Assert.isTrue(problem?.includes(`  sudo chown root:root '${helper}' && sudo chmod 4755 '${helper}'`) === true, String(problem));
    }
  }

  @TestMethod
  public async readsAndStatsOnlyFilesThatExistAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-sandbox-"));
    try {
      const file = path.join(folder, "setting");
      await writeFile(file, "1\n");

      Assert.areEqual("1\n", await SandboxValidator.readOptionalTextAsync(file));
      Assert.isNull(await SandboxValidator.readOptionalTextAsync(path.join(folder, "missing")));
      Assert.areEqual(2, (await SandboxValidator.statOptionalAsync(file))?.size);
      Assert.isNull(await SandboxValidator.statOptionalAsync(path.join(folder, "missing")));
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }

  private static read(files: Readonly<Record<string, string>>): (file: string) => Promise<string | null> {
    return t => Promise.resolve(files[t] ?? null);
  }
}
