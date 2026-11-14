/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppImageRestart } from "@noldova/desktop.electron";
import { ChildProcessStarter, type IProcessStarter } from "@noldova/desktop.runtime";

import { LinuxLaunchFixture } from "../fixtures/linux-launch.fixture.js";
import { PlatformFixture } from "../fixtures/platform.fixture.js";
import { RestartParentFixture } from "../fixtures/restart-parent.fixture.js";
import { WaitFixture } from "../fixtures/wait.fixture.js";

@TestClass
export class AppImageRestartTests {
  private static readonly MOUNT: string = "/tmp/.mount_AbCdEf";
  private static readonly ENVIRONMENT: NodeJS.ProcessEnv = {
    APPIMAGE: "/home/person/Applications/Noldova Desktop Sample.AppImage",
    APPDIR: AppImageRestartTests.MOUNT,
    ARGV0: "Noldova Desktop Sample.AppImage",
    OWD: "/home/person",
    HOME: "/home/person",
    PATH: `${AppImageRestartTests.MOUNT}:${AppImageRestartTests.MOUNT}/usr/sbin:/usr/bin:/bin`,
    XDG_DATA_DIRS: `${AppImageRestartTests.MOUNT}/usr/share/:/usr/local/share:/usr/share:/usr/share/gnome:/usr/local/share/:/usr/share/`,
    LD_LIBRARY_PATH: `${AppImageRestartTests.MOUNT}/usr/lib`,
    GSETTINGS_SCHEMA_DIR: "/opt/schemas",
    EMPTY: String.empty,
    UNSET: undefined
  };
  private static readonly GONE: number = 0x3fffffff;
  private static readonly LIMIT: number = 10_000;
  private static readonly START_TIME: number = 14;

  @TestMethod
  public findsNothingOutsideALinuxAppImage(): void {
    const starter = AppImageRestartTests.createStarter([], 1);

    Assert.isNull(AppImageRestart.find("win32", AppImageRestartTests.ENVIRONMENT, `${AppImageRestartTests.MOUNT}/noldova-desktop`, [], starter, 100, "/tmp/restart.log"));
    Assert.isNull(AppImageRestart.find("darwin", AppImageRestartTests.ENVIRONMENT, `${AppImageRestartTests.MOUNT}/noldova-desktop`, [], starter, 100, "/tmp/restart.log"));
    Assert.isNull(AppImageRestart.find("linux", {}, "/opt/noldova-desktop/noldova-desktop", [], starter, 100, "/tmp/restart.log"));
    Assert.isNull(AppImageRestart.find("linux", AppImageRestartTests.ENVIRONMENT, "/opt/noldova-desktop/noldova-desktop", [], starter, 100, "/tmp/restart.log"));
  }

  @TestMethod
  public async restartsTheProgramOfADebianInstallOnLinuxOnly(): Promise<void> {
    using _launch = new LinuxLaunchFixture();
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-debian-restart-"));
    try {
      const program = path.join(folder, "noldova-desktop");
      const calls: [string, readonly string[], NodeJS.ProcessEnv, string][] = [];
      const starter = AppImageRestartTests.createStarter(calls, AppImageRestartTests.GONE);
      await mkdir(path.join(folder, "resources"));
      await writeFile(path.join(folder, "resources", "package-type"), "AppImage\n");
      const other = AppImageRestart.find("linux", { HOME: "/home/person" }, program, [], starter, AppImageRestartTests.GONE, "/tmp/restart.log");
      await writeFile(path.join(folder, "resources", "package-type"), "deb\n");
      const restart = AppImageRestart.find("linux", { HOME: "/home/person" }, program, ["--data-dir", "/home/person/data"], starter, AppImageRestartTests.GONE, "/tmp/restart.log");

      await restart?.startAsync();

      Assert.isNull(other);
      Assert.isNull(AppImageRestart.find("win32", { HOME: "/home/person" }, program, [], starter, AppImageRestartTests.GONE, "/tmp/restart.log"));
      Assert.areEqual(1, calls.length);
      const [, launchArguments, environment] = calls[0] ?? [String.empty, [], {}, String.empty];
      Assert.areEqual(JSON.stringify(["noldova-desktop-restart", String(AppImageRestartTests.GONE), String.empty, "60000", program, "--data-dir", "/home/person/data"]),
        JSON.stringify(launchArguments.slice(12)));
      Assert.areEqual(JSON.stringify({ HOME: "/home/person" }), JSON.stringify(environment));
      restart?.cancel();
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async startsBashThroughTheLaunchCommandWithoutWhatTheAppImageAddedToTheEnvironment(): Promise<void> {
    using _launch = new LinuxLaunchFixture();
    const calls: [string, readonly string[], NodeJS.ProcessEnv, string][] = [];
    const starter = AppImageRestartTests.createStarter(calls, AppImageRestartTests.GONE);
    const restart = AppImageRestart.find("linux", AppImageRestartTests.ENVIRONMENT, `${AppImageRestartTests.MOUNT}/noldova-desktop`, ["--data-dir", "/home/person/data"], starter,
      AppImageRestartTests.GONE, "/tmp/restart.log");
    const other = AppImageRestart.find("linux", {
      ...AppImageRestartTests.ENVIRONMENT, XDG_DATA_DIRS: `${AppImageRestartTests.MOUNT}/usr/share/:/usr/share`, LD_LIBRARY_PATH: `${AppImageRestartTests.MOUNT}/usr/lib:`
    }, `${AppImageRestartTests.MOUNT}/noldova-desktop`, [], starter, 4120, "/tmp/restart.log");

    await restart?.startAsync();
    await other?.startAsync();

    Assert.areEqual(2, calls.length);
    const [executable, launchArguments, environment, errorFile] = calls[0] ?? [String.empty, [], {}, String.empty];
    Assert.areEqual("/bin/bash", executable);
    Assert.areEqual(JSON.stringify(["--noprofile", "--norc", "-p", "-c"]), JSON.stringify(launchArguments.slice(0, 4)));
    Assert.areEqual(JSON.stringify(["noldova-desktop-launch", "/bin/bash", "--noprofile", "--norc", "-p", "-c"]), JSON.stringify(launchArguments.slice(5, 11)));
    Assert.areEqual(JSON.stringify([
      "noldova-desktop-restart", String(AppImageRestartTests.GONE), String.empty, "60000", "/home/person/Applications/Noldova Desktop Sample.AppImage", "--data-dir", "/home/person/data"
    ]), JSON.stringify(launchArguments.slice(12)));
    Assert.areEqual(JSON.stringify({
      HOME: "/home/person", PATH: "/usr/bin:/bin", XDG_DATA_DIRS: "/usr/local/share:/usr/share", GSETTINGS_SCHEMA_DIR: "/opt/schemas", EMPTY: String.empty
    }), JSON.stringify(environment));
    Assert.areEqual("/tmp/restart.log", errorFile);
    Assert.areEqual(`${AppImageRestartTests.MOUNT}/usr/share/:/usr/share`, calls[1]?.[2]["XDG_DATA_DIRS"]);
    Assert.isFalse(Object.hasOwn(calls[1]?.[2] ?? {}, "LD_LIBRARY_PATH"));
    restart?.cancel();
    restart?.cancel();
  }

  @TestMethod
  public async givesBashTheStartTimeFromTheProcessStatusAfterTheLastParenthesisOfTheName(): Promise<void> {
    using _launch = new LinuxLaunchFixture();
    const folder = await mkdtemp(path.join(tmpdir(), "nol-restart-status-"));
    try {
      const calls: [string, readonly string[], NodeJS.ProcessEnv, string][] = [];
      const fields = ["S", ...Array.from({ length: 18 }, (_, i) => String(i + 4)), "98765", "2048"];
      await mkdir(path.join(folder, "4120"));
      await mkdir(path.join(folder, "4121"));
      await writeFile(path.join(folder, "4120", "stat"), `4120 (noldova ) desktop) ${fields.join(" ")}\n`);
      await writeFile(path.join(folder, "4121", "stat"), "4121 (noldova) S 1\n");

      for (const processId of [4120, 4121, 4122])
        await AppImageRestart.find("linux", AppImageRestartTests.ENVIRONMENT, `${AppImageRestartTests.MOUNT}/noldova-desktop`, [], AppImageRestartTests.createStarter(calls, 1), processId,
          "/tmp/restart.log", 5000, folder)?.startAsync();

      Assert.areEqual(JSON.stringify([["4120", "98765", "5000"], ["4121", String.empty, "5000"], ["4122", String.empty, "5000"]]),
        JSON.stringify(calls.map(([, t]) => t.slice(AppImageRestartTests.START_TIME - 1, AppImageRestartTests.START_TIME + 2))));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async cancellingEndsTheStartedBashAndDoesNothingBeforeItStarts(): Promise<void> {
    using _launch = new LinuxLaunchFixture();
    const waiting = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], { stdio: "ignore" });
    await once(waiting, "spawn");
    const exited = once(waiting, "exit");
    const restart = AppImageRestart.find("linux", AppImageRestartTests.ENVIRONMENT, `${AppImageRestartTests.MOUNT}/noldova-desktop`, [],
      AppImageRestartTests.createStarter([], Number(waiting.pid)), 4120, "/tmp/restart.log");

    restart?.cancel();
    await restart?.startAsync();
    restart?.cancel();
    await exited;

    Assert.isNotNull(waiting.exitCode ?? waiting.signalCode);
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async startsTheAppImageFromTheRootFolderWithoutInheritedDescriptorsOnlyOnceItsParentHasExited(): Promise<void> {
    await AppImageRestartTests.runInFolderAsync(async (folder, image, marker) => {
      await using parent = await RestartParentFixture.createAsync();
      const restart = AppImageRestartTests.find(folder, image, ["--one", "two"], parent, parent.processId);

      await restart?.startAsync();
      const isWaiting = await WaitFixture.holdsWithinAsync(() => RestartParentFixture.isWaitingAsync(parent.started), AppImageRestartTests.LIMIT);
      const isEarly = existsSync(marker);
      await parent.exitAsync();

      Assert.isTrue(isWaiting, "Bash to wait for its parent to exit");
      Assert.isFalse(isEarly, "the AppImage started while Bash's parent still ran");
      await WaitFixture.untilAsync(() => existsSync(marker), "the AppImage to start after Bash's parent exited", AppImageRestartTests.LIMIT);
      Assert.areEqual("/|--one two|unset|unset\n0 1 2 3 ", await readFile(marker, "utf8"));
    });
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async waitsForTheProcessThatStartedTheRestartThoughTheDetachedStartGivesBashAnotherParent(): Promise<void> {
    await AppImageRestartTests.runInFolderAsync(async (folder, image, marker) => {
      const holder = await AppImageRestartTests.startHolderAsync();
      try {
        const started: number[] = [];
        const restart = AppImageRestartTests.find(folder, image, ["--one", "two"], AppImageRestartTests.createDetachedStarter(started), Number(holder.pid));

        await restart?.startAsync();
        const isWaiting = await WaitFixture.holdsWithinAsync(() => RestartParentFixture.isWaitingAsync(started[0] ?? 0), AppImageRestartTests.LIMIT);
        const isEarly = existsSync(marker);
        await AppImageRestartTests.endAsync(holder);

        Assert.isTrue(isWaiting, "Bash did not wait for the process that started the restart");
        Assert.isFalse(isEarly, "the AppImage started while the process that started the restart still ran");
        await WaitFixture.untilAsync(() => existsSync(marker), "the AppImage to start after the process that started the restart ended", AppImageRestartTests.LIMIT);
        Assert.areEqual("/|--one two|unset|unset\n0 1 2 3 ", await readFile(marker, "utf8"));
      }
      finally {
        await AppImageRestartTests.endAsync(holder);
      }
    });
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async timesTheWaitFromItsOwnStartThoughTheEnvironmentSetsSeconds(): Promise<void> {
    await AppImageRestartTests.runInFolderAsync(async (folder, image, marker) => {
      const holder = await AppImageRestartTests.startHolderAsync();
      try {
        const started: number[] = [];
        const restart = AppImageRestartTests.find(folder, image, [], AppImageRestartTests.createDetachedStarter(started), Number(holder.pid), undefined, { SECONDS: "100000" });

        await restart?.startAsync();
        const isWaiting = await WaitFixture.holdsWithinAsync(() => RestartParentFixture.isWaitingAsync(started[0] ?? 0), AppImageRestartTests.LIMIT);
        const isEarly = existsSync(marker);
        await AppImageRestartTests.endAsync(holder);

        Assert.isTrue(isWaiting, "Bash did not wait for the process that started the restart");
        Assert.isFalse(isEarly, "an inherited SECONDS ended the wait while the process that started the restart still ran");
        await WaitFixture.untilAsync(() => existsSync(marker), "the AppImage to start after the process that started the restart ended", AppImageRestartTests.LIMIT);
      }
      finally {
        await AppImageRestartTests.endAsync(holder);
      }
    });
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async startsTheAppImageAtOnceWhenTheProcessIdBelongsToAProcessThatStartedLater(): Promise<void> {
    await AppImageRestartTests.runInFolderAsync(async (folder, image, marker) => {
      const holder = await AppImageRestartTests.startHolderAsync();
      try {
        const restart = AppImageRestartTests.find(folder, image, [], AppImageRestartTests.createDetachedStarter([], "1"), Number(holder.pid));

        await restart?.startAsync();

        await WaitFixture.untilAsync(() => existsSync(marker), "the AppImage to start though a process only reuses the process id", AppImageRestartTests.LIMIT);
        Assert.isNull(holder.exitCode ?? holder.signalCode);
      }
      finally {
        await AppImageRestartTests.endAsync(holder);
      }
    });
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async startsTheAppImageAnywayAndSaysSoOnceTheWaitPassesItsLimit(): Promise<void> {
    await AppImageRestartTests.runInFolderAsync(async (folder, image, marker) => {
      const holder = await AppImageRestartTests.startHolderAsync();
      try {
        const restart = AppImageRestartTests.find(folder, image, [], AppImageRestartTests.createDetachedStarter([]), Number(holder.pid), 300);

        await restart?.startAsync();

        await WaitFixture.untilAsync(() => existsSync(marker), "the AppImage to start once the wait passed its limit", AppImageRestartTests.LIMIT);
        Assert.isNull(holder.exitCode ?? holder.signalCode);
        Assert.areEqual(`The process ${String(holder.pid)} had not ended after 300 ms, so ${image} starts anyway.\n`, await readFile(path.join(folder, "restart.log"), "utf8"));
      }
      finally {
        await AppImageRestartTests.endAsync(holder);
      }
    });
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async endsTheWaitingBashWhenCancelledWithoutStartingTheAppImage(): Promise<void> {
    await AppImageRestartTests.runInFolderAsync(async (folder, image, marker) => {
      await using parent = await RestartParentFixture.createAsync();
      const restart = AppImageRestartTests.find(folder, image, [], parent, parent.processId);

      await restart?.startAsync();
      await WaitFixture.untilAsync(() => RestartParentFixture.isWaitingAsync(parent.started), "Bash to wait for its parent to exit", AppImageRestartTests.LIMIT);
      restart?.cancel();

      await WaitFixture.untilAsync(() => RestartParentFixture.hasEndedAsync(parent.started), "Bash to end when cancelled", AppImageRestartTests.LIMIT);
      await parent.exitAsync();
      Assert.isFalse(existsSync(marker), "the AppImage started after a cancel");
    });
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async reportsAnAppImageThatCannotStart(): Promise<void> {
    await AppImageRestartTests.runInFolderAsync(async (folder, image) => {
      const errorFile = path.join(folder, "restart.log");
      await chmod(image, 0o644);
      await using parent = await RestartParentFixture.createAsync();
      const restart = AppImageRestartTests.find(folder, image, [], parent, AppImageRestartTests.GONE);

      await restart?.startAsync();

      await WaitFixture.untilAsync(async () => (await readFile(errorFile, "utf8")).includes(`${image} cannot be started after the update.\n`), "the restart to log that the AppImage cannot be started", AppImageRestartTests.LIMIT);
    });
  }

  private static async runInFolderAsync(action: (folder: string, image: string, marker: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "nol-restart-"));
    try {
      const image = path.join(folder, "Noldova Desktop Sample.AppImage");
      const marker = path.join(folder, "started");
      await writeFile(image, [
        "#!/bin/bash",
        `{ printf '%s|%s|%s|%s\\n' "$PWD" "$*" "\${APPIMAGE-unset}" "\${LD_LIBRARY_PATH-unset}"; ls /proc/self/fd | tr '\\n' ' '; } > ${JSON.stringify(`${marker}.part`)}`,
        `mv ${JSON.stringify(`${marker}.part`)} ${JSON.stringify(marker)}`
      ].join("\n"));
      await chmod(image, 0o755);
      await action(folder, image, marker);
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }

  private static find(folder: string, image: string, launchArguments: readonly string[], starter: IProcessStarter, processId: number, waitLimit?: number,
    inherited: NodeJS.ProcessEnv = {}): AppImageRestart | null {
    const mount = path.join(folder, "mount");
    const environment = { ...process.env, ...inherited, APPIMAGE: image, APPDIR: mount, LD_LIBRARY_PATH: `${mount}/usr/lib` };
    return AppImageRestart.find("linux", environment, path.join(mount, "noldova-desktop"), launchArguments, starter, processId, path.join(folder, "restart.log"), waitLimit);
  }

  private static async startHolderAsync(): Promise<ChildProcess> {
    const holder = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], { stdio: "ignore" });
    await once(holder, "spawn");
    return holder;
  }

  private static async endAsync(holder: ChildProcess): Promise<void> {
    if (Object.isNull(holder.exitCode) && Object.isNull(holder.signalCode)) {
      const exited = once(holder, "exit");
      holder.kill();
      await exited;
    }
  }

  private static createDetachedStarter(started: number[], startTime?: string): IProcessStarter {
    const starter = ChildProcessStarter.create("linux");
    return {
      async startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string): Promise<number> {
        const processId = await starter.startAsync(executable, launchArguments.map((t, i) => i === AppImageRestartTests.START_TIME ? startTime ?? t : t), environment, errorFile);
        started.push(processId);
        return processId;
      }
    };
  }

  private static createStarter(calls: [string, readonly string[], NodeJS.ProcessEnv, string][], processId: number): IProcessStarter {
    return {
      startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string): Promise<number> {
        calls.push([executable, launchArguments, environment, errorFile]);
        return Promise.resolve(processId);
      }
    };
  }
}
