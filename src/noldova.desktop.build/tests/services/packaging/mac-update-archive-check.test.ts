/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { MacUpdateArchiveCheck } from "../../../src/services/packaging/mac-update-archive-check.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";

type Tree = { readonly isCurrentLinked: boolean | null; readonly program: string; readonly hasHelper: boolean; readonly added?: string };

class ExtractingRunner extends ProcessRunner {
  private readonly tree: Tree;

  public readonly calls: string[] = [];

  public constructor(tree: Tree) {
    super();
    this.tree = tree;
  }

  public override async requireAsync(command: string, commandArguments: readonly string[]): Promise<void> {
    this.calls.push([command, ...commandArguments.slice(0, 2)].join(" "));
    await MacUpdateArchiveCheckTests.writeAppAsync(path.join(commandArguments[3] ?? String.empty, MacUpdateArchiveCheckTests.BUNDLE), this.tree);
  }
}

@TestClass
export class MacUpdateArchiveCheckTests {
  public static readonly BUNDLE: string = "Sample App.app";
  private static readonly PACKAGED: Tree = { isCurrentLinked: true, program: "program", hasHelper: true };
  private static readonly FRAMEWORK: readonly string[] = ["Contents", "Frameworks", "Electron Framework.framework"];

  @TestMethod
  public async passesAnArchiveThatExtractsAsThePackagedApp(): Promise<void> {
    await MacUpdateArchiveCheckTests.withOutputAsync(MacUpdateArchiveCheckTests.PACKAGED, async (check, output, runner, work) => {
      const report = await check.verifyAsync("Sample App-1.0.0-mac.zip", output, "Sample App");

      Assert.areEqual("Sample App-1.0.0-mac.zip: the app extracts with ditto as packaged, 11 entries, with Versions/Current a link in each of its 1 frameworks.", report);
      Assert.areEqual("ditto -x -k", runner.calls.join("|"));
      Assert.isTrue(!existsSync(work), work);
    });
  }

  @TestMethod
  public async refusesAnArchiveWhoseFrameworkExtractsVersionsCurrentAsAFolder(): Promise<void> {
    await MacUpdateArchiveCheckTests.withOutputAsync({ ...MacUpdateArchiveCheckTests.PACKAGED, isCurrentLinked: false }, async (check, output, _runner, work) => {
      const message = await MacUpdateArchiveCheckTests.messageAsync(check, output);

      Assert.areEqual("The app in Sample App-1.0.0-mac.zip extracts with Versions/Current as no link in Contents/Frameworks/Electron Framework.framework, so its signature "
        + "would not hold.", message);
      Assert.isTrue(!existsSync(work), work);
    });
  }

  @TestMethod
  public async refusesAnArchiveWhoseFrameworkExtractsWithoutVersionsCurrent(): Promise<void> {
    await MacUpdateArchiveCheckTests.withOutputAsync({ ...MacUpdateArchiveCheckTests.PACKAGED, isCurrentLinked: null }, async (check, output) => {
      const message = await MacUpdateArchiveCheckTests.messageAsync(check, output);

      Assert.areEqual("The app in Sample App-1.0.0-mac.zip extracts with Versions/Current as no link in Contents/Frameworks/Electron Framework.framework, so its signature "
        + "would not hold.", message);
    });
  }

  @TestMethod
  public async refusesAnArchiveThatHoldsAFileThePackagedAppDoesNot(): Promise<void> {
    await MacUpdateArchiveCheckTests.withOutputAsync({ ...MacUpdateArchiveCheckTests.PACKAGED, added: "added" }, async (check, output) => {
      const message = await MacUpdateArchiveCheckTests.messageAsync(check, output);

      Assert.areEqual("The app in Sample App-1.0.0-mac.zip extracts unlike the packaged app in 1 entries:\n"
        + "  Contents/Resources/added: missing in the app, file of 5 bytes in the archive", message);
    });
  }

  @TestMethod
  public async showsOnlyTheFirstTenDifferences(): Promise<void> {
    await MacUpdateArchiveCheckTests.withOutputAsync({ ...MacUpdateArchiveCheckTests.PACKAGED, isCurrentLinked: true }, async (check, output, runner, work) => {
      for (const index of Array.from({ length: 12 }, (_, t) => t))
        await writeFile(path.join(output, "mac-arm64", MacUpdateArchiveCheckTests.BUNDLE, "Contents", `extra-${String(index).padStart(2, "0")}`), "extra");

      const message = await MacUpdateArchiveCheckTests.messageAsync(check, output);

      Assert.areEqual(11, message.split("\n").length, message);
      Assert.isTrue(message.startsWith("The app in Sample App-1.0.0-mac.zip extracts unlike the packaged app in 12 entries:\n  Contents/extra-00:"), message);
      Assert.areEqual(1, runner.calls.length);
      Assert.isFalse(existsSync(work));
    });
  }

  @TestMethod
  public async refusesAnArchiveWhoseTreeDiffersFromThePackagedApp(): Promise<void> {
    await MacUpdateArchiveCheckTests.withOutputAsync({ ...MacUpdateArchiveCheckTests.PACKAGED, program: "changed program", hasHelper: false }, async (check, output) => {
      const message = await MacUpdateArchiveCheckTests.messageAsync(check, output);

      Assert.areEqual([
        "The app in Sample App-1.0.0-mac.zip extracts unlike the packaged app in 3 entries:",
        "  Contents/MacOS/Sample App: file of 7 bytes in the app, file of 15 bytes in the archive",
        "  Contents/Resources: folder in the app, missing in the archive",
        "  Contents/Resources/helper: file of 6 bytes in the app, missing in the archive"
      ].join("\n"), message);
    });
  }

  @TestMethod
  public async refusesAnOutputWithoutExactlyOnePackagedApp(): Promise<void> {
    await MacUpdateArchiveCheckTests.withOutputAsync(MacUpdateArchiveCheckTests.PACKAGED, async (check, output, runner) => {
      await MacUpdateArchiveCheckTests.writeAppAsync(path.join(output, "mac-universal", MacUpdateArchiveCheckTests.BUNDLE), MacUpdateArchiveCheckTests.PACKAGED);
      const two = await MacUpdateArchiveCheckTests.messageAsync(check, output);
      const none = await MacUpdateArchiveCheckTests.messageAsync(check, path.join(output, "mac-universal"));

      Assert.areEqual(`electron-builder left 2 copies of Sample App.app in ${output}, so Sample App-1.0.0-mac.zip has no one app to match.`, two);
      Assert.areEqual(`electron-builder left 0 copies of Sample App.app in ${path.join(output, "mac-universal")}, so Sample App-1.0.0-mac.zip has no one app to match.`, none);
      Assert.areEqual(0, runner.calls.length);
    });
  }

  public static async writeAppAsync(application: string, tree: Tree): Promise<void> {
    const write = async (segments: readonly string[], text: string): Promise<void> => {
      const file = path.join(application, ...segments);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, text);
    };
    const framework = path.join(application, ...MacUpdateArchiveCheckTests.FRAMEWORK);
    await write(["Contents", "MacOS", "Sample App"], tree.program);
    await write([...MacUpdateArchiveCheckTests.FRAMEWORK, "Versions", "A", "Electron Framework"], "framework");
    if (tree.hasHelper)
      await write(["Contents", "Resources", "helper"], "helper");
    if (!Object.isUndefined(tree.added))
      await write(["Contents", "Resources", tree.added], tree.added);
    if (tree.isCurrentLinked === true)
      await symlink(path.join(framework, "Versions", "A"), path.join(framework, "Versions", "Current"), "junction");
    else if (tree.isCurrentLinked === false)
      await write([...MacUpdateArchiveCheckTests.FRAMEWORK, "Versions", "Current", "Electron Framework"], "framework");
  }

  private static async messageAsync(check: MacUpdateArchiveCheck, output: string): Promise<string> {
    let error: unknown = null;
    try {
      await check.verifyAsync("Sample App-1.0.0-mac.zip", output, "Sample App");
    }
    catch (thrown) {
      error = thrown;
    }
    Assert.isTrue(error instanceof BuildException, String(error));
    return error instanceof Error ? error.message : String(error);
  }

  private static async withOutputAsync(extracted: Tree, run: (check: MacUpdateArchiveCheck, output: string, runner: ExtractingRunner, work: string) => Promise<void>):
    Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "mac-update-archive-"));
    try {
      const output = path.join(folder, "out");
      const work = path.join(folder, "archive-check");
      await MacUpdateArchiveCheckTests.writeAppAsync(path.join(output, "mac-arm64", MacUpdateArchiveCheckTests.BUNDLE), MacUpdateArchiveCheckTests.PACKAGED);
      await writeFile(path.join(output, "Sample App-1.0.0-mac.zip"), "archive");
      const runner = new ExtractingRunner(extracted);
      await run(new MacUpdateArchiveCheck(runner, work, {}), output, runner, work);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
