/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { Resources } from "../../../src/resources.js";
import { DebianInstall } from "../../../src/services/packaging/debian-install.js";
import { ScriptedRunnerFixture } from "../../fixtures/scripted-runner.fixture.js";

@TestClass
export class DebianInstallTests {
  private static readonly FILE: string = "/work/out/Sample App-linux-x64.deb";
  private static readonly FOLDER: string = "/work";
  private static readonly SLUG: string = "sample-app";
  private static readonly PROGRAM: string = "/opt/Sample App/sample-app";
  private static readonly HELPER: string = "/opt/Sample App/chrome-sandbox";
  private static readonly SOURCE: string = "/opt/Sample App/resources/apparmor-profile";
  private static readonly PROFILE: string = "/etc/apparmor.d/sample-app";
  private static readonly FIELD: string = `dpkg-deb --field ${DebianInstallTests.FILE} Package`;
  private static readonly INSTALL: string = `sudo --non-interactive apt-get install --yes ${DebianInstallTests.FILE}`;
  private static readonly LINK: string = "readlink --canonicalize-existing /usr/bin/sample-app";
  private static readonly PROBE: string = `sudo --non-interactive bash -c ${Resources.debianNamespaceProbe}`;
  private static readonly STAT: string = `stat --format=%u:%a ${DebianInstallTests.HELPER}`;
  private static readonly ENABLED: string = "sudo --non-interactive apparmor_status --enabled";
  private static readonly PARSE: string = `sudo --non-interactive apparmor_parser --skip-kernel-load --debug ${DebianInstallTests.SOURCE}`;
  private static readonly PROFILE_MISSING: string = `test ! -e ${DebianInstallTests.PROFILE}`;
  private static readonly FOLDER_MISSING: string = "test ! -e /opt/Sample App";
  private static readonly COMPARE: string = `cmp --silent ${DebianInstallTests.SOURCE} ${DebianInstallTests.PROFILE}`;
  private static readonly LOADED: string = "sudo --non-interactive grep --quiet --fixed-strings --line-regexp sample-app (unconfined) /sys/kernel/security/apparmor/profiles";
  private static readonly REMOVE: string = "sudo --non-interactive apt-get remove --yes sample-app";
  private static readonly FAILURE: ProcessResult = new ProcessResult(1, String.empty, "refused");

  @TestMethod
  public async installsThePackageAndFindsItsProgramThroughItsCommandAsync(): Promise<void> {
    const runner = DebianInstallTests.createRunner(new Map());

    const install = await DebianInstall.installAsync(runner, DebianInstallTests.FILE, DebianInstallTests.SLUG, DebianInstallTests.FOLDER);

    Assert.areEqual("sample-app", install.packageName);
    Assert.areEqual(DebianInstallTests.PROGRAM, install.installed.program);
    Assert.areEqual(DebianInstallTests.PROGRAM, install.installed.mainProcess);
    Assert.isNull(install.installed.command);
    Assert.areEqual("/opt/Sample App/resources", install.installed.resources);
    Assert.areEqual([DebianInstallTests.FIELD, DebianInstallTests.INSTALL, DebianInstallTests.LINK].join("\n"), runner.captured.join("\n"));
    Assert.isTrue(runner.folders.every(folder => folder === DebianInstallTests.FOLDER));
  }

  @TestMethod
  public async refusesAPackageWithoutANameAsync(): Promise<void> {
    const failed = DebianInstallTests.createRunner(new Map([[DebianInstallTests.FIELD, DebianInstallTests.FAILURE]]));
    const empty = DebianInstallTests.createRunner(new Map([[DebianInstallTests.FIELD, new ProcessResult(0, " \n", String.empty)]]));

    const failure = await Assert.throwsAsync(() => DebianInstall.installAsync(failed, DebianInstallTests.FILE, DebianInstallTests.SLUG, DebianInstallTests.FOLDER), BuildException);
    const blank = await Assert.throwsAsync(() => DebianInstall.installAsync(empty, DebianInstallTests.FILE, DebianInstallTests.SLUG, DebianInstallTests.FOLDER), BuildException);

    Assert.areEqual(Resources.formatDebianPackageUnnamed(DebianInstallTests.FILE, 1, "refused"), failure.message);
    Assert.areEqual(Resources.formatDebianPackageUnnamed(DebianInstallTests.FILE, 0, String.empty), blank.message);
    Assert.areEqual(DebianInstallTests.FIELD, failed.captured.join("\n"));
  }

  @TestMethod
  public async reportsAnInstallThatFailsAsync(): Promise<void> {
    const runner = DebianInstallTests.createRunner(new Map([[DebianInstallTests.INSTALL, DebianInstallTests.FAILURE]]));

    const error = await Assert.throwsAsync(() => DebianInstall.installAsync(runner, DebianInstallTests.FILE, DebianInstallTests.SLUG, DebianInstallTests.FOLDER), BuildException);

    Assert.areEqual(Resources.formatProcessFailed("sudo", [Resources.sudoNonInteractiveOption, Resources.aptGetCommand, ...Resources.aptGetInstallArguments, DebianInstallTests.FILE], 1, "refused"),
      error.message);
    Assert.areEqual([DebianInstallTests.FIELD, DebianInstallTests.INSTALL].join("\n"), runner.captured.join("\n"));
  }

  @TestMethod
  public async refusesAnInstallThatLeavesNoCommandForItsProgramAsync(): Promise<void> {
    const failed = DebianInstallTests.createRunner(new Map([[DebianInstallTests.LINK, DebianInstallTests.FAILURE]]));
    const empty = DebianInstallTests.createRunner(new Map([[DebianInstallTests.LINK, ScriptedRunnerFixture.SUCCESS]]));

    const failure = await Assert.throwsAsync(() => DebianInstall.installAsync(failed, DebianInstallTests.FILE, DebianInstallTests.SLUG, DebianInstallTests.FOLDER), BuildException);
    const blank = await Assert.throwsAsync(() => DebianInstall.installAsync(empty, DebianInstallTests.FILE, DebianInstallTests.SLUG, DebianInstallTests.FOLDER), BuildException);

    Assert.areEqual(Resources.formatDebianCommandUnresolved("/usr/bin/sample-app", 1, "refused"), failure.message);
    Assert.areEqual(Resources.formatDebianCommandUnresolved("/usr/bin/sample-app", 0, String.empty), blank.message);
    Assert.areEqual([DebianInstallTests.FIELD, DebianInstallTests.INSTALL, DebianInstallTests.LINK, DebianInstallTests.REMOVE].join("\n"), failed.captured.join("\n"));
  }

  @TestMethod
  public async findsAPlainSandboxHelperAndALoadedProfileWhereRootCreatesUserNamespacesAsync(): Promise<void> {
    const runner = DebianInstallTests.createRunner(new Map());
    const install = await DebianInstallTests.installAsync(runner);

    const verified = await install.verifyAsync();

    Assert.areEqual([
      Resources.formatDebianSandboxHelperChecked(DebianInstallTests.HELPER, "0:755", true),
      Resources.formatDebianProfileInstalled(DebianInstallTests.PROFILE)
    ].join(Resources.lineSeparator), verified);
    Assert.areEqual([
      DebianInstallTests.PROBE, DebianInstallTests.STAT, DebianInstallTests.ENABLED, DebianInstallTests.PARSE, DebianInstallTests.COMPARE, DebianInstallTests.LOADED
    ].join("\n"), runner.captured.slice(3).join("\n"));
  }

  @TestMethod
  public async expectsASetuidSandboxHelperWhereRootCannotCreateUserNamespacesAsync(): Promise<void> {
    const runner = DebianInstallTests.createRunner(new Map([
      [DebianInstallTests.PROBE, DebianInstallTests.FAILURE],
      [DebianInstallTests.STAT, new ProcessResult(0, "0:4755\n", String.empty)]
    ]));
    const install = await DebianInstallTests.installAsync(runner);

    const verified = await install.verifyAsync();

    Assert.isTrue(verified.startsWith(Resources.formatDebianSandboxHelperChecked(DebianInstallTests.HELPER, "0:4755", false)), verified);
  }

  @TestMethod
  public async refusesASandboxHelperTheScriptWouldNotLeaveAsync(): Promise<void> {
    const setuid = DebianInstallTests.createRunner(new Map([[DebianInstallTests.STAT, new ProcessResult(0, "0:4755\n", String.empty)]]));
    const missing = DebianInstallTests.createRunner(new Map([[DebianInstallTests.STAT, DebianInstallTests.FAILURE]]));
    const plain = DebianInstallTests.createRunner(new Map([[DebianInstallTests.PROBE, DebianInstallTests.FAILURE]]));

    const setuidError = await Assert.throwsAsync(async () => await (await DebianInstallTests.installAsync(setuid)).verifyAsync(), BuildException);
    const missingError = await Assert.throwsAsync(async () => await (await DebianInstallTests.installAsync(missing)).verifyAsync(), BuildException);
    const plainError = await Assert.throwsAsync(async () => await (await DebianInstallTests.installAsync(plain)).verifyAsync(), BuildException);

    Assert.areEqual(Resources.formatDebianSandboxHelperWrong(DebianInstallTests.HELPER, "0:4755", "0:755", true), setuidError.message);
    Assert.areEqual(Resources.formatDebianSandboxHelperWrong(DebianInstallTests.HELPER, "refused", "0:755", true), missingError.message);
    Assert.areEqual(Resources.formatDebianSandboxHelperWrong(DebianInstallTests.HELPER, "0:755", "0:4755", false), plainError.message);
  }

  @TestMethod
  public async expectsNoProfileWhereAppArmorIsOffOrRefusesItAsync(): Promise<void> {
    const off = DebianInstallTests.createRunner(new Map([[DebianInstallTests.ENABLED, DebianInstallTests.FAILURE]]));
    const refused = DebianInstallTests.createRunner(new Map([[DebianInstallTests.PARSE, DebianInstallTests.FAILURE]]));

    const offVerified = await (await DebianInstallTests.installAsync(off)).verifyAsync();
    const refusedVerified = await (await DebianInstallTests.installAsync(refused)).verifyAsync();

    Assert.isTrue(offVerified.endsWith(Resources.formatDebianProfileSkipped(DebianInstallTests.PROFILE, false)), offVerified);
    Assert.isTrue(refusedVerified.endsWith(Resources.formatDebianProfileSkipped(DebianInstallTests.PROFILE, true)), refusedVerified);
    Assert.isFalse(off.captured.includes(DebianInstallTests.PARSE));
    Assert.isTrue(off.captured.includes(DebianInstallTests.PROFILE_MISSING));
    Assert.isFalse(refused.captured.includes(DebianInstallTests.COMPARE));
  }

  @TestMethod
  public async refusesAProfileTheScriptShouldHaveLeftOutAsync(): Promise<void> {
    const off = DebianInstallTests.createRunner(new Map([
      [DebianInstallTests.ENABLED, DebianInstallTests.FAILURE],
      [DebianInstallTests.PROFILE_MISSING, DebianInstallTests.FAILURE]
    ]));
    const refused = DebianInstallTests.createRunner(new Map([
      [DebianInstallTests.PARSE, DebianInstallTests.FAILURE],
      [DebianInstallTests.PROFILE_MISSING, DebianInstallTests.FAILURE]
    ]));

    const offError = await Assert.throwsAsync(async () => await (await DebianInstallTests.installAsync(off)).verifyAsync(), BuildException);
    const refusedError = await Assert.throwsAsync(async () => await (await DebianInstallTests.installAsync(refused)).verifyAsync(), BuildException);

    Assert.areEqual(Resources.formatDebianProfileUnexpected(DebianInstallTests.PROFILE, false), offError.message);
    Assert.areEqual(Resources.formatDebianProfileUnexpected(DebianInstallTests.PROFILE, true), refusedError.message);
  }

  @TestMethod
  public async refusesAProfileThatIsNotCopiedOrNotLoadedAsync(): Promise<void> {
    const differs = DebianInstallTests.createRunner(new Map([[DebianInstallTests.COMPARE, DebianInstallTests.FAILURE]]));
    const unloaded = DebianInstallTests.createRunner(new Map([[DebianInstallTests.LOADED, DebianInstallTests.FAILURE]]));

    const differsError = await Assert.throwsAsync(async () => await (await DebianInstallTests.installAsync(differs)).verifyAsync(), BuildException);
    const unloadedError = await Assert.throwsAsync(async () => await (await DebianInstallTests.installAsync(unloaded)).verifyAsync(), BuildException);

    Assert.areEqual(Resources.formatDebianProfileNotCopied(DebianInstallTests.PROFILE, DebianInstallTests.SOURCE), differsError.message);
    Assert.areEqual(Resources.formatDebianProfileNotLoaded(DebianInstallTests.SLUG, Resources.apparmorLoadedProfiles), unloadedError.message);
    Assert.isFalse(differs.captured.includes(DebianInstallTests.LOADED));
  }

  @TestMethod
  public async removesThePackageAndFindsNothingLeftAsync(): Promise<void> {
    const runner = DebianInstallTests.createRunner(new Map());
    const install = await DebianInstallTests.installAsync(runner);

    const removed = await install.removeAsync();

    Assert.areEqual(Resources.formatDebianRemoved("sample-app", "/opt/Sample App", DebianInstallTests.PROFILE), removed);
    Assert.areEqual([DebianInstallTests.REMOVE, DebianInstallTests.FOLDER_MISSING, DebianInstallTests.PROFILE_MISSING].join("\n"), runner.captured.slice(3).join("\n"));
  }

  @TestMethod
  public async reportsARemovalThatFailsOrLeavesFilesAsync(): Promise<void> {
    const failed = DebianInstallTests.createRunner(new Map([[DebianInstallTests.REMOVE, DebianInstallTests.FAILURE]]));
    const folderLeft = DebianInstallTests.createRunner(new Map([[DebianInstallTests.FOLDER_MISSING, DebianInstallTests.FAILURE]]));
    const bothLeft = DebianInstallTests.createRunner(new Map([
      [DebianInstallTests.FOLDER_MISSING, DebianInstallTests.FAILURE],
      [DebianInstallTests.PROFILE_MISSING, DebianInstallTests.FAILURE]
    ]));

    const failure = await Assert.throwsAsync(async () => await (await DebianInstallTests.installAsync(failed)).removeAsync(), BuildException);
    const folderError = await Assert.throwsAsync(async () => await (await DebianInstallTests.installAsync(folderLeft)).removeAsync(), BuildException);
    const bothError = await Assert.throwsAsync(async () => await (await DebianInstallTests.installAsync(bothLeft)).removeAsync(), BuildException);

    Assert.areEqual(Resources.formatProcessFailed("sudo", [Resources.sudoNonInteractiveOption, Resources.aptGetCommand, ...Resources.aptGetRemoveArguments, "sample-app"], 1, "refused"),
      failure.message);
    Assert.areEqual(Resources.formatDebianRemovalLeft("sample-app", ["/opt/Sample App"]), folderError.message);
    Assert.areEqual(Resources.formatDebianRemovalLeft("sample-app", ["/opt/Sample App", DebianInstallTests.PROFILE]), bothError.message);
  }

  private static createRunner(answers: ReadonlyMap<string, ProcessResult>): ScriptedRunnerFixture {
    return new ScriptedRunnerFixture((command, commandArguments) => {
      const line = ScriptedRunnerFixture.format(command, commandArguments);
      const answer = answers.get(line);
      if (!Object.isUndefined(answer))
        return answer;
      if (line === DebianInstallTests.FIELD)
        return new ProcessResult(0, "sample-app\n", String.empty);
      if (line === DebianInstallTests.LINK)
        return new ProcessResult(0, `${DebianInstallTests.PROGRAM}\n`, String.empty);
      if (line === DebianInstallTests.STAT)
        return new ProcessResult(0, "0:755\n", String.empty);
      return ScriptedRunnerFixture.SUCCESS;
    });
  }

  private static installAsync(runner: ScriptedRunnerFixture): Promise<DebianInstall> {
    return DebianInstall.installAsync(runner, DebianInstallTests.FILE, DebianInstallTests.SLUG, DebianInstallTests.FOLDER);
  }
}
