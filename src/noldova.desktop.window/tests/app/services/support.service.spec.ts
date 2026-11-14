/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { CommandRun, NotificationAction, NotificationPost, NotificationSeverity, QualifiedName, ShellNotifications } from "@noldova/desktop.protocol";

import { SupportService } from "../../../src/app/services/support.service";
import { FailureFixture } from "../../fixtures/failure.fixture";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

describe("SupportService", () => {
  let bridge: PreloadBridgeFixture;
  let errors: unknown[];
  let service: SupportService;

  const action = (title: string, command: string): NotificationAction => new NotificationAction(title, new CommandRun(QualifiedName.parse(command), null));
  const logFolderWarning = new NotificationPost(ShellNotifications.support, "desktop.openLogFolder", "The log folder didn't open",
    "Noldova Desktop Sample couldn't open the logs folder in its data folder. Copy details names the data folder.", NotificationSeverity.Warning, null,
    [action("Try again", "desktop.openLogFolder"), action("Copy details", "desktop.copyDetails")], null).toJson();
  const detailsWarning = new NotificationPost(ShellNotifications.support, "desktop.copyDetails", "The details weren't copied",
    "The clipboard didn't take them, or they're too long to copy. The log folder has the logs to send instead.", NotificationSeverity.Warning, null,
    [action("Try again", "desktop.copyDetails"), action("Open log folder", "desktop.openLogFolder")], null).toJson();
  const detailsCopied = new NotificationPost(ShellNotifications.support, "desktop.copyDetails", "Details copied", null, NotificationSeverity.Success, null, [], null).toJson();
  const shellRequests = (): unknown[] => bridge.requests.filter(t => t[0] === "desktop.postNotification" || t[0] === "desktop.dismissNotification");

  beforeEach(() => {
    bridge = PreloadBridgeFixture.install();
    bridge.responses.set("desktop.postNotification", { payload: { id: "n1" } });
    errors = [];
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }] });
    service = TestBed.inject(SupportService);
  });

  afterEach(() => PreloadBridgeFixture.remove());

  async function settleAsync(): Promise<void> {
    for (let turn = 0; turn < 10; turn++)
      await Promise.resolve();
  }

  it("warns until dismissed, offering to try again or copy the details, when the log folder doesn't open, and takes the warning back once it opens", async () => {
    bridge.logFolderOpened = Promise.resolve(false);
    const failed = await service.openLogFolderAsync();
    const warned = shellRequests();
    bridge.logFolderOpened = Promise.resolve(true);
    const opened = await service.openLogFolderAsync();
    const again = await service.openLogFolderAsync();

    expect([failed, opened, again, errors]).toEqual([false, true, true, []]);
    expect(warned).toEqual([["desktop.postNotification", logFolderWarning]]);
    expect(shellRequests()).toEqual([["desktop.postNotification", logFolderWarning], ["desktop.dismissNotification", { id: "n1" }]]);
  });

  it("takes the warning back when a run that succeeds starts while a failed run is still posting its warning, and joins a run asked for meanwhile to it", async () => {
    let answer: (value: unknown) => void = () => undefined;
    bridge.responses.set("desktop.postNotification", new Promise(resolve => { answer = resolve; }));
    bridge.logFolderOpened = Promise.resolve(false);
    const failing = service.openLogFolderAsync();
    await vi.waitFor(() => expect(shellRequests()).toEqual([["desktop.postNotification", logFolderWarning]]));
    bridge.logFolderOpened = Promise.resolve(true);
    const succeeding = service.openLogFolderAsync();
    const joined = service.openLogFolderAsync();
    await settleAsync();
    const opensWhilePosting = bridge.logFolderOpens;
    answer({ payload: { id: "n1" } });

    expect([await failing, await succeeding, await joined, errors, opensWhilePosting, bridge.logFolderOpens]).toEqual([false, true, true, [], 1, 2]);
    expect(shellRequests()).toEqual([["desktop.postNotification", logFolderWarning], ["desktop.dismissNotification", { id: "n1" }]]);
  });

  it("passes on a run's error and still lets the next run of the command go ahead", async () => {
    bridge.logFolderOpened = Promise.reject(new Error("The main process stopped answering."));
    const failed = service.openLogFolderAsync().catch((error: unknown) => FailureFixture.of(error, Error).message);
    await vi.waitFor(() => expect(bridge.logFolderOpens).toBe(1));
    bridge.logFolderOpened = Promise.resolve(true);
    const next = await service.openLogFolderAsync();

    expect([await failed, next, bridge.logFolderOpens, shellRequests()]).toEqual(["The main process stopped answering.", true, 2, []]);
  });

  it("warns until dismissed, offering to try again or open the log folder, when the details aren't copied, and says when they are, in the warning's place", async () => {
    bridge.isCopyAccepted = false;
    const failed = await service.copyDetailsAsync();
    bridge.isCopyAccepted = true;
    const copied = await service.copyDetailsAsync();

    expect([failed, copied, errors, bridge.copiedDetails.length]).toEqual([false, true, [], 1]);
    expect(shellRequests()).toEqual([
      ["desktop.postNotification", detailsWarning], ["desktop.dismissNotification", { id: "n1" }], ["desktop.postNotification", detailsCopied]
    ]);
  });

  it("reports a warning the runtime refuses and still answers that the command failed", async () => {
    bridge.responses.set("desktop.postNotification", { failure: { code: "Disconnected", message: "Noldova Desktop Sample is not connected to its runtime." } });
    bridge.logFolderOpened = Promise.resolve(false);
    bridge.isCopyAccepted = false;

    const answers = [await service.openLogFolderAsync(), await service.copyDetailsAsync()];

    expect(answers).toEqual([false, false]);
    expect(errors.map(t => FailureFixture.of(t, Error).message)).toEqual(["Noldova Desktop Sample is not connected to its runtime.", "Noldova Desktop Sample is not connected to its runtime."]);
  });
});
