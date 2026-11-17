/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { TestBed } from "@angular/core/testing";

import { JsonException, JsonReader, type JsonValue } from "@noldova/context.json";
import { FileGrantsDiscard, KeyChord, QualifiedName, WebViewAction, WebViewNavigationKind, WebViewPane, WindowAction } from "@noldova/desktop.protocol";

import { FileSaveOutcome } from "../../../src/app/enums/file-save-outcome";
import { QuitChoice } from "../../../src/app/enums/quit-choice";
import { UpdateAction } from "../../../src/app/enums/update-action";
import { PreloadBridgeException } from "../../../src/app/exceptions/preload-bridge.exception";
import { RuntimeDisconnectedException } from "../../../src/app/exceptions/runtime-disconnected.exception";
import { RuntimeRequestException } from "../../../src/app/exceptions/runtime-request.exception";
import type { FieldMenuRequest } from "../../../src/app/models/field-menu-request";
import { IssuedFileGrants } from "../../../src/app/models/issued-file-grants";
import type { QuitQuestion } from "../../../src/app/models/quit-question";
import { WindowAppearance } from "../../../src/app/models/window-appearance";
import { PreloadBridgeService } from "../../../src/app/services/preload-bridge.service";
import { FailureFixture } from "../../fixtures/failure.fixture";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

describe("PreloadBridgeService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    PreloadBridgeFixture.remove();
  });

  const complete = {
    platform: "linux",
    processor: "x64",
    notifyReady: (): void => undefined,
    notifyAppearance: (): void => undefined,
    onCloseRequest: (): (() => void) => () => undefined,
    answerClose: (): Promise<boolean> => Promise.resolve(true),
    onUpdateSaveRequest: (): (() => void) => () => undefined,
    answerUpdateSave: (): Promise<boolean> => Promise.resolve(true),
    readStartup: (): Promise<unknown> => Promise.resolve(null),
    onStartup: (): (() => void) => () => undefined,
    actOnStartup: (): Promise<boolean> => Promise.resolve(true),
    readLayout: (): Promise<unknown> => Promise.resolve(null),
    writeLayout: (): Promise<unknown> => Promise.resolve({ payload: null }),
    request: (): Promise<unknown> => Promise.resolve(null),
    onEvent: (): (() => void) => () => undefined,
    readBuild: (): Promise<unknown> => Promise.resolve(null),
    copyText: (): Promise<boolean> => Promise.resolve(true),
    copyImage: (): Promise<boolean> => Promise.resolve(true),
    openLogFolder: (): Promise<boolean> => Promise.resolve(true),
    copyDetails: (): Promise<boolean> => Promise.resolve(true),
    openLink: (): Promise<boolean> => Promise.resolve(true),
    showInFolder: (): Promise<unknown> => Promise.resolve(null),
    openFile: (): Promise<unknown> => Promise.resolve(null),
    chooseFolder: (): Promise<unknown> => Promise.resolve(null),
    chooseFilePath: (): Promise<unknown> => Promise.resolve(null),
    saveFile: (): Promise<unknown> => Promise.resolve("Saved"),
    chooseFiles: (): Promise<unknown> => Promise.resolve(null),
    grantFiles: (): Promise<unknown> => Promise.resolve(null),
    installCommand: (): Promise<boolean> => Promise.resolve(true),
    readUpdate: (): Promise<unknown> => Promise.resolve(null),
    onUpdate: (): (() => void) => () => undefined,
    actOnUpdate: (): Promise<boolean> => Promise.resolve(true),
    keepAppearance: (): void => undefined,
    readSpelling: (): Promise<unknown> => Promise.resolve(null),
    keepSpelling: (): void => undefined,
    onFieldMenu: (): (() => void) => () => undefined,
    replaceMisspelling: (): Promise<boolean> => Promise.resolve(true),
    addToDictionary: (): Promise<boolean> => Promise.resolve(true),
    onNotificationOpened: (): (() => void) => () => undefined,
    onQuitQuestion: (): (() => void) => () => undefined,
    answerQuit: (): Promise<boolean> => Promise.resolve(true),
    readTrayAvailable: (): Promise<unknown> => Promise.resolve(true),
    onTrayAvailable: (): (() => void) => () => undefined,
    readFullScreen: (): Promise<unknown> => Promise.resolve(false),
    onFullScreen: (): (() => void) => () => undefined,
    readMaximized: (): Promise<unknown> => Promise.resolve(false),
    onMaximized: (): (() => void) => () => undefined,
    actOnWindow: (): Promise<unknown> => Promise.resolve(true),
    openWebView: (): Promise<unknown> => Promise.resolve(null),
    attachWebView: (): Promise<unknown> => Promise.resolve(null),
    navigateWebView: (): Promise<unknown> => Promise.resolve(null),
    actOnWebView: (): Promise<unknown> => Promise.resolve(null),
    zoomWebView: (): Promise<unknown> => Promise.resolve(null),
    findInWebView: (): Promise<unknown> => Promise.resolve(null),
    closeWebView: (): void => undefined,
    keepWebViews: (): unknown => true,
    expectWebView: (): unknown => true,
    setWebViewShortcuts: (): void => undefined,
    setAppShortcuts: (): void => undefined,
    onWebViewEvent: (): (() => void) => () => undefined,
    onWebViewShortcut: (): (() => void) => () => undefined,
    answerWebViewShortcut: (): void => undefined,
    onWebViewInput: (): (() => void) => () => undefined,
    releaseWebViewFocus: (): void => undefined,
    logModule: (): void => undefined,
    logError: (): void => undefined
  };
  const incomplete: readonly [string, unknown][] = [
    ["nothing", undefined],
    ["a value that is not an object", "noldova-desktop"],
    ["no platform", { ...complete, platform: 1 }],
    ["no processor", { ...complete, processor: null }],
    ["no notifyReady", { ...complete, notifyReady: null }],
    ["no notifyAppearance", { ...complete, notifyAppearance: null }],
    ["no onCloseRequest", { ...complete, onCloseRequest: null }],
    ["no answerClose", { ...complete, answerClose: null }],
    ["no onUpdateSaveRequest", { ...complete, onUpdateSaveRequest: null }],
    ["no answerUpdateSave", { ...complete, answerUpdateSave: null }],
    ["no readStartup", { ...complete, readStartup: null }],
    ["no onStartup", { ...complete, onStartup: null }],
    ["no actOnStartup", { ...complete, actOnStartup: null }],
    ["no readLayout", { ...complete, readLayout: null }],
    ["no writeLayout", { ...complete, writeLayout: null }],
    ["no request", { ...complete, request: null }],
    ["no onEvent", { ...complete, onEvent: null }],
    ["no readBuild", { ...complete, readBuild: null }],
    ["no copyText", { ...complete, copyText: null }],
    ["no copyImage", { ...complete, copyImage: null }],
    ["no openLogFolder", { ...complete, openLogFolder: null }],
    ["no copyDetails", { ...complete, copyDetails: null }],
    ["no openLink", { ...complete, openLink: null }],
    ["no showInFolder", { ...complete, showInFolder: null }],
    ["no openFile", { ...complete, openFile: null }],
    ["no chooseFolder", { ...complete, chooseFolder: null }],
    ["no chooseFilePath", { ...complete, chooseFilePath: null }],
    ["no saveFile", { ...complete, saveFile: null }],
    ["no chooseFiles", { ...complete, chooseFiles: null }],
    ["no grantFiles", { ...complete, grantFiles: null }],
    ["no installCommand", { ...complete, installCommand: null }],
    ["no readUpdate", { ...complete, readUpdate: null }],
    ["no onUpdate", { ...complete, onUpdate: null }],
    ["no actOnUpdate", { ...complete, actOnUpdate: null }],
    ["no keepAppearance", { ...complete, keepAppearance: null }],
    ["no readSpelling", { ...complete, readSpelling: null }],
    ["no keepSpelling", { ...complete, keepSpelling: null }],
    ["no onFieldMenu", { ...complete, onFieldMenu: null }],
    ["no replaceMisspelling", { ...complete, replaceMisspelling: null }],
    ["no addToDictionary", { ...complete, addToDictionary: null }],
    ["no onNotificationOpened", { ...complete, onNotificationOpened: null }],
    ["no onQuitQuestion", { ...complete, onQuitQuestion: null }],
    ["no answerQuit", { ...complete, answerQuit: null }],
    ["no readTrayAvailable", { ...complete, readTrayAvailable: null }],
    ["no onTrayAvailable", { ...complete, onTrayAvailable: null }],
    ["no readFullScreen", { ...complete, readFullScreen: null }],
    ["no onFullScreen", { ...complete, onFullScreen: null }],
    ["no readMaximized", { ...complete, readMaximized: null }],
    ["no onMaximized", { ...complete, onMaximized: null }],
    ["no actOnWindow", { ...complete, actOnWindow: null }],
    ["no openWebView", { ...complete, openWebView: null }],
    ["no attachWebView", { ...complete, attachWebView: null }],
    ["no navigateWebView", { ...complete, navigateWebView: null }],
    ["no actOnWebView", { ...complete, actOnWebView: null }],
    ["no zoomWebView", { ...complete, zoomWebView: null }],
    ["no findInWebView", { ...complete, findInWebView: null }],
    ["no closeWebView", { ...complete, closeWebView: null }],
    ["no keepWebViews", { ...complete, keepWebViews: null }],
    ["no expectWebView", { ...complete, expectWebView: null }],
    ["no setWebViewShortcuts", { ...complete, setWebViewShortcuts: null }],
    ["no setAppShortcuts", { ...complete, setAppShortcuts: null }],
    ["no onWebViewEvent", { ...complete, onWebViewEvent: null }],
    ["no onWebViewShortcut", { ...complete, onWebViewShortcut: null }],
    ["no answerWebViewShortcut", { ...complete, answerWebViewShortcut: null }],
    ["no onWebViewInput", { ...complete, onWebViewInput: null }],
    ["no releaseWebViewFocus", { ...complete, releaseWebViewFocus: null }],
    ["no logModule", { ...complete, logModule: null }],
    ["no logError", { ...complete, logError: null }],
    ["no logError member at all", Object.fromEntries(Object.entries(complete).filter(([t]) => t !== "logError"))]
  ];

  for (const [name, value] of incomplete)
    it(`refuses a bridge with ${name}`, () => {
      PreloadBridgeFixture.installValue(value);

      expect(() => TestBed.inject(PreloadBridgeService)).toThrowError(PreloadBridgeException);
    });

  it("accepts a complete bridge", () => {
    PreloadBridgeFixture.installValue(complete);

    expect(TestBed.inject(PreloadBridgeService).isMac).toBe(false);
  });

  it("knows when it runs on macOS", () => {
    PreloadBridgeFixture.install("darwin");

    expect(TestBed.inject(PreloadBridgeService).isMac).toBe(true);
  });

  it("reports the appearance as JSON", () => {
    const bridge = PreloadBridgeFixture.install();

    TestBed.inject(PreloadBridgeService).notifyReady(new WindowAppearance("rgb(1, 2, 3)", "rgb(4, 5, 6)", "rgb(7, 8, 9)", 35));

    expect(bridge.appearances).toEqual([{ background: "rgb(1, 2, 3)", titleBar: "rgb(4, 5, 6)", titleBarText: "rgb(7, 8, 9)", titleBarHeight: 35 }]);
  });

  it("reports a change of the appearance as JSON, apart from the first report", () => {
    const bridge = PreloadBridgeFixture.install();

    TestBed.inject(PreloadBridgeService).notifyAppearance(new WindowAppearance("rgb(1, 2, 3)", "rgb(4, 5, 6)", "rgb(7, 8, 9)", 35));

    expect(bridge.changes).toEqual([{ background: "rgb(1, 2, 3)", titleBar: "rgb(4, 5, 6)", titleBarText: "rgb(7, 8, 9)", titleBarHeight: 35 }]);
    expect(bridge.appearances).toEqual([]);
  });

  it("passes close requests on until unsubscribed and answers them", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    const requests: string[] = [];

    const unsubscribe = service.onCloseRequest(t => requests.push(t));
    bridge.requestClose("first");
    unsubscribe();
    bridge.requestClose("second");

    expect(requests).toEqual(["first"]);
    expect(await service.answerCloseAsync("first", false)).toBe(true);
    expect(bridge.answers).toEqual(["first:false"]);
  });

  it("passes an update's save requests on until unsubscribed and answers them with what did not save", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    const requests: string[] = [];

    const unsubscribe = service.onUpdateSaveRequest(t => requests.push(t));
    bridge.requestUpdateSave("first");
    unsubscribe();
    bridge.requestUpdateSave("second");

    expect(requests).toEqual(["first"]);
    expect(await service.answerUpdateSaveAsync("first", ["Notes couldn't save"])).toBe(true);
    expect(bridge.updateSaveAnswers).toEqual(["first:Notes couldn't save"]);
  });

  it("reads and follows the startup state until unsubscribed, and passes the person's choice on", async () => {
    const bridge = PreloadBridgeFixture.install();
    bridge.startup = { kind: "PreShellData", details: ["/data/old"] };
    const service = TestBed.inject(PreloadBridgeService);
    const states: string[] = [];

    const initial = await service.readStartupAsync();
    const unsubscribe = service.onStartup(t => states.push(t.kind));
    bridge.publishStartup({ kind: "Connecting", details: [] });
    unsubscribe();
    bridge.publishStartup({ kind: "Ready", details: [] });

    expect([initial.kind, initial.details]).toEqual(["PreShellData", ["/data/old"]]);
    expect(states).toEqual(["Connecting"]);
    expect(await service.actOnStartupAsync("moveAside")).toBe(true);
    expect(bridge.actions).toEqual(["moveAside"]);
  });

  it("keeps the window's layout through the main process and reads none before it is kept", async () => {
    PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);

    const before = await service.readLayoutAsync();
    await service.writeLayoutAsync({ version: 1 });

    expect(before).toBeNull();
    expect(await service.readLayoutAsync()).toEqual({ version: 1 });
  });

  it("rejects a layout the main process could not read or write with the runtime's failure", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    vi.spyOn(bridge, "readLayout").mockResolvedValue({ failure: { code: "Disconnected", message: "Noldova Desktop Sample is not connected to its runtime." } });
    vi.spyOn(bridge, "writeLayout").mockResolvedValue({ failure: { code: "Unavailable", message: "The runtime did not answer desktop.writeLayout in time." } });

    await expect(service.readLayoutAsync()).rejects.toThrow(new RuntimeDisconnectedException("Noldova Desktop Sample is not connected to its runtime."));
    await expect(service.writeLayoutAsync({ version: 1 })).rejects.toThrow(new RuntimeRequestException("Unavailable", "The runtime did not answer desktop.writeLayout in time."));
  });

  it("passes a request on and resolves the runtime's payload", async () => {
    const bridge = PreloadBridgeFixture.install();
    bridge.answer = { payload: { title: "Notes" } };

    const payload = await TestBed.inject(PreloadBridgeService).requestAsync("notes.open", { path: "/notes/a.md" });

    expect(payload).toEqual({ title: "Notes" });
    expect(bridge.requests).toEqual([["notes.open", { path: "/notes/a.md" }]]);
  });

  it("rejects a failed request with the failure's code, message and details, and one whose connection ended as disconnected", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    bridge.answer = { failure: { code: "NotFound", message: "There is no such note.", details: { path: "/notes/a.md" } } };

    const failure = await service.requestAsync("notes.open", null).catch((error: unknown) => error);
    bridge.answer = { failure: { code: "Unavailable", message: "The runtime did not answer notes.open in time." } };
    const bare = await service.requestAsync("notes.open", null).catch((error: unknown) => error);
    bridge.answer = { failure: { code: "Disconnected", message: "Noldova Desktop Sample is not connected to its runtime." } };
    const disconnected = await service.requestAsync("notes.open", null).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RuntimeRequestException);
    expect([FailureFixture.of(failure, RuntimeRequestException).code, FailureFixture.of(failure, RuntimeRequestException).message, FailureFixture.of(failure, RuntimeRequestException).details])
      .toEqual(["NotFound", "There is no such note.", { path: "/notes/a.md" }]);
    expect([FailureFixture.of(bare, RuntimeRequestException).code, FailureFixture.of(bare, RuntimeRequestException).details]).toEqual(["Unavailable", undefined]);
    expect(bare).not.toBeInstanceOf(RuntimeDisconnectedException);
    expect(disconnected).toBeInstanceOf(RuntimeDisconnectedException);
  });

  it("refuses an answer that is not a JSON object", async () => {
    const bridge = PreloadBridgeFixture.install();
    bridge.answer = "payload";

    await expect(TestBed.inject(PreloadBridgeService).requestAsync("notes.open", null)).rejects.toThrow(JsonException);
  });

  it("passes the runtime's events on until unsubscribed", () => {
    const bridge = PreloadBridgeFixture.install();
    const events: [string, unknown][] = [];

    const unsubscribe = TestBed.inject(PreloadBridgeService).onEvent((name, payload) => events.push([name, payload]));
    bridge.publishEvent("notes.changed", { path: "/notes/a.md" });
    unsubscribe();
    bridge.publishEvent("notes.changed", null);

    expect(events).toEqual([["notes.changed", { path: "/notes/a.md" }]]);
  });

  it("listens to the preload once, converts each event once however many listen, and calls only the listeners of its name", () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    const conversions = vi.spyOn(JsonReader, "toJsonValue");
    const heard: unknown[] = [];
    const record = (listener: string): ((payload: JsonValue) => number) => t => heard.push([listener, t]);
    const stops = [
      service.onEvent((name, payload) => heard.push(["every", name, payload])),
      service.onEvent((name, payload) => heard.push(["every again", name, payload])),
      service.onNamedEvent("notes.changed", record("notes")),
      service.onNamedEvent("notes.changed", record("notes again")),
      service.onNamedEvent("tasks.changed", record("tasks"))
    ];
    const listening = bridge.eventListenerCount;

    bridge.publishEvent("notes.changed", { id: 1 });
    const converted = conversions.mock.calls.length;
    for (const stop of stops)
      stop();
    bridge.publishEvent("notes.changed", { id: 2 });
    conversions.mockRestore();

    expect([listening, converted, bridge.eventListenerCount]).toEqual([1, 1, 0]);
    expect(heard).toEqual([
      ["every", "notes.changed", { id: 1 }],
      ["every again", "notes.changed", { id: 1 }],
      ["notes", { id: 1 }],
      ["notes again", { id: 1 }]
    ]);
  });

  it("converts no event only listeners of other names wait for, and listens to the preload again once a listener comes after every one stopped", () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    const conversions = vi.spyOn(JsonReader, "toJsonValue");
    const heard: JsonValue[] = [];

    const stopFirst = service.onNamedEvent("tasks.changed", t => heard.push(t));
    bridge.publishEvent("notes.changed", 1);
    const convertedForOthers = conversions.mock.calls.length;
    stopFirst();
    stopFirst();
    const listeningAfterStop = bridge.eventListenerCount;
    const stopSecond = service.onNamedEvent("tasks.changed", t => heard.push(t));
    stopFirst();
    bridge.publishEvent("tasks.changed", 2);
    stopSecond();
    conversions.mockRestore();

    expect([convertedForOthers, listeningAfterStop, bridge.eventListenerCount]).toEqual([0, 0, 0]);
    expect(heard).toEqual([2]);
  });

  it("asks the main process to show a file in its folder, and gives its refusal, or a refusal of its own for an answer that is neither", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);

    const answers = [await service.showInFolderAsync("/home/ada/report.pdf")];
    bridge.showRefusal = "the path isn't absolute.";
    answers.push(await service.showInFolderAsync("report.pdf"));
    bridge.showRefusal = true;
    answers.push(await service.showInFolderAsync("/home/ada"));

    expect(answers).toEqual([null, "the path isn't absolute.", "the main process gave no reason."]);
    expect(bridge.shownFiles).toEqual(["/home/ada/report.pdf", "report.pdf", "/home/ada"]);
  });

  it("asks the main process to open a file in its default app, and gives its refusal, or a refusal of its own for an answer that is neither", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);

    const answers = [await service.openFileAsync("/home/ada/notes.md")];
    bridge.openRefusal = "the file is marked executable, so it never opens.";
    answers.push(await service.openFileAsync("/home/ada/notes.txt"));
    bridge.openRefusal = true;
    answers.push(await service.openFileAsync("/home/ada/run.sh"));

    expect(answers).toEqual([null, "the file is marked executable, so it never opens.", "the main process gave no reason."]);
    expect(bridge.openedFiles).toEqual(["/home/ada/notes.md", "/home/ada/notes.txt", "/home/ada/run.sh"]);
  });

  it("reads the build, copies text, opens the log folder and links, and installs the command through the main process", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);

    const build = await service.readBuildAsync();
    const isCopied = await service.writeTextAsync("clock: Failed");
    const isOpened = await service.openLogFolderAsync();
    const isLinkOpened = await service.openLinkAsync("https://example.com/");
    bridge.isLinkOpened = false;
    const isRefusedLinkOpened = await service.openLinkAsync("file:///etc/passwd");
    const isInstalled = await service.installCommandAsync();

    expect([build.productVersion, build.fingerprint, isCopied, isOpened, isLinkOpened, isRefusedLinkOpened, isInstalled]).toEqual(["1.2.3", "abc123", true, true, true, false, true]);
    expect([bridge.copied, bridge.logFolderOpens, bridge.links, bridge.commandInstalls]).toEqual([["clock: Failed"], 1, ["https://example.com/", "file:///etc/passwd"], 1]);
  });

  it("copies details through the main process, apart from plain text", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);

    const isCopied = await service.copyDetailsAsync("Platform: win32 x64");
    bridge.isCopyAccepted = false;
    const isRefused = await service.copyDetailsAsync("Platform: linux x64");

    expect([isCopied, isRefused, bridge.copiedDetails, bridge.copied]).toEqual([true, false, ["Platform: win32 x64"], []]);
  });

  it("asks the main process for a folder, and answers null for a cancel or a reply that is not a path", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);

    bridge.folder = "/home/person/project";
    const chosen = await service.chooseFolderAsync();
    bridge.folder = null;
    const cancelled = await service.chooseFolderAsync();
    bridge.folder = 5;
    const invalid = await service.chooseFolderAsync();

    expect([chosen, cancelled, invalid, bridge.folderChoices]).toEqual(["/home/person/project", null, null, 3]);
  });

  it("asks the main process for a file's path with only the options given, and answers null for a cancel or a reply that is not a path", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);

    bridge.filePath = "/opt/tools/agent.exe";
    const chosen = await service.chooseFilePathAsync({ extensions: ["exe"], folder: "/opt/tools" });
    bridge.filePath = null;
    const cancelled = await service.chooseFilePathAsync({ extensions: ["exe"] });
    bridge.filePath = 5;
    const invalid = await service.chooseFilePathAsync({});

    expect([chosen, cancelled, invalid]).toEqual(["/opt/tools/agent.exe", null, null]);
    expect(bridge.filePathChoices).toEqual([{ extensions: ["exe"], folder: "/opt/tools" }, { extensions: ["exe"] }, {}]);
  });

  it("asks the main process to grant the files the person picks or offers, with only the options given, and reads no answer as none", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    const file = new File(["notes"], "notes.txt", { type: "text/plain" });

    bridge.fileGrants = { granted: [{ grant: "a".repeat(32), name: "report.pdf", mediaType: "application/pdf", size: 1204 }], refused: ["pipe was not given to the module: it is not a regular file."] };
    const chosen = await service.chooseFilesAsync("notes", { lifetime: 60_000, multiple: true });
    const offered = await service.grantFilesAsync("notes", [file], {});
    bridge.fileGrants = null;
    const refused = await service.chooseFilesAsync("notes", {});

    expect([chosen.files.map(t => `${t.grant[0]} ${t.name} ${t.mediaType} ${t.size}`), chosen.refused, offered.files.length, refused]).toEqual([
      ["a report.pdf application/pdf 1204"], ["pipe was not given to the module: it is not a regular file."], 1, IssuedFileGrants.none
    ]);
    expect(bridge.fileRequests).toEqual([
      ["chooseFiles", "notes", { lifetime: 60_000, multiple: true }],
      ["grantFiles", "notes", ["notes.txt"], {}],
      ["chooseFiles", "notes", {}]
    ]);
  });

  it("discards file grants through the runtime, at most 256 in one request, and sends nothing for none", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    const grants = Array.from({ length: 257 }, (_, t) => t.toString(16).padStart(32, "0"));

    await service.discardFileGrantsAsync(grants);
    await service.discardFileGrantsAsync([]);

    expect(bridge.requests.map(([method, payload]) => `${method} ${FileGrantsDiscard.fromJson(payload).grants.length}`)).toEqual([
      "desktop.discardFileGrants 256", "desktop.discardFileGrants 1"
    ]);
  });

  it("asks the main process to save a file and reads its outcome, taking a reply it does not know as a failure", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);

    const outcomes: FileSaveOutcome[] = [];
    for (const reply of ["Saved", "Cancelled", "Failed", "Written", null]) {
      bridge.saveOutcome = reply;
      outcomes.push(await service.saveFileAsync("photo.png", new Uint8Array([1, 2])));
    }

    expect(outcomes).toEqual([FileSaveOutcome.Saved, FileSaveOutcome.Cancelled, FileSaveOutcome.Failed, FileSaveOutcome.Failed, FileSaveOutcome.Failed]);
    expect(bridge.saves).toEqual(Array.from({ length: 5 }, () => ["photo.png", [1, 2]]));
  });

  it("copies a PNG image through the main process, draws a GIF as PNG first, and sends nothing for bytes it refuses", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0, 0, 0, 0];
    const gif = Uint8Array.from(atob("R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="), t => t.charCodeAt(0));

    const copied = await service.writeImageAsync(new Uint8Array(png));
    const drawn = await service.writeImageAsync(gif);
    const refused = await service.writeImageAsync(new TextEncoder().encode("not an image"));
    bridge.isImageCopyAccepted = false;
    const refusedByMain = await service.writeImageAsync(new Uint8Array(png));

    expect([copied, drawn, refused, refusedByMain]).toEqual([true, true, false, false]);
    expect(bridge.copiedImages.map(t => t.slice(0, 8))).toEqual([png.slice(0, 8), png.slice(0, 8)]);
    expect(bridge.copiedImages[0]).toEqual(png);
  });

  it("refuses a second image while one is being copied, and copies again once it is done", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0, 0, 0, 0]);
    let release = (): void => undefined;
    bridge.imageCopyHold = new Promise<void>(resolve => release = resolve);

    const first = service.writeImageAsync(png);
    await vi.waitFor(() => expect(bridge.copiedImages.length).toBe(1));
    const second = await service.writeImageAsync(png);
    release();
    const answers = [await first, second, await service.writeImageAsync(png)];

    expect(answers).toEqual([true, false, true]);
    expect(bridge.copiedImages.length).toBe(2);
  });

  it("reads the update's state, follows its changes and acts on it through the main process, and names the processor", async () => {
    const bridge = PreloadBridgeFixture.install();
    bridge.processor = "arm64";
    bridge.update = { kind: "Ready", version: "1.3.0", progress: null, checkedAt: null, reason: null, mustMove: false };
    const service = TestBed.inject(PreloadBridgeService);
    const states: string[] = [];

    const state = await service.readUpdateAsync();
    const stop = service.onUpdate(t => states.push(t.kind));
    bridge.publishUpdate({ kind: "Checking", version: null, progress: null, checkedAt: null, reason: null, mustMove: false });
    stop();
    bridge.publishUpdate({ kind: "UpToDate", version: null, progress: null, checkedAt: null, reason: null, mustMove: false });
    const isDone = await service.actOnUpdateAsync(UpdateAction.Restart);

    expect([state.kind, state.version, states, isDone, bridge.updateActions, service.processor]).toEqual(["Ready", "1.3.0", ["Checking"], true, ["Restart"], "arm64"]);
  });

  it("passes on the id of a notification opened from the operating system and ignores a blank one", () => {
    const bridge = PreloadBridgeFixture.install();
    const opened: string[] = [];

    const stop = TestBed.inject(PreloadBridgeService).onNotificationOpened(t => opened.push(t));
    bridge.publishNotificationOpened("n2");
    bridge.publishNotificationOpened(" ");
    stop();
    bridge.publishNotificationOpened("n3");

    expect(opened).toEqual(["n2"]);
  });

  it("passes on the device's last appearance and keeps the window's", () => {
    const bridge = PreloadBridgeFixture.install();
    bridge.appearance = { "desktop.mode": "Dark" };
    const service = TestBed.inject(PreloadBridgeService);

    service.keepAppearance({ "desktop.mode": "Light" });

    expect(service.initialAppearance).toEqual({ "desktop.mode": "Dark" });
    expect(bridge.keptAppearances).toEqual([{ "desktop.mode": "Light" }]);
  });

  it("reads the spelling languages the main process offers and keeps the window's spelling preferences", async () => {
    const bridge = PreloadBridgeFixture.install();
    bridge.spelling = Promise.resolve({ languages: ["en-US"], fallback: "en-US" });
    const service = TestBed.inject(PreloadBridgeService);

    const offer = await service.readSpellingAsync();
    service.keepSpelling(true, ["en-US"]);

    expect([offer.languages, offer.fallback]).toEqual([["en-US"], "en-US"]);
    expect(bridge.keptSpellings).toEqual([[true, ["en-US"]]]);
  });

  it("passes on the main process's field menus as requests, and replaces or adds a word through the main process", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    const requests: FieldMenuRequest[] = [];

    const stop = service.onFieldMenu(t => requests.push(t));
    bridge.publishFieldMenu({ x: 10, y: 20, isKeyboard: false, word: "wrold", suggestions: ["world"] });
    stop();
    bridge.publishFieldMenu({ x: 1, y: 2, isKeyboard: true, word: String.empty, suggestions: [] });
    const answers = [await service.replaceMisspellingAsync("world"), await service.addToDictionaryAsync("Noldova Desktop Sample")];

    expect(requests.map(t => [t.x, t.y, t.isKeyboard, t.toContext()])).toEqual([[10, 20, false, { word: "wrold", suggestions: ["world"] }]]);
    expect(answers).toEqual([true, true]);
    expect([bridge.replacements, bridge.addedWords]).toEqual([["world"], ["Noldova Desktop Sample"]]);
  });

  it("passes on the question about work in progress or its end, answers it and writes a module's log lines through the main process", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    const questions: (QuitQuestion | null)[] = [];

    const stop = service.onQuitQuestion(t => questions.push(t));
    bridge.askToQuit({ descriptions: ["Indexing the project"], isWaiting: true, isUpdate: false });
    bridge.askToQuit(null);
    stop();
    bridge.askToQuit(null);
    const isTaken = await service.answerQuitAsync(QuitChoice.Wait);
    service.logModule("clock", "Ticked");
    service.logError("clock", "Error: It broke.");

    expect(questions.map(t => Object.isNull(t) ? null : [t.descriptions, t.isWaiting])).toEqual([[["Indexing the project"], true], null]);
    expect([isTaken, bridge.quitAnswers, bridge.logged, bridge.errorsLogged]).toEqual([true, ["Wait"], ["clock: Ticked"], [["clock", "Error: It broke."]]]);
  });

  it("opens, attaches and drives web views through the main process, reading only its answers' and events' wire forms", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    const pane = new WebViewPane(QualifiedName.parse("notes.note"), "plan");
    const events: string[] = [];

    const opened = await service.openWebViewAsync("notes", pane, "workspace-1");
    bridge.openedViewKeys = ["Mod+L", "F6"];
    const withKeys = await service.openWebViewAsync("notes", pane, "workspace-1");
    bridge.openedViewKeys = undefined;
    bridge.webViewPartition = "";
    const blank = await service.openWebViewAsync("notes", pane, "workspace-1");
    bridge.webViewPartition = 7;
    const notText = await service.openWebViewAsync("notes", pane, "workspace-1").catch((error: unknown) => error);
    bridge.isWebViewOpened = false;
    const refused = await service.openWebViewAsync("notes", pane, "workspace-1");
    const opens = bridge.webViewCalls.splice(0);
    const attached: boolean[] = [];
    for (const answer of [{ isAttached: true }, { isAttached: false }, { isAttached: "yes" }, {}, null]) {
      bridge.webViewAttached = Promise.resolve(answer);
      attached.push(await service.attachWebViewAsync("notes", "1", 7));
    }
    const navigation = await service.navigateWebViewAsync("notes", "1", "https://example.com/");
    bridge.webViewAnswer = null;
    const unknown = await Promise.all([service.actOnWebViewAsync("notes", "1", WebViewAction.Back), service.navigateWebViewAsync("notes", "1", "https://example.org/")]);
    service.setWebViewShortcuts([KeyChord.parse("Mod+K"), KeyChord.parse("Mod+Shift+P")]);
    const stop = service.onWebViewEvent(t => events.push(`${t.view} ${t.kind}`));
    bridge.publishWebViewEvent({ module: "notes", view: "1", kind: "Crashed" });
    bridge.publishWebViewEvent({ module: "notes", view: "1", kind: "Exploded" });
    stop();
    bridge.publishWebViewEvent({ module: "notes", view: "1", kind: "Closed" });

    expect([opened?.view.id, opened?.view.module, opened?.view.pane.equals(pane), opened?.view.profileKey, opened?.partition]).toEqual(["1", "notes", true, "workspace-1", "persist:notes.workspace-1"]);
    expect([opened?.keys, withKeys?.keys.map(t => t.text)]).toEqual([[], ["Mod+L", "F6"]]);
    expect([blank, notText instanceof Error, refused]).toEqual([null, true, null]);
    expect(opens.filter(t => !t.startsWith("open"))).toEqual(["close notes 3"]);
    expect(attached).toEqual([true, false, false, false, false]);
    expect([navigation?.kind, ...unknown]).toEqual([WebViewNavigationKind.Started, null, null]);
    expect(bridge.webViewKeys).toEqual([["Mod+K", "Mod+Shift+P"]]);
    expect(events).toEqual(["1 Crashed"]);
    expect(bridge.webViewCalls).toEqual([...Array.from({ length: 5 }, () => "attach notes 1 7"),
      "navigate notes 1 https://example.com/", "act notes 1 Back", "navigate notes 1 https://example.org/"]);
  });

  it("zooms and finds in a web view through the main process, reading only a finite factor, whole counts and a timed-out search", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    const zoom = async (answer: unknown): Promise<number | null> => {
      bridge.webViewZoom = answer;
      return service.zoomWebViewAsync("notes", "1", "in");
    };
    const find = async (answer: unknown): Promise<unknown> => {
      bridge.webViewFound = Promise.resolve(answer);
      return service.findInWebViewAsync("notes", "1", { text: "plan", matchCase: true });
    };

    const factors = [await zoom(1.25), await zoom(Number.NaN), await zoom("1"), await zoom(null)];
    const found = [await find({ matches: 3, active: 2 }), await find(null), await find([3, 2]), await find({ matches: 1.5, active: 0 }), await find({ matches: 3, active: "2" }), await find({ isTimedOut: true }), await find({ matches: 3, active: 2, isTimedOut: false }), await find({ isTimedOut: false }), await find({ isTimedOut: "yes" }), await find({ isEnded: true }), await find({ matches: 3, active: 2, isEnded: false }), await find({ isEnded: false }), await find({ isEnded: "yes" })];
    await service.findInWebViewAsync("notes", "1", "next");

    expect(factors).toEqual([1.25, null, null, null]);
    expect(found).toEqual([{ matches: 3, active: 2, isTimedOut: false, isEnded: false }, null, null, null, null, { matches: 0, active: 0, isTimedOut: true, isEnded: false }, { matches: 3, active: 2, isTimedOut: false, isEnded: false }, null, null, { matches: 0, active: 0, isTimedOut: false, isEnded: true }, { matches: 3, active: 2, isTimedOut: false, isEnded: false }, null, null]);
    expect(bridge.webViewCalls.slice(0, 2)).toEqual(["zoom notes 1 in", "zoom notes 1 in"]);
    expect(bridge.webViewCalls.slice(4, 5)).toEqual(["find notes 1 {\"text\":\"plan\",\"matchCase\":true}"]);
    expect(bridge.webViewCalls.at(-1)).toBe("find notes 1 \"next\"");
  });

  it("gives the main process the window's keys with their commands as an app shortcut list", () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);

    service.setAppShortcuts([[KeyChord.parse("Mod+B"), "desktop.toggleLeftDock"], [KeyChord.parse("F6"), "notes.newNote"]]);

    expect(bridge.appShortcuts).toEqual([{ shortcuts: [
      { key: "Mod+B", command: "desktop.toggleLeftDock", isGlobal: false },
      { key: "F6", command: "notes.newNote", isGlobal: false }
    ] }]);
  });

  it("passes on a shortcut pressed in a web view as a cancelable key press and answers each one, declined for one that isn't a whole key stroke", () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    const presses: string[] = [];
    const stroke = { key: "k", code: "KeyK", ctrlKey: true, altKey: false, shiftKey: true, metaKey: false, press: 1 };

    const stop = service.onWebViewShortcut(t => presses.push(`${t.type} ${t.key} ${t.code} ${t.ctrlKey} ${t.altKey} ${t.shiftKey} ${t.metaKey} ${t.cancelable}`) > 0);
    bridge.publishWebViewShortcut(stroke);
    for (const value of [null, "k", { ...stroke, key: 1, press: 2 }, { ...stroke, code: null, press: 3 }, { ...stroke, ctrlKey: 1, press: 4 }, { ...stroke, altKey: null, press: 5 },
      { ...stroke, shiftKey: "yes", press: 6 }, { ...stroke, metaKey: "no", press: 7 }])
      bridge.publishWebViewShortcut(value);
    stop();
    bridge.publishWebViewShortcut(stroke);

    expect(presses).toEqual(["keydown k KeyK true false true false true"]);
    expect(bridge.shortcutAnswers).toEqual([[1, true], [null, false], [null, false], [2, false], [3, false], [4, false], [5, false], [6, false], [7, false]]);
  });

  it("answers a web view's shortcut as declined when the window doesn't run it, or when running it throws", () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    const stroke = { key: "t", code: "KeyT", ctrlKey: true, altKey: false, shiftKey: false, metaKey: false };
    const fault = new TypeError("A bug in the command.");
    let thrown: unknown = null;

    const stopDeclining = service.onWebViewShortcut(() => false);
    bridge.publishWebViewShortcut({ ...stroke, press: 1 });
    stopDeclining();
    const stopThrowing = service.onWebViewShortcut(() => {
      throw fault;
    });
    try {
      bridge.publishWebViewShortcut({ ...stroke, press: 2 });
    }
    catch (error) {
      thrown = error;
    }
    stopThrowing();

    expect([thrown, bridge.shortcutAnswers]).toEqual([fault, [[1, false], [2, false]]]);
  });

  it("passes on each notice of a web view's agent input, skipping one that isn't whole or names no kind it knows, and releases a view's focus through the bridge", () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    const inputs: string[] = [];
    const input = { module: "browser", view: "3", kind: "Start" };

    const stop = service.onWebViewInput(t => inputs.push(`${t.module} ${t.view} ${t.kind}`));
    bridge.publishWebViewInput(input);
    bridge.publishWebViewInput({ ...input, kind: "Press" });
    for (const value of [null, "3", { ...input, module: 1 }, { ...input, view: null }, { ...input, kind: "start" }, { ...input, kind: true }])
      bridge.publishWebViewInput(value);
    stop();
    bridge.publishWebViewInput(input);
    service.releaseWebViewFocus("browser", "3");

    expect(inputs).toEqual(["browser 3 Start", "browser 3 Press"]);
    expect(bridge.webViewCalls).toEqual(["release browser 3"]);
  });

  it("reads whether the window is in full screen, counting anything but a yes as no, and passes on each yes or no it reports", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    const reports: boolean[] = [];
    const reads: boolean[] = [];

    for (const value of [true, null])
      reads.push(await service.readFullScreenAsync().finally(() => bridge.fullScreen = Promise.resolve(value)));
    reads.push(await service.readFullScreenAsync());
    const stop = service.onFullScreen(t => reports.push(t));
    bridge.changeFullScreen(true);
    bridge.changeFullScreen("yes");
    bridge.changeFullScreen(false);
    stop();
    bridge.changeFullScreen(true);

    expect(reads).toEqual([false, true, false]);
    expect(reports).toEqual([true, false]);
  });

  it("reads whether the window is maximized, counting anything but a yes as no, and passes on each yes or no it reports", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    const reports: boolean[] = [];
    const reads: boolean[] = [];

    for (const value of [true, null])
      reads.push(await service.readMaximizedAsync().finally(() => bridge.maximized = Promise.resolve(value)));
    reads.push(await service.readMaximizedAsync());
    const stop = service.onMaximized(t => reports.push(t));
    bridge.changeMaximized(true);
    bridge.changeMaximized("yes");
    bridge.changeMaximized(false);
    stop();
    bridge.changeMaximized(true);

    expect(reads).toEqual([false, true, false]);
    expect(reports).toEqual([true, false]);
  });

  it("asks the main process to act on the window, counting anything but a yes as refused", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);

    const done = await service.actOnWindowAsync(WindowAction.Minimize);
    bridge.windowAnswer = null;
    const refused = await service.actOnWindowAsync(WindowAction.Close);

    expect([done, refused]).toEqual([true, false]);
    expect(bridge.windowActions).toEqual(["Minimize", "Close"]);
  });

  it("reads whether the main process can show its tray icon, counting anything but a no as yes, and passes on each yes or no it reports", async () => {
    const bridge = PreloadBridgeFixture.install();
    const service = TestBed.inject(PreloadBridgeService);
    const reports: boolean[] = [];
    const reads: boolean[] = [];

    for (const value of [false, true, null])
      reads.push(await service.readTrayAvailableAsync().finally(() => bridge.trayAvailable = Promise.resolve(value)));
    reads.push(await service.readTrayAvailableAsync());
    const stop = service.onTrayAvailable(t => reports.push(t));
    bridge.changeTrayAvailable(false);
    bridge.changeTrayAvailable("no");
    bridge.changeTrayAvailable(true);
    stop();
    bridge.changeTrayAvailable(false);

    expect(reads).toEqual([true, false, true, true]);
    expect(reports).toEqual([false, true]);
  });

  it("refuses a kept layout that is not a JSON object", async () => {
    const bridge = PreloadBridgeFixture.install();
    bridge.layout = [1, 2];

    await expect(TestBed.inject(PreloadBridgeService).readLayoutAsync()).rejects.toThrow(JsonException);
  });
});
