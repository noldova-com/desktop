/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProcessTimeoutException } from "../../../src/exceptions/process-timeout.exception.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { Resources } from "../../../src/resources.js";
import { StoppedInstaller } from "../../../src/services/packaging/stopped-installer.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";

class ListingRunner extends ProcessRunner {
  private readonly answer: () => Promise<ProcessResult>;

  public readonly calls: string[] = [];
  public script: string | undefined;
  public variable: string | undefined;

  public constructor(answer: () => Promise<ProcessResult>) {
    super();
    this.answer = answer;
  }

  public override captureAsync(command: string, commandArguments: readonly string[], _directory: string, timeout: number, environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    this.calls.push(`${command} ${commandArguments.slice(0, -1).join(" ")} ${timeout}`);
    this.script = Buffer.from(commandArguments.at(-1) ?? String.empty, "base64").toString("utf16le");
    this.variable = environment?.["NOLDOVA_DESKTOP_INSTALLER_PROCESS"];
    return this.answer();
  }
}

@TestClass
export class StoppedInstallerTests {
  private static readonly NOTHING_INSTALLED: string = "The installer had not created";

  private static async withFolderAsync(run: (folder: string, installFolder: string, temporary: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-build-stopped-"));
    try {
      const temporary = path.join(folder, "temporary");
      await mkdir(temporary);
      await run(folder, path.join(folder, "Programs", "sample-app"), temporary);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static async writeAsync(file: string, text: string): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
  }

  private static nothing(): Promise<ProcessResult> {
    return Promise.reject(new Error("Nothing should run."));
  }

  @TestMethod
  public async describesTheTemporaryFolderTheInstallerMadeAndWhatItHeld(): Promise<void> {
    await StoppedInstallerTests.withFolderAsync(async (folder, installFolder, temporary) => {
      const started = Date.now();
      const made = path.join(temporary, "nsq3A1.tmp");
      await StoppedInstallerTests.writeAsync(path.join(made, "app-64.7z"), "archive");
      await StoppedInstallerTests.writeAsync(path.join(made, "7z-out", "Sample App.exe"), "app");
      await StoppedInstallerTests.writeAsync(path.join(made, "7z-out", "resources", "app.asar"), "asar");
      await StoppedInstallerTests.writeAsync(path.join(made, "nsExec.dll"), "dll");
      const earlier = path.join(temporary, "nsB7.tmp");
      await StoppedInstallerTests.writeAsync(path.join(earlier, "app-64.7z"), "old");
      await utimes(earlier, new Date(started - 60_000), new Date(started - 60_000));
      await StoppedInstallerTests.writeAsync(path.join(temporary, "other", "file"), "other");
      await StoppedInstallerTests.writeAsync(path.join(temporary, "ns1.tmp"), "a file, not a folder");

      const description = await new StoppedInstaller(new ListingRunner(StoppedInstallerTests.nothing), folder, {}).describeAsync(installFolder, temporary, started, undefined);

      Assert.areEqual([`${StoppedInstallerTests.NOTHING_INSTALLED} ${installFolder}.`, `The installer's temporary folder ${made} held:`, "7z-out: 2 files, 7 bytes",
        "app-64.7z: 7 bytes", "nsExec.dll: 3 bytes"].join("\n"), description);
    });
  }

  @TestMethod
  public async saysWhenTheInstallerLeftNoTemporaryFolderOrItsFolderIsUnknown(): Promise<void> {
    await StoppedInstallerTests.withFolderAsync(async (folder, installFolder, temporary) => {
      const stopped = new StoppedInstaller(new ListingRunner(StoppedInstallerTests.nothing), folder, {});
      const missing = path.join(temporary, "missing");

      const empty = await stopped.describeAsync(installFolder, temporary, Date.now(), undefined);
      const gone = await stopped.describeAsync(installFolder, missing, Date.now(), undefined);
      const unknown = await stopped.describeAsync(installFolder, undefined, Date.now(), undefined);

      Assert.areEqual(`${StoppedInstallerTests.NOTHING_INSTALLED} ${installFolder}.\n${temporary} held no temporary folder the installer had made.`, empty);
      Assert.areEqual(`${StoppedInstallerTests.NOTHING_INSTALLED} ${installFolder}.\n${missing} held no temporary folder the installer had made.`, gone);
      Assert.areEqual(`${StoppedInstallerTests.NOTHING_INSTALLED} ${installFolder}.\nThe installer's temporary folder is unknown: neither TMP nor TEMP is set.`, unknown);
    });
  }

  @TestMethod
  public async listsWhatTheInstallerStartedThatStillRuns(): Promise<void> {
    await StoppedInstallerTests.withFolderAsync(async (folder, installFolder, temporary) => {
      await StoppedInstallerTests.writeAsync(path.join(installFolder, "Sample App.exe"), "app");
      const listed = "5120 powershell.exe, started 15:10:06: powershell.exe -NoProfile -NonInteractive -C \"Get-CimInstance -ClassName Win32_Process\"";
      const runner = new ListingRunner(() => Promise.resolve(new ProcessResult(0, `${listed}\r\n`, String.empty)));

      const description = await new StoppedInstaller(runner, folder, { SystemRoot: "C:\\Windows" }).describeAsync(installFolder, temporary, Date.now(), 4242);

      Assert.areEqual([`${installFolder} held 1 files when the installer was stopped:`, "Sample App.exe: 3 bytes", `${temporary} held no temporary folder the installer had made.`,
        "What the installer, process 4242, had started and was still running after it was stopped:", listed].join("\n"), description);
      Assert.areEqual("powershell.exe -NoProfile -NonInteractive -EncodedCommand 30000", runner.calls.join(";"));
      Assert.areEqual(Resources.installerProcessesScript, runner.script);
      Assert.areEqual("4242", runner.variable);
    });
  }

  @TestMethod
  public async saysWhenNothingTheInstallerStartedStillRuns(): Promise<void> {
    await StoppedInstallerTests.withFolderAsync(async (folder, installFolder, temporary) => {
      const runner = new ListingRunner(() => Promise.resolve(new ProcessResult(0, " \r\n", String.empty)));

      const description = await new StoppedInstaller(runner, folder, {}).describeAsync(installFolder, temporary, Date.now(), 4242);

      Assert.isTrue(description.endsWith("\nNothing the installer, process 4242, had started was still running after it was stopped."), description);
    });
  }

  @TestMethod
  public async saysWhenTheInstallersProcessesCannotBeListed(): Promise<void> {
    await StoppedInstallerTests.withFolderAsync(async (folder, installFolder, temporary) => {
      const failed = new ListingRunner(() => Promise.resolve(new ProcessResult(1, String.empty, "Get-CimInstance : Access denied")));
      const timeout = new ProcessTimeoutException("powershell.exe", 30_000);
      const stalled = new ListingRunner(() => Promise.reject(timeout));

      const refused = await new StoppedInstaller(failed, folder, {}).describeAsync(installFolder, temporary, Date.now(), 4242);
      const unfinished = await new StoppedInstaller(stalled, folder, {}).describeAsync(installFolder, temporary, Date.now(), 4242);

      Assert.isTrue(refused.endsWith("\nWhat the installer, process 4242, had started could not be listed: powershell.exe exited with 1:\nGet-CimInstance : Access denied"), refused);
      Assert.isTrue(unfinished.endsWith(`\nWhat the installer, process 4242, had started could not be listed: ${String(timeout)}`), unfinished);
    });
  }

  @TestMethod
  public async namesAListingFailureThatIsNoTimeoutRatherThanThrowingIt(): Promise<void> {
    await StoppedInstallerTests.withFolderAsync(async (folder, installFolder, temporary) => {
      const failure = new BuildException("powershell.exe could not start.");
      const runner = new ListingRunner(() => Promise.reject(failure));

      const description = await new StoppedInstaller(runner, folder, {}).describeAsync(installFolder, temporary, Date.now(), 4242);

      Assert.isTrue(description.endsWith(`\nWhat the installer, process 4242, had started could not be listed: ${String(failure)}`), description);
    });
  }

  @TestMethod
  public async namesAnEntryOrFolderItCannotReadAndDescribesTheRest(): Promise<void> {
    await StoppedInstallerTests.withFolderAsync(async (folder, installFolder, temporary) => {
      const started = Date.now();
      const made = path.join(temporary, "nsq3A1.tmp");
      await StoppedInstallerTests.writeAsync(path.join(made, "app-64.7z"), "archive");
      const gone = path.join(made, "gone");
      await symlink(path.join(folder, "missing"), gone, "junction");
      const notFolder = path.join(folder, "not-a-folder");
      await writeFile(notFolder, "a file");
      const stopped = new StoppedInstaller(new ListingRunner(StoppedInstallerTests.nothing), folder, {});

      const description = await stopped.describeAsync(installFolder, temporary, started, undefined);
      const unlisted = await stopped.describeAsync(notFolder, notFolder, started, undefined);

      const lines = description.split("\n");
      Assert.areEqual(4, lines.length, description);
      Assert.areEqual(`The installer's temporary folder ${made} held:`, lines[1]);
      Assert.areEqual("app-64.7z: 7 bytes", lines[2]);
      Assert.isTrue((lines[3] ?? String.empty).startsWith(`${gone} could not be read: Error: ENOENT`), description);
      const unlistedLines = unlisted.split("\n");
      Assert.areEqual(4, unlistedLines.length, unlisted);
      Assert.areEqual(`${notFolder} held 0 files when the installer was stopped:`, unlistedLines[0]);
      Assert.isTrue((unlistedLines[1] ?? String.empty).startsWith(`${notFolder} could not be read: Error: `), unlisted);
      Assert.areEqual(`${notFolder} held no temporary folder the installer had made.`, unlistedLines[2]);
      Assert.isTrue((unlistedLines[3] ?? String.empty).startsWith(`${notFolder} could not be read: Error: `), unlisted);
    });
  }
}
