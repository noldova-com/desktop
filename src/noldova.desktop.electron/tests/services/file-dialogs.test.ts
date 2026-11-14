/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Response, FileGrant } from "@noldova/desktop.protocol";
import type { IIpcEvent } from "@noldova/desktop.electron";

import { Condition } from "../fixtures/condition.fixture.js";
import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FailingFileCallFixture } from "../fixtures/failing-file-call.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";
import type { FakeMainProcessWindow } from "../fixtures/fake-main-process-window.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

interface IGrantingWindow {
  readonly electron: FakeElectron;
  readonly connection: FakeRuntimeConnection;
  readonly process: FakeMainProcessEnvironment;
  readonly window: FakeMainProcessWindow;
  readonly event: IIpcEvent;
  readonly folder: string;
}

@TestClass
export class FileDialogsTests {
  @TestMethod
  public async choosesAFolderOnTheWindowThatAskedAndAnswersNothingOnACancelOrAnotherSender(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");
    const window = MainProcessStartFixture.firstWindow(electron);
    const choose = async (canceled: boolean, filePaths: string[]): Promise<unknown> => {
      const count = electron.dialog.openDialogs.length;
      const answer = electron.ipcMain.invoke("desktop:chooseFolder", MainProcessStartFixture.trustedEvent("linux", window.id));
      await Condition.waitAsync(() => electron.dialog.openDialogs.length > count);
      FileDialogsTests.openDialog(electron, count).answer({ canceled, filePaths });
      return answer;
    };

    const answers = [
      await choose(false, ["/home/person/project"]),
      await choose(true, ["/home/person/project"]),
      await choose(false, []),
      await electron.ipcMain.invoke("desktop:chooseFolder", { sender: { id: window.id }, senderFrame: null })
    ];

    Assert.areEqual(JSON.stringify(["/home/person/project", null, null, null]), JSON.stringify(answers));
    Assert.areEqual(JSON.stringify([[window.id, ["openDirectory"]], [window.id, ["openDirectory"]], [window.id, ["openDirectory"]]]),
      JSON.stringify(electron.dialog.openDialogs.map(t => [t.windowId, t.options.properties])));
  }

  @TestMethod
  public async savesTheBytesToTheFileThePersonChoosesOnTheWindowThatAskedAndLogsWhatFailed(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const process = new FakeMainProcessEnvironment("linux");
      const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
      const window = MainProcessStartFixture.firstWindow(electron);
      const trusted = MainProcessStartFixture.trustedEvent("linux", window.id);
      electron.app.downloads = folder;
      const save = async (canceled: boolean, filePath: string, name: string = "photo.png"): Promise<unknown> => {
        const count = electron.dialog.saveDialogs.length;
        const answer = electron.ipcMain.invoke("desktop:saveFile", trusted, name, new Uint8Array([1, 2, 3]));
        await Condition.waitAsync(() => electron.dialog.saveDialogs.length > count);
        FileDialogsTests.saveDialog(electron, count).answer({ canceled, filePath });
        return answer;
      };
      const longestName = `${"é".repeat(127)}x`;
      const refusedNames = ["../photo.png", "a/photo.png", "a\\photo.png", "..", ".", String.empty, "x".repeat(256), "é".repeat(128), "CON", "con.txt", "COM1.log",
        "a:photo.png", "a*.png", "photo‮gnp.exe", "tab\t.png", "photo.", "photo ", 5];
      const tooMany = new Uint8Array(512 * 1024 * 1024 + 1);
      await writeFile(join(folder, "photo.png"), "old");
      await mkdir(join(folder, "taken"));

      const answers = [
        await save(false, join(folder, "photo.png")),
        await save(true, join(folder, "other.png")),
        await save(false, String.empty),
        await save(false, join(folder, "taken")),
        await save(true, join(folder, "other.png"), longestName),
        await save(true, join(folder, "other.png"), "console résumé.txt"),
        ...await Promise.all(refusedNames.map(t => electron.ipcMain.invoke("desktop:saveFile", trusted, t, new Uint8Array([1])))),
        await electron.ipcMain.invoke("desktop:saveFile", trusted, "photo.png", "bytes"),
        await electron.ipcMain.invoke("desktop:saveFile", trusted, "photo.png", tooMany),
        await electron.ipcMain.invoke("desktop:saveFile", { sender: { id: window.id }, senderFrame: null }, "photo.png", new Uint8Array([1]))
      ];

      Assert.areEqual(JSON.stringify(["Saved", "Cancelled", "Cancelled", "Failed", "Cancelled", "Cancelled", ...Array.from({ length: 21 }, () => "Failed")]),
        JSON.stringify(answers));
      Assert.areEqual("1,2,3", [...await readFile(join(folder, "photo.png"))].join(","));
      Assert.areEqual(JSON.stringify(["photo.png", "taken"]), JSON.stringify((await readdir(folder)).sort()));
      Assert.areEqual(JSON.stringify(["photo.png", "photo.png", "photo.png", "photo.png", longestName, "console résumé.txt"].map(t =>
        [window.id, join(folder, t), ["showOverwriteConfirmation"]])),
      JSON.stringify(electron.dialog.saveDialogs.map(t => [t.windowId, t.options.defaultPath, t.options.properties])));
      const lines = process.errors.split("\n").filter(t => t.includes("A file ")).map(t => t.slice(t.indexOf("A file ")));
      Assert.areEqual(22, lines.length);
      Assert.isTrue(lines[0]?.startsWith("A file could not be saved: Error: ") === true, lines.join("\n"));
      Assert.areEqual(JSON.stringify([
        ...Array.from({ length: 20 }, () =>
          "A file was not saved: a window part asked with a name that is not a plain file name, or without bytes or with more than 512 MiB of them."),
        "A file was not saved: the request did not come from the window's own page."
      ]), JSON.stringify(lines.slice(1)));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async startsTheSaveDialogWhereTheSystemLastWasAndLogsWhyWhenTheDownloadsFolderIsNotFound(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const process = new FakeMainProcessEnvironment("linux");
      const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
      const window = MainProcessStartFixture.firstWindow(electron);
      const missing = join(folder, "Downloads");
      const file = join(folder, "Downloads.txt");
      await writeFile(file, "not a folder");
      const defaults: unknown[] = [];

      for (const downloads of [null, missing, file]) {
        electron.app.downloads = downloads;
        const answer = electron.ipcMain.invoke("desktop:saveFile", MainProcessStartFixture.trustedEvent("linux", window.id), "photo.png", new Uint8Array([1]));
        await Condition.waitAsync(() => electron.dialog.saveDialogs.length === defaults.length + 1);
        FileDialogsTests.saveDialog(electron, defaults.length).answer({ canceled: true, filePath: String.empty });
        Assert.areEqual("Cancelled", await answer);
        defaults.push(FileDialogsTests.saveDialog(electron, defaults.length).options.defaultPath);
      }

      Assert.areEqual(JSON.stringify(["photo.png", "photo.png", "photo.png"]), JSON.stringify(defaults));
      const lines = process.errors.split("\n").filter(t => t.includes("The Downloads folder ")).map(t => t.slice(t.indexOf("The Downloads folder ")));
      Assert.areEqual(JSON.stringify([
        "The Downloads folder was not found, so the save dialog starts in the system's last folder: Error: Failed to get 'downloads' path",
        `The Downloads folder was not found, so the save dialog starts in the system's last folder: Error: ENOENT: no such file or directory, stat '${missing}'`,
        `The Downloads folder was not found, so the save dialog starts in the system's last folder: ${file} is not a folder.`
      ]), JSON.stringify(lines));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async keepsTheOldFileAndLeavesNoPartWhenTheNewOneCannotReplaceIt(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const process = new FakeMainProcessEnvironment("linux");
      const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
      const window = MainProcessStartFixture.firstWindow(electron);
      const file = join(folder, "photo.png");
      await writeFile(file, "old");
      using _rename = new FailingFileCallFixture("rename", file, "EIO");

      const answer = electron.ipcMain.invoke("desktop:saveFile", MainProcessStartFixture.trustedEvent("linux", window.id), "photo.png", new Uint8Array([1, 2, 3]));
      await Condition.waitAsync(() => electron.dialog.saveDialogs.length === 1);
      FileDialogsTests.saveDialog(electron, 0).answer({ canceled: false, filePath: file });

      Assert.areEqual("Failed", await answer);
      Assert.areEqual("old", await readFile(file, "utf8"));
      Assert.areEqual(JSON.stringify(["photo.png"]), JSON.stringify(await readdir(folder)));
      Assert.isTrue(process.errors.includes(`A file could not be saved: Error: EIO: operation failed, rename '${file}'`), process.errors);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async showsOneChooserOrSaveDialogAtATimeOnAWindowAndRefusesAnotherMeanwhile(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = MainProcessStartFixture.firstWindow(electron);
    const trusted = MainProcessStartFixture.trustedEvent("linux", window.id);
    const chooser = electron.ipcMain.invoke("desktop:chooseFolder", trusted);
    await Condition.waitAsync(() => electron.dialog.openDialogs.length === 1);

    const whileChoosing = [
      await electron.ipcMain.invoke("desktop:chooseFolder", trusted),
      await electron.ipcMain.invoke("desktop:saveFile", trusted, "photo.png", new Uint8Array([1]))
    ];
    FileDialogsTests.openDialog(electron, 0).answer({ canceled: true, filePaths: [] });
    const chosen = await chooser;
    const save = electron.ipcMain.invoke("desktop:saveFile", trusted, "photo.png", new Uint8Array([1]));
    await Condition.waitAsync(() => electron.dialog.saveDialogs.length === 1);
    const whileSaving = await electron.ipcMain.invoke("desktop:chooseFolder", trusted);
    FileDialogsTests.saveDialog(electron, 0).answer({ canceled: true, filePath: String.empty });

    Assert.areEqual(JSON.stringify([null, "Failed", null, null, "Cancelled"]), JSON.stringify([...whileChoosing, chosen, whileSaving, await save]));
    Assert.areEqual(1, electron.dialog.openDialogs.length);
    Assert.areEqual(1, electron.dialog.saveDialogs.length);
    Assert.areEqual(3, process.errors.split("\n")
      .filter(t => t.includes("A dialog was not shown: the window already shows a file or folder chooser or a save dialog for a window part.")).length);
  }

  @TestMethod
  public async savesNothingWhenTheWindowClosesWhileTheSaveDialogIsOpen(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-main-process-"));
    try {
      const electron = await MainProcessStartFixture.startReadyAsync("linux");
      const window = MainProcessStartFixture.firstWindow(electron);
      const answer = electron.ipcMain.invoke("desktop:saveFile", MainProcessStartFixture.trustedEvent("linux", window.id), "photo.png", new Uint8Array([1]));
      await Condition.waitAsync(() => electron.dialog.saveDialogs.length === 1);

      window.destroy();
      FileDialogsTests.saveDialog(electron, 0).answer({ canceled: false, filePath: join(folder, "photo.png") });

      Assert.areEqual("Cancelled", await answer);
      Assert.isFalse(existsSync(join(folder, "photo.png")));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async answersNoFolderWhenTheWindowClosesWhileTheChooserIsOpen(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");
    const window = MainProcessStartFixture.firstWindow(electron);
    const answer = electron.ipcMain.invoke("desktop:chooseFolder", MainProcessStartFixture.trustedEvent("linux", window.id));
    await Condition.waitAsync(() => electron.dialog.openDialogs.length === 1);

    window.destroy();
    FileDialogsTests.openDialog(electron, 0).answer({ canceled: false, filePaths: ["/home/person/project"] });

    Assert.isNull(await answer);
  }

  @TestMethod
  public async choosesAFileByItsPathWithTheAskedExtensionsAndFolderAndAnswersNothingOnACancelOrAnotherSender(): Promise<void> {
    const electron = await MainProcessStartFixture.startReadyAsync("linux");
    const window = MainProcessStartFixture.firstWindow(electron);
    const choose = async (options: unknown, canceled: boolean, filePaths: string[]): Promise<unknown> => {
      const count = electron.dialog.openDialogs.length;
      const answer = electron.ipcMain.invoke("desktop:chooseFilePath", MainProcessStartFixture.trustedEvent("linux", window.id), options);
      await Condition.waitAsync(() => electron.dialog.openDialogs.length > count);
      electron.dialog.openDialogs.at(count)?.answer({ canceled, filePaths });
      return answer;
    };

    const answers = [
      await choose({}, false, ["/opt/tools/agent"]),
      await choose({ extensions: ["exe", "cmd"], folder: "/opt/tools" }, false, ["/opt/tools/agent.exe"]),
      await choose({}, true, ["/opt/tools/agent"]),
      await choose({}, false, []),
      await electron.ipcMain.invoke("desktop:chooseFilePath", { sender: { id: window.id }, senderFrame: null }, {})
    ];

    Assert.areEqual(JSON.stringify(["/opt/tools/agent", "/opt/tools/agent.exe", null, null, null]), JSON.stringify(answers));
    Assert.areEqual(JSON.stringify([
      [window.id, { properties: ["openFile"] }],
      [window.id, { properties: ["openFile"], filters: [{ name: "*.exe, *.cmd", extensions: ["exe", "cmd"] }], defaultPath: "/opt/tools" }],
      [window.id, { properties: ["openFile"] }],
      [window.id, { properties: ["openFile"] }]
    ]), JSON.stringify(electron.dialog.openDialogs.map(t => [t.windowId, t.options])));
  }

  @TestMethod
  public async refusesAndLogsFilePathOptionsOutsideTheLimitsWithoutAChooser(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const trusted = MainProcessStartFixture.trustedEvent("linux", MainProcessStartFixture.firstWindow(electron).id);

    const answers = await Promise.all([null, { extensions: [".exe"] }, { folder: "tools" }].map(t => electron.ipcMain.invoke("desktop:chooseFilePath", trusted, t)));

    Assert.areEqual(JSON.stringify([null, null, null]), JSON.stringify(answers));
    Assert.areEqual(0, electron.dialog.openDialogs.length);
    Assert.areEqual(3, process.errors.split("\n")
      .filter(t => t.includes("A file chooser was not shown: a window part asked with options that are not 1 to 32 extensions of letters and digits and an absolute starting folder.")).length);
  }

  @TestMethod
  public async showsNoFileChooserWhileAnotherChooserIsOpenAndAnswersNoFileWhenTheWindowCloses(): Promise<void> {
    const process = new FakeMainProcessEnvironment("linux");
    const electron = await MainProcessStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = MainProcessStartFixture.firstWindow(electron);
    const trusted = MainProcessStartFixture.trustedEvent("linux", window.id);
    const folder = electron.ipcMain.invoke("desktop:chooseFolder", trusted);
    await Condition.waitAsync(() => electron.dialog.openDialogs.length === 1);

    const whileChoosing = await electron.ipcMain.invoke("desktop:chooseFilePath", trusted, {});
    electron.dialog.openDialogs.at(0)?.answer({ canceled: true, filePaths: [] });
    await folder;
    const file = electron.ipcMain.invoke("desktop:chooseFilePath", trusted, {});
    await Condition.waitAsync(() => electron.dialog.openDialogs.length === 2);
    window.destroy();
    electron.dialog.openDialogs.at(1)?.answer({ canceled: false, filePaths: ["/opt/tools/agent"] });

    Assert.areEqual(JSON.stringify([null, null]), JSON.stringify([whileChoosing, await file]));
    Assert.areEqual(1, process.errors.split("\n")
      .filter(t => t.includes("A dialog was not shown: the window already shows a file or folder chooser or a save dialog for a window part.")).length);
  }

  @TestMethod
  public grantsTheFilesThePersonPicksOnTheWindowThatAskedForItsCurrentPage(): Promise<void> {
    return FileDialogsTests.runAsync(async t => {
      const file = join(t.folder, "report.pdf");
      await writeFile(file, "a report");

      const one = await FileDialogsTests.chooseAsync(t, { canceled: false, filePaths: [file] }, { lifetime: 60_000 });
      const many = await FileDialogsTests.chooseAsync(t, { canceled: false, filePaths: [file, file] }, { multiple: true });
      const cancelled = await FileDialogsTests.chooseAsync(t, { canceled: true, filePaths: [file] }, {});

      const grants = FileDialogsTests.grants(t.connection);
      const id = t.window.webContents.id;
      Assert.areEqual(`${await realpath(file)}|report.pdf|application/octet-stream|8|notes|${id}|60000|false`,
        [grants[0]?.path, grants[0]?.name, grants[0]?.mediaType, grants[0]?.size, grants[0]?.module, grants[0]?.window, grants[0]?.lifetime, grants[0]?.isStaged].join("|"));
      Assert.areEqual("3|1|600000,600000", `${grants.length}|${new Set(grants.map(g => g.page)).size}|${grants.slice(1).map(g => g.lifetime).join(",")}`);
      Assert.areEqual(JSON.stringify([["openFile"], ["openFile", "multiSelections"], ["openFile"]]), JSON.stringify(t.electron.dialog.openDialogs.map(d => d.options.properties)));
      Assert.areEqual(JSON.stringify([{ grant: grants[0]?.grant, name: "report.pdf", mediaType: "application/octet-stream", size: 8 }]), JSON.stringify(FileDialogsTests.granted(one)));
      Assert.areEqual(2, FileDialogsTests.granted(many).length);
      Assert.areEqual("{\"granted\":[],\"refused\":[]}", JSON.stringify(cancelled));
    });
  }

  @TestMethod
  public stagesAPasteUnderTheDataFolderAndGrantsADropByItsPath(): Promise<void> {
    return FileDialogsTests.runAsync(async t => {
      const file = join(t.folder, "notes.txt");
      await writeFile(file, "notes");

      const answer = await t.electron.ipcMain.invoke("desktop:grantFiles", t.event, "notes", [
        { name: "notes.txt", type: "text/plain", path: file, size: 5 },
        { name: "image.png", type: "image/png", bytes: new Uint8Array([1, 2, 3]), size: 3 }
      ], {}, "first");

      const [dropped, pasted] = FileDialogsTests.grants(t.connection);
      Assert.areEqual(`${await realpath(file)}|false|text/plain`, `${dropped?.path}|${dropped?.isStaged}|${dropped?.mediaType}`);
      Assert.areEqual(`${join(t.folder, "data", "staged", pasted?.grant ?? String.empty)}|true|3`, `${pasted?.path}|${pasted?.isStaged}|${pasted?.size}`);
      Assert.areEqual(pasted?.grant, (await readdir(join(t.folder, "data", "staged"))).join(","));
      Assert.areEqual(2, FileDialogsTests.granted(answer).length);
    });
  }

  @TestMethod
  public grantsNothingToAnUntrustedSenderAnotherPageAModuleItCannotNameOrFilesItCannotRead(): Promise<void> {
    return FileDialogsTests.runAsync(async t => {
      const untrusted = { ...t.event, senderFrame: null };
      const file = { name: "a", type: String.empty, bytes: new Uint8Array([1]), size: 1 };

      const answers = [
        await t.electron.ipcMain.invoke("desktop:chooseFiles", untrusted, "notes", {}, "first"),
        await t.electron.ipcMain.invoke("desktop:chooseFiles", t.event, "notes", {}, "second"),
        await t.electron.ipcMain.invoke("desktop:chooseFiles", t.event, "notes", {}, null),
        await t.electron.ipcMain.invoke("desktop:chooseFiles", t.event, "desktop", {}, "first"),
        await t.electron.ipcMain.invoke("desktop:grantFiles", untrusted, "notes", [file], {}, "first"),
        await t.electron.ipcMain.invoke("desktop:grantFiles", t.event, "notes", [], {}, "first"),
        await t.electron.ipcMain.invoke("desktop:grantFiles", t.event, "notes", "files", {}, "first"),
        await t.electron.ipcMain.invoke("desktop:grantFiles", t.event, "notes", [file, "file"], {}, "first"),
        await t.electron.ipcMain.invoke("desktop:grantFiles", t.event, "notes", Array.from({ length: 257 }, () => file), {}, "first"),
        await t.electron.ipcMain.invoke("desktop:grantFiles", t.event, "notes", [file], { lifetime: 600_001 }, "first")
      ];

      Assert.areEqual(JSON.stringify(Array.from({ length: 10 }, () => null)), JSON.stringify(answers));
      Assert.areEqual(0, t.electron.dialog.openDialogs.length);
      Assert.areEqual(0, FileDialogsTests.grants(t.connection).length);
      Assert.areEqual("4|6", [
        "No file was granted: the request did not come from the window's current page.",
        "No file was granted: a window part asked for a name that is not a module's,"
      ].map(m => FileDialogsTests.count(t.process, m)).join("|"));
    });
  }

  @TestMethod
  public showsOneFileChooserAtATimeAndGrantsNothingWhenItsWindowCloses(): Promise<void> {
    return FileDialogsTests.runAsync(async t => {
      const file = join(t.folder, "report.pdf");
      await writeFile(file, "a report");
      const chooser = t.electron.ipcMain.invoke("desktop:chooseFiles", t.event, "notes", {}, "first");
      await Condition.waitAsync(() => t.electron.dialog.openDialogs.length === 1);

      const whileChoosing = await t.electron.ipcMain.invoke("desktop:chooseFiles", t.event, "notes", {}, "first");
      t.window.destroy();
      const dialog = t.electron.dialog.openDialogs[0];
      Assert.isDefined(dialog, "No file chooser shows.");
      dialog.answer({ canceled: false, filePaths: [file] });

      Assert.areEqual("{\"granted\":[],\"refused\":[]}|{\"granted\":[],\"refused\":[]}", `${JSON.stringify(whileChoosing)}|${JSON.stringify(await chooser)}`);
      Assert.areEqual(0, FileDialogsTests.grants(t.connection).length);
      Assert.areEqual(1, FileDialogsTests.count(t.process, "A dialog was not shown: the window already shows a file or folder chooser or a save dialog for a window part."));
    });
  }

  @TestMethod
  public endsTheGrantsIssuedForAPageThatEndedWhileTheyWereIssued(): Promise<void> {
    return FileDialogsTests.runAsync(async t => {
      const file = join(t.folder, "notes.txt");
      await writeFile(file, "notes");
      let answer: (response: Response) => void = () => undefined;
      t.connection.deferred.set("desktop.grantFile", () => new Promise<Response>(resolve => answer = resolve));

      const granting = t.electron.ipcMain.invoke("desktop:grantFiles", t.event, "notes", [{ name: "notes.txt", type: String.empty, path: file, size: 5 }], {}, "first");
      await Condition.waitAsync(() => t.connection.calls.includes("desktop.grantFile"));
      t.electron.ipcMain.send("desktop:page", t.event, "second");
      answer(Response.success("r", null));

      Assert.areEqual("{\"granted\":[],\"refused\":[]}", JSON.stringify(await granting));
      const page = FileDialogsTests.grants(t.connection)[0]?.page;
      Assert.areEqual(JSON.stringify([{ window: t.window.webContents.id, page }, { window: t.window.webContents.id, page }]),
        JSON.stringify(FileDialogsTests.payloads(t.connection, "desktop.endFileGrants")));
    });
  }

  private static async runAsync(test: (window: IGrantingWindow) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-main-file-grants-"));
    try {
      const connection = new FakeRuntimeConnection();
      connection.answers.set("notes.open", Response.success("r", null));
      const platform = globalThis.process.platform;
      const process = new FakeMainProcessEnvironment(platform, [`--data-dir=${join(folder, "data")}`]);
      const electron = await MainProcessStartFixture.startReadyAsync(platform, new FakeRuntimeLauncher(connection), new FakeElectron(), new FakeDeviceIdentity(), process);
      const window = MainProcessStartFixture.firstWindow(electron);
      const event = MainProcessStartFixture.trustedEvent(platform, window.webContents.id);
      electron.ipcMain.send("desktop:page", event, "first");
      await test({ electron, connection, process, window, event, folder });
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static async chooseAsync(t: IGrantingWindow, answer: { canceled: boolean; filePaths: string[] }, options: object): Promise<unknown> {
    const count = t.electron.dialog.openDialogs.length;
    const chosen = t.electron.ipcMain.invoke("desktop:chooseFiles", t.event, "notes", options, "first");
    await Condition.waitAsync(() => t.electron.dialog.openDialogs.length > count);
    const dialog = t.electron.dialog.openDialogs[count];
    Assert.isDefined(dialog, "No file chooser shows.");
    dialog.answer(answer);
    return chosen;
  }

  private static granted(answer: unknown): JsonObject[] {
    return JsonReader.fromValue(answer).readObjectArray("granted").map(t => t.toJson());
  }

  private static grants(connection: FakeRuntimeConnection): FileGrant[] {
    return FileDialogsTests.payloads(connection, "desktop.grantFile").map(p => FileGrant.fromJson(p));
  }

  private static payloads(connection: FakeRuntimeConnection, method: string): unknown[] {
    return connection.payloads.filter((_, index) => connection.calls[index] === method);
  }

  private static count(process: FakeMainProcessEnvironment, message: string): number {
    return process.errors.split("\n").filter(line => line.includes(message)).length;
  }

  private static openDialog(electron: FakeElectron, index: number): FakeElectron["dialog"]["openDialogs"][number] {
    const shown = electron.dialog.openDialogs[index];
    Assert.isDefined(shown, "The file chooser was not shown.");
    return shown;
  }

  private static saveDialog(electron: FakeElectron, index: number): FakeElectron["dialog"]["saveDialogs"][number] {
    const shown = electron.dialog.saveDialogs[index];
    Assert.isDefined(shown, "The save dialog was not shown.");
    return shown;
  }
}
