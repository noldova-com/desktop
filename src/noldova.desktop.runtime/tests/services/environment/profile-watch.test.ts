/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type BigIntStats, type FSWatcher, existsSync, mkdirSync, realpathSync, renameSync, watch } from "node:fs";
import { mkdir, rename, symlink, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ProfileWatch } from "../../../src/services/environment/profile-watch.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class ProfileWatchTests {
  private static readonly PROFILES: readonly string[] = [".zshrc", ".profile"];
  private static readonly DEVICE: bigint = 0x7a_1c3en;
  private static readonly OTHER_DEVICE: bigint = 0x7a_1c3fn;
  private static readonly HOME_FILE_NUMBER: bigint = 0x51_0000_0007_dc63n;
  private static readonly FILE_NUMBER: bigint = 0x54_0000_0007_dc67n;
  private static readonly NEXT_FILE_NUMBER: bigint = 0x54_0000_0007_dc68n;
  private static readonly UNWATCHED: string = "The shell's profile files are not watched, so a change to them reaches the programs modules start only after the app restarts.\n";

  @TestMethod
  public async saysWhenAProfileInTheFolderChanges(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const diagnostics = new TextOutputFixture();
    let changes = 0;
    using profiles = ProfileWatch.start(folder.path, undefined, ProfileWatchTests.PROFILES, () => changes++, diagnostics);

    const isChanged = await ProfileWatchTests.rewriteUntilAsync(path.join(folder.path, ".profile"), () => changes > 0);

    Assert.isTrue(isChanged);
    Assert.isNotNull(profiles);
    Assert.areEqual(String.empty, diagnostics.text);
  }

  @TestMethod
  public async stampsEachProfileAsItStandsSoAChangeShowsWithoutItsEvent(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using profiles = ProfileWatch.start(folder.path, undefined, ProfileWatchTests.PROFILES, () => undefined, new TextOutputFixture());
    const profile = path.join(folder.path, ".profile");

    const missing = await profiles.readStampAsync();
    await writeFile(profile, "export EDITOR=vi\n");
    const written = await profiles.readStampAsync();
    const unchanged = await profiles.readStampAsync();
    await writeFile(profile, "export EDITOR=vim\n");
    const rewritten = await profiles.readStampAsync();

    Assert.areEqual(JSON.stringify([false, true, false]), JSON.stringify([missing === written, written === unchanged, written === rewritten]));
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async stampsTheTargetOfAProfileLinkSoAWriteThereOrANewTargetShows(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const dotfiles = path.join(folder.path, "dotfiles");
    const link = path.join(home, ".profile");
    await mkdir(home);
    await mkdir(dotfiles);
    await writeFile(path.join(dotfiles, "profile"), "export EDITOR=vi\n");
    await writeFile(path.join(dotfiles, "other"), "export EDITOR=vi\n");
    await symlink(path.join(dotfiles, "profile"), link);
    using profiles = ProfileWatch.start(home, undefined, ProfileWatchTests.PROFILES, () => undefined, new TextOutputFixture());

    const linked = await profiles.readStampAsync();
    await writeFile(path.join(dotfiles, "profile"), "export EDITOR=vim\n");
    const written = await profiles.readStampAsync();
    await unlink(link);
    await symlink(path.join(dotfiles, "other"), link);
    const repointed = await profiles.readStampAsync();

    Assert.areEqual(JSON.stringify([false, false]), JSON.stringify([linked === written, written === repointed]));
  }

  @TestMethod
  public async stampsTheProfilesOfAFollowedZshFolder(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const zsh = path.join(folder.path, "zsh");
    await mkdir(home);
    await mkdir(zsh);
    await writeFile(path.join(zsh, ".zshrc"), "export EDITOR=vi\n");
    using profiles = ProfileWatch.start(home, undefined, ProfileWatchTests.PROFILES, () => undefined, new TextOutputFixture());

    const unfollowed = await profiles.readStampAsync();
    await profiles.followAsync(zsh);
    const followed = await profiles.readStampAsync();
    await writeFile(path.join(zsh, ".zshrc"), "export EDITOR=vim\n");
    const written = await profiles.readStampAsync();

    Assert.areEqual(JSON.stringify([false, false]), JSON.stringify([unfollowed === followed, followed === written]));
  }

  @TestMethod
  public async passesOverChangesToOtherFiles(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    let listener: (event: string, name: string | null) => void = () => undefined;
    let changes = 0;
    using profiles = ProfileWatch.start(folder.path, undefined, ProfileWatchTests.PROFILES, () => changes++, new TextOutputFixture(), (t, u) => {
      listener = u;
      return watch(t, { persistent: false }, () => undefined);
    });

    await profiles.readStampAsync();
    listener("change", "notes.txt");
    listener("rename", null);
    listener("change", ".zshrc");
    await profiles.readStampAsync();

    Assert.areEqual(1, changes);
  }

  @TestMethod
  public async watchesTheZshFolderAndTheFolderOfEachProfileLinksTarget(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const zsh = path.join(folder.path, "zsh");
    const dotfiles = path.join(folder.path, "dotfiles");
    await mkdir(home);
    await mkdir(zsh);
    await mkdir(path.join(dotfiles, "zshrc"), { recursive: true });
    await symlink(path.join(dotfiles, "zshrc"), path.join(home, ".zshrc"), "junction");
    await writeFile(path.join(home, ".profile"), "export EDITOR=vim\n");
    const listeners = new Map<string, (event: string, name: string | null) => void>();
    let changes = 0;
    using profiles = ProfileWatch.start(home, zsh, ProfileWatchTests.PROFILES, () => changes++, new TextOutputFixture(), (t, u) => {
      listeners.set(t, u);
      return watch(folder.path, { persistent: false }, () => undefined);
    });

    await profiles.readStampAsync();
    listeners.get(realpathSync.native(dotfiles))?.("change", "notes.txt");
    listeners.get(realpathSync.native(dotfiles))?.("change", "zshrc");
    listeners.get(zsh)?.("change", ".zshrc");
    await profiles.readStampAsync();

    Assert.areEqual(JSON.stringify([home, realpathSync.native(dotfiles), zsh]), JSON.stringify([...listeners.keys()]));
    Assert.areEqual(2, changes);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async followsAProfileLinkMadeOrRemovedLaterWithoutWatchingItsOtherFoldersAgain(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const dotfiles = path.join(folder.path, "dotfiles");
    await mkdir(home);
    await mkdir(dotfiles);
    await writeFile(path.join(dotfiles, "profile"), "export EDITOR=vim\n");
    const listeners = new Map<string, (event: string, name: string | null) => void>();
    const started: string[] = [];
    const closed: string[] = [];
    let changes = 0;
    using profiles = ProfileWatch.start(home, undefined, ProfileWatchTests.PROFILES, () => changes++, new TextOutputFixture(), (t, u) => {
      started.push(t);
      listeners.set(t, u);
      const watcher = watch(folder.path, { persistent: false }, () => undefined);
      watcher.on("close", () => closed.push(t));
      return watcher;
    });

    await profiles.readStampAsync();
    await symlink(path.join(dotfiles, "profile"), path.join(home, ".profile"));
    listeners.get(home)?.("rename", ".profile");
    await profiles.readStampAsync();
    listeners.get(realpathSync.native(dotfiles))?.("change", "profile");
    await profiles.readStampAsync();
    const linked = [...started];
    await unlink(path.join(home, ".profile"));
    listeners.get(home)?.("rename", ".profile");
    const isClosed = await WaitFixture.untilAsync(() => closed.length > 0, 5_000);
    await profiles.readStampAsync();

    Assert.areEqual(JSON.stringify([home, realpathSync.native(dotfiles)]), JSON.stringify(linked));
    Assert.isTrue(isClosed);
    Assert.areEqual(JSON.stringify([realpathSync.native(dotfiles)]), JSON.stringify(closed));
    Assert.areEqual(3, changes);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async saysWhenTheTargetOfAProfileLinkChanges(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const dotfiles = path.join(folder.path, "dotfiles");
    await mkdir(home);
    await mkdir(dotfiles);
    await writeFile(path.join(dotfiles, "profile"), "export EDITOR=vim\n");
    await symlink(path.join(dotfiles, "profile"), path.join(home, ".profile"));
    let changes = 0;
    using profiles = ProfileWatch.start(home, undefined, ProfileWatchTests.PROFILES, () => changes++, new TextOutputFixture());

    const isChanged = await ProfileWatchTests.rewriteUntilAsync(path.join(dotfiles, "profile"), () => changes > 0);

    Assert.isNotNull(profiles);
    Assert.isTrue(isChanged);
  }

  @TestMethod
  public async saysOnceForEachFolderThatTheProfilesAreUnwatchedWhenItCannotBeWatched(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const diagnostics = new TextOutputFixture();
    const zsh = path.join(folder.path, "zsh");
    const tried: string[] = [];

    const profiles = ProfileWatch.start(folder.path, zsh, ProfileWatchTests.PROFILES, () => undefined, diagnostics, t => {
      tried.push(t);
      throw Object.assign(new Error("EACCES: the folder cannot be watched."), { code: "EACCES" });
    });
    const isOpened = await profiles.followAsync(zsh);
    profiles[Symbol.dispose]();

    Assert.isFalse(isOpened);
    Assert.areEqual(JSON.stringify([folder.path, zsh, folder.path, folder.path, zsh, folder.path]), JSON.stringify(tried));
    Assert.areEqual(ProfileWatchTests.UNWATCHED.repeat(2), diagnostics.text);
  }

  @TestMethod
  public async watchesTheNearestParentOfAGoneFolderAndOpensTheFolderWhenItReturns(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const config = path.join(folder.path, "config");
    const zsh = path.join(config, "zsh");
    await mkdir(home);
    const diagnostics = new TextOutputFixture();
    const listeners = new Map<string, (event: string, name: string | null) => void>();
    const opened: string[] = [];
    const closed: string[] = [];
    let changes = 0;
    using profiles = ProfileWatch.start(home, zsh, ProfileWatchTests.PROFILES, () => changes++, diagnostics, (t, u) => {
      const started = watch(t, { persistent: false }, () => undefined);
      listeners.set(t, u);
      return ProfileWatchTests.record(started, t, opened, closed);
    });

    await profiles.readStampAsync();
    listeners.get(folder.path)?.("rename", "other");
    await profiles.readStampAsync();
    const changesOnOther = changes;
    await mkdir(config);
    listeners.get(folder.path)?.("rename", "config");
    await profiles.readStampAsync();
    const changesOnConfig = changes;
    await mkdir(zsh);
    listeners.get(config)?.("rename", "zsh");
    await profiles.readStampAsync();

    Assert.areEqual(0, changesOnOther);
    Assert.areEqual(1, changesOnConfig);
    Assert.areEqual(2, changes);
    Assert.areEqual(JSON.stringify([home, folder.path, config, zsh]), JSON.stringify(opened));
    Assert.areEqual(JSON.stringify([folder.path, config]), JSON.stringify(closed));
    Assert.areEqual(String.empty, diagnostics.text);
  }

  @TestMethod
  public async stopsWaitingForAGoneFolderWhenItsParentsWatchFailsOrItIsNoLongerFollowed(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const zsh = path.join(folder.path, "zsh");
    await mkdir(home);
    const diagnostics = new TextOutputFixture();
    const watchers = new Map<string, FSWatcher>();
    const opened: string[] = [];
    const closed: string[] = [];
    using profiles = ProfileWatch.start(home, zsh, ProfileWatchTests.PROFILES, () => undefined, diagnostics, t => {
      const started = ProfileWatchTests.record(watch(t, { persistent: false }, () => undefined), t, opened, closed);
      watchers.set(t, started);
      return started;
    });

    await profiles.readStampAsync();
    watchers.get(folder.path)?.emit("error", new Error("The folder was removed."));
    await profiles.readStampAsync();
    const closedOnError = [...closed];
    const isWaitingAgain = await profiles.followAsync(zsh);
    const isStopped = await profiles.followAsync(undefined);

    Assert.areEqual(JSON.stringify([folder.path]), JSON.stringify(closedOnError));
    Assert.isTrue(isWaitingAgain);
    Assert.isTrue(isStopped);
    Assert.areEqual(JSON.stringify([home, folder.path, folder.path]), JSON.stringify(opened));
    Assert.areEqual(JSON.stringify([folder.path, folder.path]), JSON.stringify(closed));
    Assert.areEqual(ProfileWatchTests.UNWATCHED, diagnostics.text);
  }

  @TestMethod
  public async closesTheWaitForAGoneFolderWithTheWatch(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    await mkdir(home);
    const opened: string[] = [];
    const closed: string[] = [];

    const profiles = ProfileWatch.start(home, path.join(folder.path, "zsh"), ProfileWatchTests.PROFILES, () => undefined, new TextOutputFixture(),
      t => ProfileWatchTests.record(watch(t, { persistent: false }, () => undefined), t, opened, closed));
    await profiles.readStampAsync();
    profiles[Symbol.dispose]();

    Assert.areEqual(JSON.stringify([home, folder.path]), JSON.stringify(opened));
    Assert.areEqual(JSON.stringify([home, folder.path]), JSON.stringify(closed));
  }

  @TestMethod
  public async opensAGoneFolderMadeOnceItsParentsWatchOpenedEvenWhenNoEventNamesIt(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const zsh = path.join(folder.path, "zsh");
    await mkdir(home);
    const opened: string[] = [];
    const closed: string[] = [];
    let changes = 0;
    using profiles = ProfileWatch.start(home, undefined, ProfileWatchTests.PROFILES, () => changes++, new TextOutputFixture(), (t, u) => {
      const started = ProfileWatchTests.record(watch(t, { persistent: false }, t === folder.path ? (): void => undefined : u), t, opened, closed);
      if (t === folder.path)
        mkdirSync(zsh);
      return started;
    });

    const isOpened = await profiles.followAsync(zsh);

    Assert.isTrue(isOpened);
    Assert.areEqual(0, changes);
    Assert.areEqual(JSON.stringify([home, folder.path, zsh]), JSON.stringify(opened));
    Assert.areEqual(JSON.stringify([folder.path]), JSON.stringify(closed));
  }

  @TestMethod
  public async opensAWaitingFolderThatAppearedUnseenAtTheNextFollow(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const zsh = path.join(folder.path, "zsh");
    await mkdir(home);
    const opened: string[] = [];
    const closed: string[] = [];
    using profiles = ProfileWatch.start(home, zsh, ProfileWatchTests.PROFILES, () => undefined, new TextOutputFixture(),
      (t, u) => ProfileWatchTests.record(watch(t, { persistent: false }, t === folder.path ? (): void => undefined : u), t, opened, closed));

    await profiles.readStampAsync();
    await mkdir(zsh);
    const isOpened = await profiles.followAsync(zsh);
    const isOpenedAgain = await profiles.followAsync(zsh);

    Assert.isTrue(isOpened);
    Assert.isFalse(isOpenedAgain);
    Assert.areEqual(JSON.stringify([home, folder.path, zsh]), JSON.stringify(opened));
    Assert.areEqual(JSON.stringify([folder.path]), JSON.stringify(closed));
  }

  @TestMethod
  public async saysTheWatchesChangedWhenAWaitedFolderAppearsButCannotBeWatched(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const zsh = path.join(folder.path, "zsh");
    await mkdir(home);
    const diagnostics = new TextOutputFixture();
    const opened: string[] = [];
    const closed: string[] = [];
    using profiles = ProfileWatch.start(home, zsh, ProfileWatchTests.PROFILES, () => undefined, diagnostics, (t, u) => {
      if (t === zsh)
        throw Object.assign(new Error("EACCES: the folder cannot be watched."), { code: "EACCES" });
      return ProfileWatchTests.record(watch(t, { persistent: false }, t === folder.path ? (): void => undefined : u), t, opened, closed);
    });

    await profiles.readStampAsync();
    await mkdir(zsh);
    const isChanged = await profiles.followAsync(zsh);

    Assert.isTrue(isChanged);
    Assert.areEqual(JSON.stringify([home, folder.path]), JSON.stringify(opened));
    Assert.areEqual(JSON.stringify([folder.path]), JSON.stringify(closed));
    Assert.areEqual(ProfileWatchTests.UNWATCHED, diagnostics.text);
  }

  @TestMethod
  public async waitsAgainWhenTheParentItWaitsInIsRemovedAndMadeAgain(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const config = path.join(folder.path, "config");
    const zsh = path.join(config, "zsh");
    await mkdir(home);
    await mkdir(config);
    const listeners = new Map<string, (event: string, name: string | null) => void>();
    const opened: string[] = [];
    const closed: string[] = [];
    let changes = 0;
    using profiles = ProfileWatch.start(home, zsh, ProfileWatchTests.PROFILES, () => changes++, new TextOutputFixture(), (t, u) => {
      if (!existsSync(t))
        throw Object.assign(new Error("ENOENT: the folder is gone."), { code: "ENOENT" });
      listeners.set(t, u);
      return ProfileWatchTests.record(watch(folder.path, { persistent: false }, () => undefined), t, opened, closed);
    });

    await profiles.readStampAsync();
    await rename(config, path.join(folder.path, "config-old"));
    await mkdir(config);
    listeners.get(config)?.("rename", "config");
    await profiles.readStampAsync();
    const openedOnRemake = [...opened];
    await mkdir(zsh);
    listeners.get(config)?.("rename", "zsh");
    await profiles.readStampAsync();

    Assert.areEqual(JSON.stringify([home, config, config]), JSON.stringify(openedOnRemake));
    Assert.areEqual(JSON.stringify([home, config, config, zsh]), JSON.stringify(opened));
    Assert.areEqual(JSON.stringify([config, config]), JSON.stringify(closed));
    Assert.areEqual(2, changes);
  }

  @TestMethod
  public async closesTheWatchAndSaysTheProfilesAreUnwatchedWhenItFails(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const diagnostics = new TextOutputFixture();
    const watchers: FSWatcher[] = [];
    let closes = 0;
    const profiles = ProfileWatch.start(folder.path, undefined, ProfileWatchTests.PROFILES, () => undefined, diagnostics, (t, u) => {
      const started = watch(t, { persistent: false }, u);
      started.on("close", () => closes++);
      watchers.push(started);
      return started;
    });

    await profiles.readStampAsync();
    watchers[0]?.emit("error", new Error("The folder was removed."));
    const isClosed = await WaitFixture.untilAsync(() => closes > 0, 5_000);
    profiles[Symbol.dispose]();

    Assert.isTrue(isClosed);
    Assert.areEqual(ProfileWatchTests.UNWATCHED, diagnostics.text);
  }

  @TestMethod
  public async watchesAnotherZshFolderWithoutClosingTheOthersAndSaysWhetherItsWatchesChanged(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const zsh = path.join(folder.path, "zsh");
    await mkdir(home);
    await mkdir(zsh);
    const opened: string[] = [];
    const closed: string[] = [];
    using profiles = ProfileWatch.start(home, undefined, ProfileWatchTests.PROFILES, () => undefined, new TextOutputFixture(),
      (t, u) => ProfileWatchTests.record(watch(t, { persistent: false }, u), t, opened, closed));

    const isZshOpened = await profiles.followAsync(zsh);
    const isOpenedAgain = await profiles.followAsync(zsh);
    const isZshClosed = await profiles.followAsync(undefined);

    Assert.isTrue(isZshOpened);
    Assert.isFalse(isOpenedAgain);
    Assert.isTrue(isZshClosed);
    Assert.areEqual(JSON.stringify([home, zsh]), JSON.stringify(opened));
    Assert.areEqual(JSON.stringify([zsh]), JSON.stringify(closed));
  }

  @TestMethod
  public async reopensAFailedFolderAtEachFollowAndSaysSoOnlyOnceUntilItsWatchHolds(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const diagnostics = new TextOutputFixture();
    const watchers: FSWatcher[] = [];
    let changes = 0;
    using profiles = ProfileWatch.start(folder.path, undefined, ProfileWatchTests.PROFILES, () => changes++, diagnostics, (t, u) => {
      const started = watch(t, { persistent: false }, u);
      watchers.push(started);
      return started;
    });

    await profiles.readStampAsync();
    watchers[0]?.emit("error", new Error("The folder was removed."));
    await profiles.readStampAsync();
    const changesOnFailure = changes;
    const isReopened = await profiles.followAsync(undefined);
    watchers[1]?.emit("error", new Error("The folder was removed."));
    await profiles.readStampAsync();
    const changesOnSecondFailure = changes;
    const isReopenedAgain = await profiles.followAsync(undefined);
    const isHeld = await profiles.followAsync(undefined);
    watchers[2]?.emit("error", new Error("The folder was removed."));
    await profiles.readStampAsync();

    Assert.areEqual(1, changesOnFailure);
    Assert.isTrue(isReopened);
    Assert.areEqual(1, changesOnSecondFailure);
    Assert.isFalse(isReopenedAgain);
    Assert.isFalse(isHeld);
    Assert.areEqual(2, changes);
    Assert.areEqual(3, watchers.length);
    Assert.areEqual(ProfileWatchTests.UNWATCHED.repeat(3), diagnostics.text);
  }

  @TestMethod
  public async closesAFolderThatWasReplacedAndOpensItAgainAtTheNextFollow(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const zsh = path.join(folder.path, "zsh");
    await mkdir(home);
    await mkdir(zsh);
    const listeners = new Map<string, (event: string, name: string | null) => void>();
    const opened: string[] = [];
    const closed: string[] = [];
    let changes = 0;
    using profiles = ProfileWatch.start(home, zsh, ProfileWatchTests.PROFILES, () => changes++, new TextOutputFixture(), (t, u) => {
      listeners.set(t, u);
      return ProfileWatchTests.record(watch(folder.path, { persistent: false }, () => undefined), t, opened, closed);
    });

    await profiles.readStampAsync();
    listeners.get(zsh)?.("rename", "zsh");
    await profiles.readStampAsync();
    const changesWhileKept = changes;
    const closedWhileKept = [...closed];
    await rename(zsh, path.join(folder.path, "zsh-old"));
    await mkdir(zsh);
    listeners.get(zsh)?.("rename", "zsh");
    await profiles.readStampAsync();
    const closedOnReplace = [...closed];
    const isOpened = await profiles.followAsync(zsh);

    Assert.areEqual(0, changesWhileKept);
    Assert.areEqual(String.empty, closedWhileKept.join(","));
    Assert.areEqual(zsh, closedOnReplace.join(","));
    Assert.areEqual(1, changes);
    Assert.isTrue(isOpened);
    Assert.areEqual(JSON.stringify([home, zsh, zsh]), JSON.stringify(opened));
  }

  @TestMethod
  public async closesAFolderReplacedByOneWhoseFileNumberDiffersOnlyBeyondANumbersPrecision(): Promise<void> {
    Assert.areEqual(Number(ProfileWatchTests.FILE_NUMBER), Number(ProfileWatchTests.NEXT_FILE_NUMBER));
    await ProfileWatchTests.closesAReplacedFolderAsync({ dev: ProfileWatchTests.DEVICE, ino: ProfileWatchTests.FILE_NUMBER },
      { dev: ProfileWatchTests.DEVICE, ino: ProfileWatchTests.NEXT_FILE_NUMBER });
  }

  @TestMethod
  public async closesAFolderReplacedByOneWithTheSameFileNumberOnAnotherDevice(): Promise<void> {
    await ProfileWatchTests.closesAReplacedFolderAsync({ dev: ProfileWatchTests.DEVICE, ino: ProfileWatchTests.FILE_NUMBER },
      { dev: ProfileWatchTests.OTHER_DEVICE, ino: ProfileWatchTests.FILE_NUMBER });
  }

  @TestMethod
  public async closesAFolderMadeAfterItsIdentityWasTakenWhenItIsRemoved(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const zsh = path.join(folder.path, "zsh");
    await mkdir(home);
    const listeners = new Map<string, (event: string, name: string | null) => void>();
    const opened: string[] = [];
    const closed: string[] = [];
    let changes = 0;
    using profiles = ProfileWatch.start(home, zsh, ProfileWatchTests.PROFILES, () => changes++, new TextOutputFixture(), (t, u) => {
      if (t === zsh && !existsSync(zsh))
        mkdirSync(zsh);
      listeners.set(t, u);
      return ProfileWatchTests.record(watch(folder.path, { persistent: false }, () => undefined), t, opened, closed);
    });
    await profiles.readStampAsync();
    const closedOnOpen = [...closed];

    await rename(zsh, path.join(folder.path, "zsh-old"));
    listeners.get(zsh)?.("rename", "zsh");
    await profiles.readStampAsync();

    Assert.areEqual(JSON.stringify([home, zsh, zsh]), JSON.stringify(opened));
    Assert.areEqual(JSON.stringify([zsh]), JSON.stringify(closedOnOpen));
    Assert.areEqual(JSON.stringify([zsh, zsh]), JSON.stringify(closed));
    Assert.areEqual(1, changes);
  }

  @TestMethod
  public async watchesAFolderMadeAndReplacedWhileItsWatchOpensAgainSoTheWatchIsOnTheFolderThatStays(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const zsh = path.join(folder.path, "zsh");
    await mkdir(home);
    const listeners = new Map<string, (event: string, name: string | null) => void>();
    const opened: string[] = [];
    const closed: string[] = [];
    let changes = 0;
    using profiles = ProfileWatch.start(home, zsh, ProfileWatchTests.PROFILES, () => changes++, new TextOutputFixture(), (t, u) => {
      if (t === zsh && !existsSync(zsh)) {
        mkdirSync(zsh);
        renameSync(zsh, path.join(folder.path, "zsh-old"));
        mkdirSync(zsh);
      }
      listeners.set(t, u);
      return ProfileWatchTests.record(watch(folder.path, { persistent: false }, () => undefined), t, opened, closed);
    });

    await profiles.readStampAsync();
    listeners.get(zsh)?.("rename", "zsh");
    await profiles.readStampAsync();

    Assert.areEqual(JSON.stringify([home, zsh, zsh]), JSON.stringify(opened));
    Assert.areEqual(JSON.stringify([zsh]), JSON.stringify(closed));
    Assert.areEqual(0, changes);
  }

  @TestMethod
  public async takesAFoldersIdentityBeforeItsWatchSoAFolderReplacedWhileItOpensIsClosed(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const zsh = path.join(folder.path, "zsh");
    await mkdir(home);
    await mkdir(zsh);
    const listeners = new Map<string, (event: string, name: string | null) => void>();
    const closed: string[] = [];
    let changes = 0;
    using profiles = ProfileWatch.start(home, zsh, ProfileWatchTests.PROFILES, () => changes++, new TextOutputFixture(), (t, u) => {
      if (t === zsh) {
        renameSync(zsh, path.join(folder.path, "zsh-old"));
        mkdirSync(zsh);
      }
      listeners.set(t, u);
      return ProfileWatchTests.record(watch(folder.path, { persistent: false }, () => undefined), t, [], closed);
    });

    await profiles.readStampAsync();
    listeners.get(zsh)?.("rename", "zsh");
    await profiles.readStampAsync();

    Assert.areEqual(JSON.stringify([zsh]), JSON.stringify(closed));
    Assert.areEqual(1, changes);
  }

  @TestMethod
  public async waitsForAFolderThatIsGoneBothBeforeAndAfterItsWatchOpens(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const zsh = path.join(folder.path, "zsh");
    await mkdir(home);
    const opened: string[] = [];
    const closed: string[] = [];
    using profiles = ProfileWatch.start(home, undefined, ProfileWatchTests.PROFILES, () => undefined, new TextOutputFixture(),
      (t, u) => ProfileWatchTests.record(watch(t === zsh ? folder.path : t, { persistent: false }, t === folder.path ? (): void => undefined : u), t, opened, closed));

    const isWaiting = await profiles.followAsync(zsh);

    Assert.isTrue(isWaiting);
    Assert.areEqual(JSON.stringify([home, zsh, zsh, folder.path]), JSON.stringify(opened));
    Assert.areEqual(JSON.stringify([zsh, zsh]), JSON.stringify(closed));
  }

  @TestMethod
  public async opensNothingWhenDisposedBeforeItsFirstFollowRuns(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const opened: string[] = [];

    const profiles = ProfileWatch.start(folder.path, undefined, ProfileWatchTests.PROFILES, () => undefined, new TextOutputFixture(),
      (t, u) => ProfileWatchTests.record(watch(t, { persistent: false }, u), t, opened, []));
    profiles[Symbol.dispose]();
    const isOpened = await profiles.followAsync(undefined);

    Assert.isFalse(isOpened);
    Assert.areEqual("[]", JSON.stringify(opened));
  }

  @TestMethod
  public async opensNoFolderWhoseIdentityArrivesAfterTheWatchIsDisposed(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const zsh = path.join(folder.path, "zsh");
    await mkdir(home);

    const openedOnFolder = await ProfileWatchTests.disposeWhileIdentifyingAsync(home, zsh, home);
    const openedOnParent = await ProfileWatchTests.disposeWhileIdentifyingAsync(home, zsh, folder.path);

    Assert.areEqual("[]", JSON.stringify(openedOnFolder));
    Assert.areEqual(JSON.stringify([home]), JSON.stringify(openedOnParent));
  }

  @TestMethod
  public async passesOverEventsThatArriveAfterTheWatchIsDisposed(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    let listener: (event: string, name: string | null) => void = () => undefined;
    let changes = 0;
    const profiles = ProfileWatch.start(folder.path, undefined, ProfileWatchTests.PROFILES, () => changes++, new TextOutputFixture(), (t, u) => {
      listener = u;
      return watch(t, { persistent: false }, () => undefined);
    });

    await profiles.readStampAsync();
    profiles[Symbol.dispose]();
    listener("change", ".zshrc");
    await profiles.readStampAsync();

    Assert.areEqual(0, changes);
  }

  @TestMethod
  public async failsThisAndEveryLaterCallWhenAFolderCannotBeWatchedForAnUnmodeledReason(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();

    using profiles = ProfileWatch.start(folder.path, undefined, ProfileWatchTests.PROFILES, () => undefined, new TextOutputFixture(), () => {
      throw new Error("The watcher broke.");
    });
    const stamping = profiles.readStampAsync();
    const error = await Assert.throwsAsync(() => stamping, Error);
    const later = await Assert.throwsAsync(() => profiles.followAsync(undefined), Error);

    Assert.areEqual("The watcher broke.", error.message);
    Assert.areEqual(error, later);
  }

  @TestMethod
  public async failsWhenTheParentOfAGoneFolderCannotBeWatchedForAnUnmodeledReason(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");

    using profiles = ProfileWatch.start(home, undefined, ProfileWatchTests.PROFILES, () => undefined, new TextOutputFixture(), t => {
      if (t === home)
        throw Object.assign(new Error("ENOENT: the folder is gone."), { code: "ENOENT" });
      throw new Error("The watcher broke.");
    });
    const stamping = profiles.readStampAsync();
    const error = await Assert.throwsAsync(() => stamping, Error);

    Assert.areEqual("The watcher broke.", error.message);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async failsWhenAProfileOrItsFolderCannotBeReadForAnUnmodeledReason(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "h".repeat(300));
    const gone = (): never => {
      throw Object.assign(new Error("ENOENT: the folder is gone."), { code: "ENOENT" });
    };

    using targeting = ProfileWatch.start(home, undefined, ProfileWatchTests.PROFILES, () => undefined, new TextOutputFixture(), gone);
    const targetStamp = targeting.readStampAsync();
    using identifying = ProfileWatch.start(home, undefined, ProfileWatchTests.PROFILES, () => undefined, new TextOutputFixture(), gone, () => Promise.resolve(null));
    const identityStamp = identifying.readStampAsync();
    using stamping = ProfileWatch.start(home, undefined, ProfileWatchTests.PROFILES, () => undefined, new TextOutputFixture(), gone, () => Promise.resolve(null),
      () => Promise.resolve(undefined));
    const ownStamp = stamping.readStampAsync();
    const [target, identity, stamp] = await Promise.all([Assert.throwsAsync(() => targetStamp, Error), Assert.throwsAsync(() => identityStamp, Error),
      Assert.throwsAsync(() => ownStamp, Error)]);

    Assert.isTrue(target.message.startsWith("ENAMETOOLONG"), target.message);
    Assert.isTrue(identity.message.startsWith("ENAMETOOLONG"), identity.message);
    Assert.isTrue(stamp.message.startsWith("ENAMETOOLONG"), stamp.message);
  }

  @TestMethod
  public async failsWhenAProfileOrItsFolderHasANameNoPathCanHold(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "h\u0000me");
    const gone = (): never => {
      throw Object.assign(new Error("ENOENT: the folder is gone."), { code: "ENOENT" });
    };

    using targeting = ProfileWatch.start(home, undefined, ProfileWatchTests.PROFILES, () => undefined, new TextOutputFixture(), gone);
    const targetStamp = targeting.readStampAsync();
    using identifying = ProfileWatch.start(home, undefined, ProfileWatchTests.PROFILES, () => undefined, new TextOutputFixture(), gone, () => Promise.resolve(null));
    const identityStamp = identifying.readStampAsync();
    using stamping = ProfileWatch.start(home, undefined, ProfileWatchTests.PROFILES, () => undefined, new TextOutputFixture(), gone, () => Promise.resolve(null),
      () => Promise.resolve(undefined));
    const ownStamp = stamping.readStampAsync();
    const [target, identity, stamp] = await Promise.all([Assert.throwsAsync(() => targetStamp, Error), Assert.throwsAsync(() => identityStamp, Error),
      Assert.throwsAsync(() => ownStamp, Error)]);

    Assert.isTrue(target.message.includes("null bytes"), target.message);
    Assert.isTrue(identity.message.includes("null bytes"), identity.message);
    Assert.isTrue(stamp.message.includes("null bytes"), stamp.message);
  }

  private static async disposeWhileIdentifyingAsync(home: string, zsh: string, at: string): Promise<readonly string[]> {
    const opened: string[] = [];
    const profiles = ProfileWatch.start(home, zsh, ProfileWatchTests.PROFILES, () => undefined, new TextOutputFixture(),
      (t, u) => ProfileWatchTests.record(watch(t, { persistent: false }, u), t, opened, []), undefined, t => {
        if (t === at)
          profiles[Symbol.dispose]();
        return Promise.resolve(t === zsh ? undefined : { dev: ProfileWatchTests.DEVICE, ino: ProfileWatchTests.HOME_FILE_NUMBER });
      });
    await profiles.readStampAsync();
    return opened;
  }

  private static async closesAReplacedFolderAsync(before: Pick<BigIntStats, "dev" | "ino">, after: Pick<BigIntStats, "dev" | "ino">): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const home = path.join(folder.path, "home");
    const zsh = path.join(folder.path, "zsh");
    await mkdir(home);
    await mkdir(zsh);
    const listeners = new Map<string, (event: string, name: string | null) => void>();
    const opened: string[] = [];
    const closed: string[] = [];
    let stats = before;
    let changes = 0;
    using profiles = ProfileWatch.start(home, zsh, ProfileWatchTests.PROFILES, () => changes++, new TextOutputFixture(), (t, u) => {
      listeners.set(t, u);
      return ProfileWatchTests.record(watch(folder.path, { persistent: false }, () => undefined), t, opened, closed);
    }, undefined, t => Promise.resolve(t === zsh ? stats : { dev: ProfileWatchTests.DEVICE, ino: ProfileWatchTests.HOME_FILE_NUMBER }));

    await profiles.readStampAsync();
    stats = after;
    listeners.get(zsh)?.("rename", "zsh");
    await profiles.readStampAsync();
    const isOpened = await profiles.followAsync(zsh);

    Assert.areEqual(zsh, closed.join(","));
    Assert.areEqual(1, changes);
    Assert.isTrue(isOpened);
    Assert.areEqual(JSON.stringify([home, zsh, zsh]), JSON.stringify(opened));
  }

  private static record(watcher: FSWatcher, folder: string, opened: string[], closed: string[]): FSWatcher {
    opened.push(folder);
    const close = watcher.close.bind(watcher);
    watcher.close = (): void => {
      closed.push(folder);
      close();
    };
    return watcher;
  }

  private static async rewriteUntilAsync(file: string, isSeen: () => boolean): Promise<boolean> {
    let writes = 0;
    return await WaitFixture.untilAsync(async () => {
      if (isSeen())
        return true;
      await writeFile(file, `export EDITOR=vim${++writes}\n`);
      return false;
    }, 5_000, 100);
  }
}
