/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FSWatcher, watch, writeFileSync } from "node:fs";
import { mkdir, readFile, rename, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { LineProcessStarter } from "../../../src/services/environment/line-process-starter.js";
import { LoginShellEnvironment } from "../../../src/services/environment/login-shell-environment.js";
import { ProfileWatch } from "../../../src/services/environment/profile-watch.js";
import { LineProcessStarterFixture } from "../../fixtures/line-process-starter.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { ProfileChangeFixture } from "../../fixtures/profile-change.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class LoginShellEnvironmentTests {
  private static readonly INHERITED: Readonly<Record<string, string>> = { HOME: "/home/person", PATH: "/usr/bin:/bin" };
  private static readonly SHELL: string = "/bin/zsh";
  private static readonly NODE: string = "/opt/Noldova/noldova";
  private static readonly UNREAD: string = "Programs start with the last environment read, or the app's own, since the person's current environment could not be read: ";

  @TestMethod
  public async startsTheLoginShellInItsOwnGroupToRunTheAppAsNodeAndPrintItsEnvironmentBetweenMarks(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const source = LoginShellEnvironmentTests.create(starter, new ProfileChangeFixture(), new TextOutputFixture(), "/Apps/Dev's/noldova");

    const reading = source.readAsync();
    const child = await starter.startedAsync(1);
    const mark = child.mark;
    child.answer({});
    await reading;

    Assert.areEqual(LoginShellEnvironmentTests.SHELL, child.file);
    Assert.isTrue(child.isGroup);
    Assert.areEqual(36, mark.length);
    Assert.areEqual(JSON.stringify(["-i", "-l", "-c",
      `'/Apps/Dev'\\''s/noldova' -e 'process.stdout.write("${mark}" + JSON.stringify(process.env) + "${mark}\\n")'`]), JSON.stringify(child.launchArguments));
    Assert.areEqual(JSON.stringify({ ...LoginShellEnvironmentTests.INHERITED, ELECTRON_RUN_AS_NODE: "1" }), JSON.stringify(child.environment));
  }

  @TestMethod
  public async ignoresWhatTheProfilesPrintAndGivesTheEnvironmentBetweenTheMarksThenEndsTheShell(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const diagnostics = new TextOutputFixture();
    const source = LoginShellEnvironmentTests.create(starter, new ProfileChangeFixture(), diagnostics);

    const reading = source.readAsync();
    const child = await starter.startedAsync(1);
    child.line("Last login: Fri Oct 30 on ttys001");
    child.line(`${child.mark}{"PATH":"/opt/bin"`);
    const isWaiting = await WaitFixture.isPendingAsync(reading);
    child.line(`motd ${child.mark}{"PATH":"/opt/bin:/usr/bin","EDITOR":"vim"}${child.mark} prompt`);
    const environment = await reading;

    Assert.isTrue(isWaiting);
    Assert.areEqual(JSON.stringify({ PATH: "/opt/bin:/usr/bin", EDITOR: "vim" }), JSON.stringify(environment));
    Assert.areEqual(1, child.kills);
    Assert.areEqual(String.empty, diagnostics.text);
  }

  @TestMethod
  public async handsEachReadsZshFolderToTheWatchAndReadsOnceMoreWhenItWatchesAnotherFolder(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const profiles = new ProfileChangeFixture();
    const source = LoginShellEnvironmentTests.create(starter, profiles);

    const first = source.readAsync();
    profiles.isOpening = true;
    (await starter.startedAsync(1)).answer({ ZDOTDIR: "/home/person/.config/zsh" });
    await first;
    profiles.isOpening = false;
    (await starter.startedAsync(2)).answer({ ZDOTDIR: "/home/person/.config/zsh", EDITOR: "vim" });
    const environment = await source.readAsync();

    Assert.areEqual("vim", environment["EDITOR"]);
    Assert.areEqual(2, starter.started.length);
    Assert.areEqual(JSON.stringify([null]), JSON.stringify(profiles.zshFolders));
    Assert.areEqual(JSON.stringify(["/home/person/.config/zsh", "/home/person/.config/zsh"]), JSON.stringify(profiles.followed));
    Assert.areEqual(0, profiles.disposals);
  }

  @TestMethod
  public async readsAgainWhenTheProfilesChangedSinceTheKeptReadBeganThoughTheWatchSaidNothing(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const profiles = new ProfileChangeFixture();
    const source = LoginShellEnvironmentTests.create(starter, profiles);

    const first = source.readAsync();
    const child = await starter.startedAsync(1);
    profiles.stamp = "changed while the shell read";
    child.answer({ EDITOR: "vi" });
    const kept = await first;
    const second = source.readAsync();
    (await starter.startedAsync(2)).answer({ EDITOR: "vim" });
    const reread = await second;
    const third = await source.readAsync();

    Assert.areEqual(JSON.stringify(["vi", "vim", "vim", 2]), JSON.stringify([kept["EDITOR"], reread["EDITOR"], third["EDITOR"], starter.started.length]));
  }

  @TestMethod
  public async failsAReadWhoseProfilesCannotBeStampedAndReadsAgainAtTheNextAsk(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const profiles = new ProfileChangeFixture();
    const source = LoginShellEnvironmentTests.create(starter, profiles);
    profiles.failure = new Error("EIO: i/o error, stat");

    const error = await Assert.throwsAsync(() => source.readAsync(), Error);
    profiles.failure = null;
    const second = source.readAsync();
    (await starter.startedAsync(1)).answer({ EDITOR: "nano" });
    const environment = await second;

    Assert.areEqual("EIO: i/o error, stat", error.message);
    Assert.areEqual("nano", environment["EDITOR"]);
    Assert.areEqual(1, starter.started.length);
  }

  @TestMethod
  public async givesTheLastGoodEnvironmentWhenEndedWhileItChecksTheProfiles(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const profiles = new ProfileChangeFixture();
    const source = LoginShellEnvironmentTests.create(starter, profiles);

    const first = source.readAsync();
    (await starter.startedAsync(1)).answer({ EDITOR: "vim" });
    const good = await first;
    profiles.stamp = "changed after the read";
    const checking = source.readAsync();
    source.end();
    const environment = await checking;

    Assert.areEqual(good, environment);
    Assert.areEqual(1, starter.started.length);
  }

  @TestMethod
  public async givesTheInheritedEnvironmentWhenEndedWhileItChecksTheProfilesAfterOnlyFailedReads(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const profiles = new ProfileChangeFixture();
    const source = LoginShellEnvironmentTests.create(starter, profiles);

    const first = source.readAsync();
    (await starter.startedAsync(1)).exit("zsh exited with 1.");
    await first;
    profiles.stamp = "changed after the read";
    const checking = source.readAsync();
    source.end();
    const environment = await checking;

    Assert.areEqual(LoginShellEnvironmentTests.INHERITED, environment);
    Assert.areEqual(1, starter.started.length);
  }

  @TestMethod
  public async sharesTheReadAProfileChangeStartsWhileItChecksTheProfiles(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const profiles = new ProfileChangeFixture();
    const source = LoginShellEnvironmentTests.create(starter, profiles);

    const first = source.readAsync();
    (await starter.startedAsync(1)).answer({ EDITOR: "vim" });
    await first;
    const checking = source.readAsync();
    profiles.change();
    (await starter.startedAsync(2)).answer({ EDITOR: "nano" });
    const environment = await checking;

    Assert.areEqual("nano", environment["EDITOR"]);
    Assert.areEqual(2, starter.started.length);
  }

  @TestMethod
  public async keepsTheHomeWatchAndReadsAgainWhenAReadNamesAZshFolderWhoseProfileChangedJustBeforeItEnds(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const zsh = path.join(folder.path, "zsh");
    await mkdir(home);
    await mkdir(zsh);
    const starter = new LineProcessStarterFixture();
    const closed: string[] = [];
    const source = new LoginShellEnvironment({ HOME: home }, starter, new TextOutputFixture(), LoginShellEnvironmentTests.SHELL, LoginShellEnvironmentTests.NODE,
      (t, u) => ProfileWatch.start(home, t, [".zshrc"], u, new TextOutputFixture(), (v, w) => {
        const watcher = watch(v, { persistent: false }, w);
        const close = watcher.close.bind(watcher);
        watcher.close = (): void => {
          closed.push(v);
          close();
        };
        return watcher;
      }));

    const reading = source.readAsync();
    const child = await starter.startedAsync(1);
    writeFileSync(path.join(zsh, ".zshrc"), "export EDITOR=vim\n");
    child.answer({ ZDOTDIR: zsh });
    await reading;
    await starter.startedAsync(2);
    const reads = starter.started.length;
    const closedBeforeEnd = [...closed];
    source.end();

    Assert.areEqual(2, reads);
    Assert.areEqual(String.empty, closedBeforeEnd.join(","));
  }

  @TestMethod
  public async readsAgainWhenAReadsEndClosesAFolderJustAfterAHomeProfileChangeThatTheWatchLost(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const zsh = path.join(folder.path, "zsh");
    await mkdir(home);
    await mkdir(zsh);
    const starter = new LineProcessStarterFixture();
    const closed: string[] = [];
    const source = new LoginShellEnvironment({ HOME: home }, starter, new TextOutputFixture(), LoginShellEnvironmentTests.SHELL, LoginShellEnvironmentTests.NODE,
      (t, u) => ProfileWatch.start(home, t, [".zshrc"], u, new TextOutputFixture(), v => {
        const watcher = watch(v, { persistent: false }, () => undefined);
        const close = watcher.close.bind(watcher);
        watcher.close = (): void => {
          closed.push(v);
          close();
        };
        return watcher;
      }));

    const first = source.readAsync();
    (await starter.startedAsync(1)).answer({ ZDOTDIR: zsh });
    await first;
    const reread = await starter.startedAsync(2);
    const second = source.readAsync();
    writeFileSync(path.join(home, ".zshrc"), "export EDITOR=vim\n");
    reread.answer({});
    await second;
    await starter.startedAsync(3);
    const closedBeforeEnd = [...closed];
    source.end();

    Assert.areEqual(zsh, closedBeforeEnd.join(","));
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async readsAgainWhenTheTargetOfAProfileLinkMadeAfterTheWatchStartedChanges(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const dotfiles = path.join(folder.path, "dotfiles");
    await mkdir(home);
    await mkdir(dotfiles);
    const target = path.join(dotfiles, "profile");
    await writeFile(target, "export EDITOR=vim\n");
    const starter = new LineProcessStarterFixture();
    const source = new LoginShellEnvironment({ HOME: home }, starter, new TextOutputFixture(), LoginShellEnvironmentTests.SHELL, LoginShellEnvironmentTests.NODE,
      (t, u) => ProfileWatch.start(home, t, [".profile"], u, new TextOutputFixture()));

    const first = source.readAsync();
    (await starter.startedAsync(1)).answer({});
    await first;
    let links = 0;
    const isLinked = await WaitFixture.untilAsync(async () => {
      if (starter.started.length > 1)
        return true;
      const link = path.join(home, `link-${++links}`);
      await symlink(target, link);
      await rename(link, path.join(home, ".profile"));
      return false;
    }, 5_000, 100);
    const settled = await LoginShellEnvironmentTests.answerUntilQuietAsync(starter, 1);
    let writes = 0;
    const isSeen = await WaitFixture.untilAsync(async () => {
      if (starter.started.length > settled)
        return true;
      await writeFile(target, `export EDITOR=vim${++writes}\n`);
      return false;
    }, 5_000, 100);
    source.end();

    Assert.isTrue(isLinked);
    Assert.isTrue(isSeen);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async readsAgainWhenAProfileChangesJustBeforeAReadEnds(): Promise<void> {
    const isReread: boolean[] = [];

    for (const waitsForTheWatch of [false, true]) {
      await using home = await TemporaryFolderFixture.createAsync();
      const starter = new LineProcessStarterFixture();
      const source = new LoginShellEnvironment({ HOME: home.path }, starter, new TextOutputFixture(), LoginShellEnvironmentTests.SHELL, LoginShellEnvironmentTests.NODE,
        (t, u) => ProfileWatch.start(home.path, t, [".profile"], u, new TextOutputFixture()));
      const reading = source.readAsync();
      let isChangeSeen = false;
      const [probe, isWatched] = await LoginShellEnvironmentTests.watchUntilSeenAsync(home.path, t => {
        isChangeSeen ||= t === ".profile";
      });
      const child = await starter.startedAsync(1);
      writeFileSync(path.join(home.path, ".profile"), "export EDITOR=vim\n");
      if (waitsForTheWatch)
        Assert.isTrue(await WaitFixture.untilAsync(() => isChangeSeen, 5_000), "The watch did not see the profile change.");
      child.answer({});
      await reading;
      isReread.push(isWatched && await WaitFixture.untilAsync(() => starter.started.length > 1, 5_000));
      source.end();
      probe.close();
    }

    Assert.areEqual("true,true", isReread.join(","));
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async endsWhatAProfileStartedWhenTheShellDoesNotAnswerWithinTheLimit(): Promise<void> {
    await using home = await TemporaryFolderFixture.createAsync();
    await writeFile(path.join(home.path, ".profile"), "sleep 300 &\necho $! > \"$HOME/sleeper\"\nwait\n");
    const diagnostics = new TextOutputFixture();
    const source = new LoginShellEnvironment({ HOME: home.path, PATH: process.env["PATH"] ?? String.empty }, new LineProcessStarter(diagnostics), diagnostics, "/bin/sh",
      process.execPath, new ProfileChangeFixture().watch, 1_500);

    await source.readAsync();
    const sleeper = Number(await readFile(path.join(home.path, "sleeper"), "utf8"));
    const isEnded = await ProgramFixture.waitForEndAsync(sleeper, ProgramFixture.END_MILLISECONDS);
    ProgramFixture.endIfRunning(sleeper);
    source.end();

    Assert.isTrue(isEnded);
    Assert.areEqual(`${LoginShellEnvironmentTests.UNREAD}The login shell /bin/sh did not give its environment within 1.5 seconds.\n`, diagnostics.text);
  }

  @TestMethod
  public async keepsTheEnvironmentAndSharesAReadUnderWayWhileTheProfilesStayWatched(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const profiles = new ProfileChangeFixture();
    const source = LoginShellEnvironmentTests.create(starter, profiles);

    const first = source.readAsync();
    const shared = source.readAsync();
    (await starter.startedAsync(1)).answer({ EDITOR: "vim" });
    const environment = await first;
    const kept = await source.readAsync();

    Assert.areEqual(first, shared);
    Assert.areEqual("vim", environment["EDITOR"]);
    Assert.areEqual(environment, kept);
    Assert.areEqual(1, starter.started.length);
    Assert.areEqual(1, profiles.watches);
    Assert.areEqual(0, profiles.disposals);
  }

  @TestMethod
  public async readsAgainAtOnceWhenAProfileChangesWhileIdle(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const profiles = new ProfileChangeFixture();
    const source = LoginShellEnvironmentTests.create(starter, profiles);

    const first = source.readAsync();
    (await starter.startedAsync(1)).answer({ EDITOR: "vim" });
    await first;
    profiles.change();
    const reread = await starter.startedAsync(2);
    const second = source.readAsync();
    reread.answer({ EDITOR: "nano" });
    const environment = await second;

    Assert.areEqual("nano", environment["EDITOR"]);
    Assert.areEqual(2, starter.started.length);
  }

  @TestMethod
  public async startsOneMoreReadAfterTheOneUnderWayWhenAProfileChangesDuringIt(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const profiles = new ProfileChangeFixture();
    const source = LoginShellEnvironmentTests.create(starter, profiles);

    const first = source.readAsync();
    profiles.change();
    const child = await starter.startedAsync(1);
    profiles.change();
    const shared = source.readAsync();
    const startedDuringRead = starter.started.length;
    child.answer({ EDITOR: "vim" });
    const firstEnvironment = await first;
    const reread = await starter.startedAsync(2);
    const startedAfterRead = starter.started.length;
    const second = source.readAsync();
    reread.answer({ EDITOR: "nano" });
    const secondEnvironment = await second;
    const kept = await source.readAsync();

    Assert.areEqual(first, shared);
    Assert.areEqual(1, startedDuringRead);
    Assert.areEqual("vim", firstEnvironment["EDITOR"]);
    Assert.areEqual(2, startedAfterRead);
    Assert.areEqual("nano", secondEnvironment["EDITOR"]);
    Assert.areEqual(secondEnvironment, kept);
    Assert.areEqual(2, starter.started.length);
  }

  @TestMethod
  public async endsAShellThatDoesNotAnswerWithinTheLimitAndGivesTheInheritedEnvironment(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const diagnostics = new TextOutputFixture();
    const source = LoginShellEnvironmentTests.create(starter, new ProfileChangeFixture(), diagnostics, LoginShellEnvironmentTests.NODE, 20);

    const environment = await source.readAsync();

    Assert.areEqual(LoginShellEnvironmentTests.INHERITED, environment);
    Assert.areEqual(1, starter.last.kills);
    Assert.areEqual(`${LoginShellEnvironmentTests.UNREAD}The login shell /bin/zsh did not give its environment within 0.02 seconds.\n`, diagnostics.text);
  }

  @TestMethod
  public async keepsTheLastGoodEnvironmentWhenALaterReadFails(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const profiles = new ProfileChangeFixture();
    const diagnostics = new TextOutputFixture();
    const source = LoginShellEnvironmentTests.create(starter, profiles, diagnostics);

    const first = source.readAsync();
    (await starter.startedAsync(1)).answer({ EDITOR: "vim" });
    const good = await first;
    profiles.change();
    const failed = source.readAsync();
    (await starter.startedAsync(2)).exit("zsh exited with 1.");
    const environment = await failed;
    const kept = await source.readAsync();

    Assert.areEqual(good, environment);
    Assert.areEqual(good, kept);
    Assert.areEqual(2, starter.started.length);
    Assert.areEqual(`${LoginShellEnvironmentTests.UNREAD}The login shell /bin/zsh ended before it gave its environment: zsh exited with 1.\n`, diagnostics.text);
  }

  @TestMethod
  public async givesTheInheritedEnvironmentAndSaysWhyWhenTheTextBetweenTheMarksIsNotAnEnvironment(): Promise<void> {
    for (const text of ["[\"PATH\"]", "{\"SHLVL\":1}", "null", "\"PATH\"", "{\"PATH\":"]) {
      const starter = new LineProcessStarterFixture();
      const diagnostics = new TextOutputFixture();
      const source = LoginShellEnvironmentTests.create(starter, new ProfileChangeFixture(), diagnostics);

      const reading = source.readAsync();
      const child = await starter.startedAsync(1);
      child.line(`${child.mark}${text}${child.mark}`);
      child.exit("zsh exited with 0.");
      const environment = await reading;

      Assert.areEqual(LoginShellEnvironmentTests.INHERITED, environment);
      Assert.areEqual(`${LoginShellEnvironmentTests.UNREAD}The login shell /bin/zsh did not write its environment as text.\n`, diagnostics.text);
    }
  }

  @TestMethod
  public async endsAReadUnderWayWithoutAnotherAndGivesTheLastGoodEnvironmentOnceEnded(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const profiles = new ProfileChangeFixture();
    const diagnostics = new TextOutputFixture();
    const source = LoginShellEnvironmentTests.create(starter, profiles, diagnostics);

    const first = source.readAsync();
    (await starter.startedAsync(1)).answer({ EDITOR: "vim" });
    const good = await first;
    profiles.change();
    const reading = source.readAsync();
    const child = await starter.startedAsync(2);
    profiles.change();
    source.end();
    const environment = await reading;
    const ended = await source.readAsync();
    source.end();

    Assert.areEqual(good, environment);
    Assert.areEqual(good, ended);
    Assert.areEqual(2, starter.started.length);
    Assert.areEqual(1, child.kills);
    Assert.areEqual(1, profiles.watches);
    Assert.areEqual(1, profiles.disposals);
    Assert.areEqual(String.empty, diagnostics.text);
  }

  @TestMethod
  public async startsNoShellWhenEndedWhileAReadChecksTheProfilesAndGivesTheLastGoodEnvironment(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const profiles = new ProfileChangeFixture();
    const diagnostics = new TextOutputFixture();
    const source = LoginShellEnvironmentTests.create(starter, profiles, diagnostics);

    const first = source.readAsync();
    (await starter.startedAsync(1)).answer({ EDITOR: "vim" });
    const good = await first;
    profiles.change();
    const reading = source.readAsync();
    source.end();
    const environment = await reading;

    Assert.areEqual(good, environment);
    Assert.areEqual(1, starter.started.length);
    Assert.areEqual(String.empty, diagnostics.text);
  }

  @TestMethod
  public async startsNoShellWhenEndedWhileAReadChecksTheProfilesAfterOnlyFailedReadsAndGivesTheInheritedEnvironment(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const profiles = new ProfileChangeFixture();
    const source = LoginShellEnvironmentTests.create(starter, profiles);

    const first = source.readAsync();
    (await starter.startedAsync(1)).exit("zsh exited with 1.");
    await first;
    profiles.change();
    const reading = source.readAsync();
    source.end();
    const environment = await reading;

    Assert.areEqual(LoginShellEnvironmentTests.INHERITED, environment);
    Assert.areEqual(1, starter.started.length);
  }

  @TestMethod
  public async givesTheInheritedEnvironmentWithoutStartingTheShellOnceEndedBeforeAnyRead(): Promise<void> {
    const starter = new LineProcessStarterFixture();
    const profiles = new ProfileChangeFixture();
    const source = LoginShellEnvironmentTests.create(starter, profiles);

    source.end();
    const environment = await source.readAsync();

    Assert.areEqual(LoginShellEnvironmentTests.INHERITED, environment);
    Assert.areEqual(0, starter.started.length);
    Assert.areEqual(0, profiles.watches);
  }

  @TestMethod
  public findsThePersonsShellThenTheShellVariableThenTheSystemShell(): void {
    const failing = (): string | null => {
      throw Object.assign(new Error("A system error occurred: uv_os_get_passwd returned ENOENT (no such file or directory)"), { code: "ERR_SYSTEM_ERROR" });
    };
    const broken = (): string | null => {
      throw new Error("The reader broke.");
    };

    Assert.areEqual("/bin/zsh", LoginShellEnvironment.findShell(() => "/bin/zsh", { SHELL: "/bin/bash" }));
    Assert.areEqual("/bin/bash", LoginShellEnvironment.findShell(() => null, { SHELL: "/bin/bash" }));
    Assert.areEqual("/bin/bash", LoginShellEnvironment.findShell(() => " ", { SHELL: "/bin/bash" }));
    Assert.areEqual("/bin/bash", LoginShellEnvironment.findShell(failing, { SHELL: "/bin/bash" }));
    Assert.areEqual("/bin/sh", LoginShellEnvironment.findShell(() => null, { SHELL: String.empty }));
    Assert.areEqual("/bin/sh", LoginShellEnvironment.findShell(() => null, {}));
    Assert.areEqual("The reader broke.", Assert.throws(() => LoginShellEnvironment.findShell(broken, { SHELL: "/bin/bash" }), Error).message);
  }

  private static async answerUntilQuietAsync(starter: LineProcessStarterFixture, answered: number): Promise<number> {
    let count = answered;
    let quietSince = performance.now();
    await WaitFixture.untilAsync(() => {
      if (count < starter.started.length) {
        starter.started.slice(count).forEach(t => t.answer({}));
        count = starter.started.length;
        quietSince = performance.now();
      }
      return performance.now() - quietSince > 500;
    }, 5_000);
    return count;
  }

  private static async watchUntilSeenAsync(folder: string, onChange: (name: string | null) => void): Promise<readonly [FSWatcher, boolean]> {
    let isSeen = false;
    const probe = watch(folder, { persistent: false }, (_event, name) => {
      isSeen ||= name === "probe";
      onChange(name);
    });
    let writes = 0;
    const isWatched = await WaitFixture.untilAsync(async () => {
      if (isSeen)
        return true;
      await writeFile(path.join(folder, "probe"), String(++writes));
      return false;
    }, 5_000, 100);
    return [probe, isWatched];
  }

  private static create(starter: LineProcessStarterFixture, profiles: ProfileChangeFixture, diagnostics: TextOutputFixture = new TextOutputFixture(),
    node: string = LoginShellEnvironmentTests.NODE, limitMilliseconds?: number): LoginShellEnvironment {
    return new LoginShellEnvironment(LoginShellEnvironmentTests.INHERITED, starter, diagnostics, LoginShellEnvironmentTests.SHELL, node, profiles.watch, limitMilliseconds);
  }
}
