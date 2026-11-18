/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmod, mkdir, mkdtemp, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import type { IIpcEvent } from "@noldova/desktop.electron";

import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";
import { PlatformFixture } from "../fixtures/platform.fixture.js";
import { LinkedPathsFixture } from "../fixtures/linked-paths.fixture.js";

@TestClass
export class ShellOpenerTests {
  @TestMethod
  public async opensOnlyAllowedLinksFromItsOwnWindowAndLogsTheOnesItDoesNotOpen(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const trusted = MainProcessStartFixture.trustedEvent("linux");
    const open = async (url: unknown, event: IIpcEvent = trusted): Promise<unknown> => electron.ipcMain.invoke("desktop:openLink", event, url);

    const answers = [
      await open("https://example.com/docs?page=2#top"),
      await open("HTTP://Example.com"),
      await open("mailto:support@example.com?subject=Noldova%20Desktop%20Sample"),
      await open(`https://example.com/${"x".repeat(32748)}`),
      await open(`https://example.com/${"x".repeat(32749)}`),
      await open("file:///etc/passwd"),
      await open("javascript:alert(1)"),
      await open("noldova-desktop://open"),
      await open("https://user:secret@example.com/"),
      await open("not a link"),
      await open(5),
      await open("https://example.com/", { sender: { id: 1 }, senderFrame: null })
    ];
    electron.shell.linkFailure = new Error("No browser is installed.");
    answers.push(await open("https://example.com/"));

    Assert.areEqual(JSON.stringify([true, true, true, true, false, false, false, false, false, false, false, false, false]), JSON.stringify(answers));
    Assert.areEqual(JSON.stringify([
      "https://example.com/docs?page=2#top",
      "http://example.com/",
      "mailto:support@example.com?subject=Noldova%20Desktop%20Sample",
      `https://example.com/${"x".repeat(32748)}`,
      "https://example.com/"
    ]), JSON.stringify(electron.shell.links));
    const lines = process.errors.split("\n").filter(t => t.includes("link")).map(t => t.slice(t.indexOf(" ") + 1));
    Assert.areEqual(JSON.stringify([
      ...Array.from({ length: 7 }, () => "A link was not opened: only well-formed http, https and mailto links without credentials open."),
      "A link could not be opened: Error: No browser is installed."
    ]), JSON.stringify(lines));
  }

  @TestMethod
  public async showsAnExistingFileOrFolderFromItsOwnWindowAndLogsWhyItRefusesTheOthers(): Promise<void> {
    const folder = await realpath(await mkdtemp(join(tmpdir(), "desktop-main-process-")));
    try {
      const file = join(folder, "report.pdf");
      const link = join(folder, "linked");
      await writeFile(file, "report");
      await mkdir(join(folder, "inner"));
      await symlink(join(folder, "inner"), link, "junction");
      const environment = new FakeMainProcessEnvironment(process.platform);
      const electron = await MainProcessStartFixture.startReadyAsync(process.platform, new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), environment);
      const show = async (path: unknown, event: IIpcEvent = MainProcessStartFixture.trustedEvent(process.platform)): Promise<unknown> =>
        electron.ipcMain.invoke("desktop:showInFolder", event, path);
      const windowUrl = MainProcessStartFixture.settings(process.platform).windowUrl;
      const untrusted: IIpcEvent[] = [
        { sender: { id: 1 }, senderFrame: null },
        { sender: { id: 1 }, senderFrame: { url: windowUrl, parent: {} } },
        { sender: { id: 1 }, senderFrame: { url: "https://example.com/", parent: null } },
        { sender: { id: 7 }, senderFrame: { url: windowUrl, parent: null } }
      ];

      const answers = [
        await show(file),
        await show(folder),
        await show(link),
        await show(join(folder, "missing.pdf")),
        await show("report.pdf"),
        await show(String.empty),
        await show(`${file}\u0000.txt`),
        await show(5),
        ...await Promise.all(untrusted.map(t => show(file, t)))
      ];

      Assert.areEqual(JSON.stringify([
        null,
        null,
        null,
        "no file can be read at the path.",
        "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is shown, never a network or device path.",
        "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is shown, never a network or device path.",
        "the path isn't text without null characters.",
        "the path isn't text without null characters.",
        ...untrusted.map(() => "the request didn't come from one of the app's windows.")
      ]), JSON.stringify(answers));
      Assert.areEqual(JSON.stringify([file, folder, join(folder, "inner")]), JSON.stringify(electron.shell.shownFiles));
      const lines = environment.errors.split("\n").filter(t => t.includes("A file was not shown")).map(t => t.slice(t.indexOf(" ") + 1));
      Assert.areEqual(JSON.stringify(answers.slice(3).map(t => `A file was not shown in its folder: ${String(t)}`)), JSON.stringify(lines));
      Assert.isFalse(environment.errors.includes(folder) || environment.errors.includes("example.com"));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  @TestData("win32", "\\\\server\\share\\report.pdf")
  @TestData("win32", "\\\\?\\C:\\report.pdf")
  @TestData("win32", "\\\\.\\C:\\report.pdf")
  @TestData("win32", "\\report.pdf")
  @TestData("win32", "C:report.pdf")
  @TestData("win32", "/home/ada/report.pdf")
  @TestData("linux", "C:\\Users\\ada\\report.pdf")
  @TestData("linux", "home/ada/report.pdf")
  @TestData("darwin", "Users/ada/report.pdf")
  public async refusesAPathThatIsNotAbsoluteOnItsPlatformWithoutLookingForIt(platform: string, path: string): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync(platform);

    const answer = await electron.ipcMain.invoke("desktop:showInFolder", MainProcessStartFixture.trustedEvent(platform), path);

    Assert.areEqual("the path isn't absolute; on Windows only a path on a drive, such as C:\\, is shown, never a network or device path.", answer);
    Assert.areEqual(0, electron.shell.shownFiles.length);
  }

  @TestMethod
  @TestData("win32", "C:\\Noldova missing folder\\report.pdf")
  @TestData("win32", "c:/Noldova missing folder/report.pdf")
  @TestData("linux", "/Noldova missing folder/report.pdf")
  public async looksForADrivePathOnWindowsAndAnAbsolutePathElsewhere(platform: string, path: string): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync(platform);

    const answer = await electron.ipcMain.invoke("desktop:showInFolder", MainProcessStartFixture.trustedEvent(platform), path);

    Assert.areEqual("no file can be read at the path.", answer);
    Assert.areEqual(0, electron.shell.shownFiles.length);
  }

  @TestMethod
  public async opensOnlyAListedDocumentOrTextFileFromItsOwnWindowAndLogsWhyItRefusesTheOthers(): Promise<void> {
    const folder = await realpath(await mkdtemp(join(tmpdir(), "desktop-main-process-")));
    try {
      const listed = [
        ".pdf", ".docx", ".xlsx", ".pptx", ".rtf", ".odt", ".ods", ".odp",
        ".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".log", ".yaml", ".yml", ".xml", ".toml", ".MD"
      ].map(t => join(folder, `report${t}`));
      const unlisted = ["run.exe", "run.sh", "run.bat", "run.app", "page.html", "report.pdf.exe", "README", ".md"].map(t => join(folder, t));
      await Promise.all([...listed, ...unlisted].map(t => writeFile(t, "report")));
      await mkdir(join(folder, "inner.md"));
      await symlink(join(folder, "inner.md"), join(folder, "linked.md"), "junction");
      const environment = new FakeMainProcessEnvironment(process.platform);
      const electron = await MainProcessStartFixture.startReadyAsync(process.platform, new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), environment);
      const open = async (path: unknown, event: IIpcEvent = MainProcessStartFixture.trustedEvent(process.platform)): Promise<unknown> =>
        electron.ipcMain.invoke("desktop:openFile", event, path);
      const windowUrl = MainProcessStartFixture.settings(process.platform).windowUrl;
      const untrusted: IIpcEvent[] = [
        { sender: { id: 1 }, senderFrame: null },
        { sender: { id: 1 }, senderFrame: { url: windowUrl, parent: {} } },
        { sender: { id: 1 }, senderFrame: { url: "https://example.com/", parent: null } },
        { sender: { id: 7 }, senderFrame: { url: windowUrl, parent: null } }
      ];

      const answers = [
        ...await Promise.all(listed.map(t => open(t))),
        ...await Promise.all(unlisted.map(t => open(t))),
        await open(join(folder, "inner.md")),
        await open(join(folder, "linked.md")),
        await open(join(folder, "missing.pdf")),
        await open("report.pdf"),
        await open(String.empty),
        await open(`${listed[0]!}\u0000.txt`),
        await open(5),
        ...await Promise.all(untrusted.map(t => open(listed[0], t)))
      ];

      Assert.areEqual(JSON.stringify([
        ...listed.map(() => null),
        ...unlisted.map(() => "only documents and text files open, such as .pdf, .docx, .txt or .md; any other file, a program or a script included, never opens."),
        "the path isn't a regular file; a folder, or a link to one, isn't opened.",
        "the path isn't a regular file; a folder, or a link to one, isn't opened.",
        "no file can be read at the path.",
        "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is opened, never a network or device path.",
        "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is opened, never a network or device path.",
        "the path isn't text without null characters.",
        "the path isn't text without null characters.",
        ...untrusted.map(() => "the request didn't come from one of the app's windows.")
      ]), JSON.stringify(answers));
      const opened = await Promise.all(listed.map(t => realpath(t)));
      Assert.areEqual(JSON.stringify(opened.sort()), JSON.stringify([...electron.shell.opened].sort()));
      const lines = environment.errors.split("\n").filter(t => t.includes("A file was not opened")).map(t => t.slice(t.indexOf(" ") + 1));
      Assert.areEqual(JSON.stringify(answers.slice(listed.length).map(t => `A file was not opened: ${String(t)}`)), JSON.stringify(lines));
      Assert.isFalse(environment.errors.includes(folder) || environment.errors.includes("example.com"));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async answersAndLogsThatTheSystemCouldNotOpenAListedFileWithoutLoggingItsPath(): Promise<void> {
    const folder = await realpath(await mkdtemp(join(tmpdir(), "desktop-main-process-")));
    try {
      const file = join(folder, "report.pdf");
      await writeFile(file, "report");
      const environment = new FakeMainProcessEnvironment(process.platform);
      const electron = await MainProcessStartFixture.startReadyAsync(process.platform, new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), environment);
      electron.shell.failure = `No application is associated with ${file}.`;

      const answer = await electron.ipcMain.invoke("desktop:openFile", MainProcessStartFixture.trustedEvent(process.platform), file);

      Assert.areEqual("the system couldn't open the file.", answer);
      Assert.areEqual(JSON.stringify([file]), JSON.stringify(electron.shell.opened));
      Assert.isTrue(environment.errors.includes("A file was not opened: the system couldn't open the file."));
      Assert.isFalse(environment.errors.includes(folder));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async neverOpensAFileMarkedExecutableOrALinkToAnUnlistedKindButOpensALinkToAListedOne(): Promise<void> {
    const folder = await realpath(await mkdtemp(join(tmpdir(), "desktop-main-process-")));
    try {
      const script = join(folder, "run.sh");
      const notes = join(folder, "notes.txt");
      const ownerMarked = join(folder, "owner.txt");
      const groupMarked = join(folder, "group.md");
      const disguised = join(folder, "report.pdf");
      const linked = join(folder, "linked.md");
      await Promise.all([script, notes, ownerMarked, groupMarked].map(t => writeFile(t, "report")));
      await chmod(ownerMarked, 0o744);
      await chmod(groupMarked, 0o654);
      await symlink(script, disguised);
      await symlink(notes, linked);
      const electron = await MainProcessStartFixture.startReadyAsync(process.platform);
      const open = async (path: string): Promise<unknown> =>
        electron.ipcMain.invoke("desktop:openFile", MainProcessStartFixture.trustedEvent(process.platform), path);

      const answers = [await open(ownerMarked), await open(groupMarked), await open(disguised), await open(linked)];

      Assert.areEqual(JSON.stringify([
        "the file is marked executable, so it never opens.",
        "the file is marked executable, so it never opens.",
        "only documents and text files open, such as .pdf, .docx, .txt or .md; any other file, a program or a script included, never opens.",
        null
      ]), JSON.stringify(answers));
      Assert.areEqual(JSON.stringify([notes]), JSON.stringify(electron.shell.opened));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  @TestData("linux", "/Noldova/report.pdf", "/Noldova/run.sh", 0o100644, "only documents and text files open, such as .pdf, .docx, .txt or .md; any other file, a program or a script included, never opens.")
  @TestData("win32", "C:\\Noldova\\report.pdf", "C:\\Noldova\\run.exe", 0o100666, "only documents and text files open, such as .pdf, .docx, .txt or .md; any other file, a program or a script included, never opens.")
  @TestData("darwin", "/Noldova/notes.md", "/Noldova/notes.md", 0o100744, "the file is marked executable, so it never opens.")
  @TestData("linux", "/Noldova/notes.txt", "/Noldova/notes.txt", 0o100601, "the file is marked executable, so it never opens.")
  @TestData("win32", "C:\\Noldova\\notes.txt", "C:\\Noldova\\notes.txt", 0o100755, null)
  @TestData("linux", "/Noldova/linked.md", "/Noldova/notes.txt", 0o100644, null)
  @TestData("win32", "C:\\Noldova\\shared.pdf", "\\\\server\\share\\Noldova\\report.pdf", 0o100666, "a link in the path leads to a network or device path, which is never opened.")
  @TestData("win32", "C:\\Noldova\\linked.pdf", "\\\\?\\Volume{4a1b}\\report.pdf", 0o100666, "a link in the path leads to a network or device path, which is never opened.")
  public async checksTheKindOfTheFileAPathLeadsToAndItsExecuteBitsOffWindows(platform: string, path: string, target: string, mode: number, expected: string | null): Promise<void> {
    const paths = new LinkedPathsFixture(platform, path === target ? { [path]: mode } : { [path]: target, [target]: mode });
    const electron = await ShellOpenerTests.startWithPathsAsync(platform, paths);

    const answer = await electron.ipcMain.invoke("desktop:openFile", MainProcessStartFixture.trustedEvent(platform), path);

    Assert.areEqual(expected, answer);
    Assert.areEqual(JSON.stringify(Object.isNull(expected) ? [target] : []), JSON.stringify(electron.shell.opened));
    Assert.isFalse(paths.looked.some(t => t.startsWith("\\\\")), paths.looked.join(" "));
  }

  @TestMethod
  @TestData("desktop:showInFolder", null)
  @TestData("desktop:openFile", "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is opened, never a network or device path.")
  public async showsAFileOnAMappedDriveAsBeforeAndOpensNoneThatLeadsToANetworkPath(channel: string, expected: string | null): Promise<void> {
    const path = "Z:\\Noldova\\report.pdf";
    const electron = await ShellOpenerTests.startWithPathsAsync("win32", new LinkedPathsFixture("win32", { [path]: 0o100666 }, { [path]: "\\\\server\\share\\Noldova\\report.pdf" }));

    const answer = await electron.ipcMain.invoke(channel, MainProcessStartFixture.trustedEvent("win32"), path);

    Assert.areEqual(expected, answer);
    Assert.areEqual(JSON.stringify(Object.isNull(expected) ? [path] : []), JSON.stringify([...electron.shell.shownFiles, ...electron.shell.opened]));
  }

  @TestMethod
  public async opensNoFileWhoseRealPathCannotBeReadAfterItsLinksWereFollowed(): Promise<void> {
    const path = "C:\\Noldova\\report.pdf";
    const electron = await ShellOpenerTests.startWithPathsAsync("win32", new LinkedPathsFixture("win32", { [path]: 0o100666 }, { [path]: null }));

    const answer = await electron.ipcMain.invoke("desktop:openFile", MainProcessStartFixture.trustedEvent("win32"), path);

    Assert.areEqual("no file can be read at the path.", answer);
    Assert.areEqual(0, electron.shell.opened.length);
  }

  @TestMethod
  @TestData("desktop:showInFolder", "a link in the path leads to a network or device path, which is never shown.")
  @TestData("desktop:openFile", "a link in the path leads to a network or device path, which is never opened.")
  public async refusesAFileBehindALinkToANetworkPathWithoutLookingAtIt(channel: string, expected: string): Promise<void> {
    const paths = new LinkedPathsFixture("win32", {
      "C:\\Users\\ada\\Profiles": "\\\\server\\share\\Profiles",
      "C:\\Users\\ada\\notes.md": "\\\\server\\share\\notes.md",
      "C:\\Users\\ada\\Work": "D:\\Work",
      "D:\\Work\\Profiles": "C:\\Users\\ada\\Profiles"
    });
    const electron = await ShellOpenerTests.startWithPathsAsync("win32", paths);

    const answers = [
      await electron.ipcMain.invoke(channel, MainProcessStartFixture.trustedEvent("win32"), "C:\\Users\\ada\\notes.md"),
      await electron.ipcMain.invoke(channel, MainProcessStartFixture.trustedEvent("win32"), "C:\\Users\\ada\\Profiles\\report.pdf"),
      await electron.ipcMain.invoke(channel, MainProcessStartFixture.trustedEvent("win32"), "C:\\Users\\ada\\Work\\Profiles\\report.pdf")
    ];

    Assert.areEqual(JSON.stringify([expected, expected, expected]), JSON.stringify(answers));
    Assert.areEqual(0, electron.shell.shownFiles.length + electron.shell.opened.length);
    Assert.isFalse(paths.looked.some(t => t.startsWith("\\\\")), paths.looked.join(" "));
  }

  @TestMethod
  public async refusesToShowAFolderWhoseLinkLeadsToANetworkPathWithoutLookingAtIt(): Promise<void> {
    const paths = new LinkedPathsFixture("win32", { "C:\\Users\\ada\\Profiles": "\\\\server\\share\\Profiles" });
    const electron = await ShellOpenerTests.startWithPathsAsync("win32", paths);

    const answer = await electron.ipcMain.invoke("desktop:showInFolder", MainProcessStartFixture.trustedEvent("win32"), "C:\\Users\\ada\\Profiles");

    Assert.areEqual("a link in the path leads to a network or device path, which is never shown.", answer);
    Assert.areEqual(0, electron.shell.shownFiles.length);
    Assert.isFalse(paths.looked.some(t => t.startsWith("\\\\")), paths.looked.join(" "));
  }

  @TestMethod
  @TestData("/Noldova/data/report.pdf", null, "/Noldova/data/report.pdf")
  @TestData("/Noldova/./data/../data/report.pdf", null, "/Noldova/data/report.pdf")
  @TestData("/Noldova/linked/report.pdf", null, "/Noldova/data/report.pdf")
  @TestData("/Noldova/inner/../report.pdf", null, "/Noldova/data/report.pdf")
  @TestData("/Noldova/top", null, "/")
  @TestData("/Noldova/profile", null, "/Noldova/data")
  @TestData("/Noldova/pipe", "the path isn't a regular file or a folder.", null)
  @TestData("/Noldova/loop/report.pdf", "no file can be read at the path.", null)
  @TestData("/Noldova/broken/report.pdf", "no file can be read at the path.", null)
  @TestData("/Noldova/dangling", "no file can be read at the path.", null)
  @TestData("/Noldova/data/report.pdf/inner", "no file can be read at the path.", null)
  public async showsWhatAPathLeadsToByFollowingEachLinkInItInTurn(path: string, expected: string | null, shown: string | null): Promise<void> {
    const electron = await ShellOpenerTests.startWithPathsAsync("linux", new LinkedPathsFixture("linux", {
      "/Noldova/data/report.pdf": LinkedPathsFixture.fileMode,
      "/Noldova/linked": "data",
      "/Noldova/inner": "/Noldova/data/inner",
      "/Noldova/data/inner": LinkedPathsFixture.folderMode,
      "/Noldova/top": "/",
      "/Noldova/profile": "linked",
      "/Noldova/pipe": 0o010644,
      "/Noldova/loop": "/Noldova/loop",
      "/Noldova/broken": null,
      "/Noldova/dangling": "/Noldova/missing"
    }));

    const answer = await electron.ipcMain.invoke("desktop:showInFolder", MainProcessStartFixture.trustedEvent("linux"), path);

    Assert.areEqual(expected, answer);
    Assert.areEqual(JSON.stringify(Object.isNull(shown) ? [] : [shown]), JSON.stringify(electron.shell.shownFiles));
  }

  @TestMethod
  @TestData("desktop:showInFolder", "a link in the path leads to a network or device path, which is never shown.")
  @TestData("desktop:openFile", "a link in the path leads to a network or device path, which is never opened.")
  public async dropsAParentFolderByItsTextOnWindowsBeforeFollowingALinkAndHandsOverTheCheckedPath(channel: string, refusal: string): Promise<void> {
    const paths = new LinkedPathsFixture("win32", {
      "C:\\Noldova\\joined": "C:\\Elsewhere\\inner",
      "C:\\Elsewhere\\inner": LinkedPathsFixture.folderMode,
      "C:\\Elsewhere\\notes.md": 0o100666,
      "C:\\Noldova\\notes.md": "\\\\server\\share\\notes.md",
      "C:\\Noldova\\report.md": 0o100666
    });
    const electron = await ShellOpenerTests.startWithPathsAsync("win32", paths);
    const send = async (path: string): Promise<unknown> => await electron.ipcMain.invoke(channel, MainProcessStartFixture.trustedEvent("win32"), path);

    const answers = [await send("C:\\Noldova\\joined\\..\\notes.md"), await send("C:\\Noldova\\joined\\..\\report.md")];

    Assert.areEqual(JSON.stringify([refusal, null]), JSON.stringify(answers));
    Assert.areEqual(JSON.stringify(["C:\\Noldova\\report.md"]), JSON.stringify([...electron.shell.shownFiles, ...electron.shell.opened]));
    Assert.isFalse(paths.looked.some(t => t.startsWith("\\\\") || t.startsWith("C:\\Elsewhere")), paths.looked.join(" "));
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async showsAndOpensTheFileWindowsReachesWhenAParentFolderFollowsAJunction(): Promise<void> {
    const folder = await realpath(await mkdtemp(join(tmpdir(), "desktop-main-process-")));
    try {
      const report = join(folder, "report.md");
      await mkdir(join(folder, "Elsewhere", "inner"), { recursive: true });
      await writeFile(report, "report");
      await symlink(join(folder, "Elsewhere", "inner"), join(folder, "joined"), "junction");
      const electron = await MainProcessStartFixture.startReadyAsync("win32");
      const path = [folder, "joined", "..", "report.md"].join(sep);
      const send = async (channel: string): Promise<unknown> => await electron.ipcMain.invoke(channel, MainProcessStartFixture.trustedEvent("win32"), path);

      const answers = [await send("desktop:showInFolder"), await send("desktop:openFile")];

      Assert.areEqual(JSON.stringify([null, null]), JSON.stringify(answers));
      Assert.areEqual(JSON.stringify([report, report]), JSON.stringify([...electron.shell.shownFiles, ...electron.shell.opened]));
      Assert.isTrue((await stat(path)).isFile());
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async followsALinkInALinksTextBeforeItsParentFolderAndOpensOrShowsTheFileItLeadsTo(): Promise<void> {
    const electron = await ShellOpenerTests.startWithPathsAsync("linux", new LinkedPathsFixture("linux", {
      "/Noldova/linked.md": "inner/../notes.md",
      "/Noldova/inner": "../Deep/folder",
      "/Deep/folder": LinkedPathsFixture.folderMode,
      "/Deep/notes.md": 0o100755,
      "/Deep/report.md": LinkedPathsFixture.fileMode,
      "/Noldova/notes.md": LinkedPathsFixture.fileMode,
      "/Noldova/report.md": "inner/../report.md"
    }));
    const send = async (channel: string, path: string): Promise<unknown> =>
      await electron.ipcMain.invoke(channel, MainProcessStartFixture.trustedEvent("linux"), path);

    const answers = [
      await send("desktop:openFile", "/Noldova/linked.md"),
      await send("desktop:openFile", "/Noldova/report.md"),
      await send("desktop:showInFolder", "/Noldova/linked.md")
    ];

    Assert.areEqual(JSON.stringify(["the file is marked executable, so it never opens.", null, null]), JSON.stringify(answers));
    Assert.areEqual(JSON.stringify(["/Deep/report.md"]), JSON.stringify(electron.shell.opened));
    Assert.areEqual(JSON.stringify(["/Deep/notes.md"]), JSON.stringify(electron.shell.shownFiles));
  }

  @TestMethod
  @TestData("win32", "C:\\Noldova missing folder\\run.exe")
  @TestData("win32", "C:\\Noldova missing folder\\Run.EXE")
  @TestData("win32", "C:/Noldova missing folder/run.cmd")
  @TestData("win32", "C:\\Noldova missing folder\\run.exe:notes.txt")
  @TestData("win32", "C:\\Noldova missing folder\\notes.md\\run.ps1")
  @TestData("win32", "C:\\Noldova missing folder\\setup.msi")
  @TestData("win32", "C:\\Noldova missing folder\\run.js")
  @TestData("win32", "C:\\Noldova missing folder\\run.vbs")
  @TestData("win32", "C:\\Noldova missing folder\\run.hta")
  @TestData("win32", "C:\\Noldova missing folder\\screen.scr")
  @TestData("win32", "C:\\Noldova missing folder\\report.lnk")
  @TestData("win32", "C:\\Noldova missing folder\\report.url")
  @TestData("win32", "C:\\Noldova missing folder\\report.doc")
  @TestData("win32", "C:\\Noldova missing folder\\report.xls")
  @TestData("win32", "C:\\Noldova missing folder\\report.ppt")
  @TestData("win32", "C:\\Noldova missing folder\\report.docm")
  @TestData("win32", "C:\\Noldova missing folder\\report.xlsm")
  @TestData("win32", "C:\\Noldova missing folder\\report.pptm")
  @TestData("linux", "/Noldova missing folder/run.sh")
  @TestData("linux", "/Noldova missing folder/report")
  @TestData("linux", "/Noldova missing folder/.md")
  @TestData("linux", "/Noldova missing folder/run.desktop")
  @TestData("linux", "/Noldova missing folder/run.jar")
  @TestData("darwin", "/Noldova missing folder/Run.app")
  @TestData("darwin", "/Noldova missing folder/run.command")
  @TestData("darwin", "/Noldova missing folder/report.webloc")
  @TestData("darwin", "/Noldova missing folder/report.docm")
  public async refusesAnUnlistedKindByItsNameWithoutLookingForIt(platform: string, path: string): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync(platform);

    const answer = await electron.ipcMain.invoke("desktop:openFile", MainProcessStartFixture.trustedEvent(platform), path);

    Assert.areEqual("only documents and text files open, such as .pdf, .docx, .txt or .md; any other file, a program or a script included, never opens.", answer);
    Assert.areEqual(0, electron.shell.opened.length);
  }

  @TestMethod
  @TestData("win32", "C:\\Noldova missing folder\\Report.PDF", "no file can be read at the path.")
  @TestData("win32", "c:/Noldova missing folder/notes.md", "no file can be read at the path.")
  @TestData("linux", "/Noldova missing folder/notes.txt", "no file can be read at the path.")
  @TestData("win32", "\\\\server\\share\\report.pdf", "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is opened, never a network or device path.")
  @TestData("win32", "\\\\?\\C:\\report.pdf", "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is opened, never a network or device path.")
  @TestData("linux", "C:\\Users\\ada\\report.pdf", "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is opened, never a network or device path.")
  public async looksForAListedKindOnlyAtAnAbsolutePathOnItsPlatform(platform: string, path: string, expected: string): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync(platform);

    const answer = await electron.ipcMain.invoke("desktop:openFile", MainProcessStartFixture.trustedEvent(platform), path);

    Assert.areEqual(expected, answer);
    Assert.areEqual(0, electron.shell.opened.length);
  }

  @TestMethod
  public async opensTheLogFolderForItsOwnWindowAndCreatesItFirst(): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const electron = new FakeElectron();
      await MainProcessStartFixture.startAsync(electron, new FakeMainProcessEnvironment("linux", [`--data-dir=${data}`]));
      await MainProcessStartFixture.openAsync(electron);

      const refused = await electron.ipcMain.invoke("desktop:openLogFolder", { sender: { id: 1 }, senderFrame: null });
      const isOpened = await electron.ipcMain.invoke("desktop:openLogFolder", MainProcessStartFixture.trustedEvent("linux"));

      Assert.areEqual(false, refused);
      Assert.areEqual(true, isOpened);
      Assert.isTrue((await stat(join(data, "logs"))).isDirectory());
      Assert.areEqual(JSON.stringify([join(data, "logs")]), JSON.stringify(electron.shell.opened));
    }
    finally {
      await rm(data, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async reportsALogFolderItCannotCreateOrOpen(): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const blocked = join(data, "blocked");
      await writeFile(blocked, String.empty);
      const unopened = new FakeElectron();
      const uncreated = new FakeElectron();
      unopened.shell.failure = "There is no file manager.";
      const unopenedProcess = new FakeMainProcessEnvironment("linux", [`--data-dir=${data}`]);
      const uncreatedProcess = new FakeMainProcessEnvironment("linux", [`--data-dir=${blocked}`]);
      await MainProcessStartFixture.startAsync(unopened, unopenedProcess);
      await MainProcessStartFixture.startAsync(uncreated, uncreatedProcess);
      await MainProcessStartFixture.openAsync(unopened);
      await MainProcessStartFixture.openAsync(uncreated);
      const answers: unknown[] = [];

      answers.push(await unopened.ipcMain.invoke("desktop:openLogFolder", MainProcessStartFixture.trustedEvent("linux")));
      answers.push(await uncreated.ipcMain.invoke("desktop:openLogFolder", MainProcessStartFixture.trustedEvent("linux")));

      Assert.areEqual(JSON.stringify([false, false]), JSON.stringify(answers));
      Assert.areEqual(JSON.stringify(["The log folder could not be opened: There is no file manager."]), JSON.stringify(MainProcessStartFixture.readErrors(unopenedProcess, "The log folder")));
      Assert.isTrue(MainProcessStartFixture.readErrors(uncreatedProcess, "The log folder")[0]?.startsWith("The log folder could not be opened: Error:") === true);
      Assert.areEqual(0, uncreated.shell.opened.length);
    }
    finally {
      await rm(data, { recursive: true, force: true });
    }
  }

  private static startWithPathsAsync(platform: string, paths: LinkedPathsFixture): Promise<FakeElectron> {
    const environment = new FakeMainProcessEnvironment(platform);
    environment.files = { lstat: t => paths.lstat(t), readlink: t => paths.readlink(t), realpath: t => paths.realpath(t), rename: environment.files.rename };
    return MainProcessStartFixture.startReadyAsync(platform, new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), environment);
  }
}
