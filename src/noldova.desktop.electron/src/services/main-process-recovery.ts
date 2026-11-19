/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";
import { inspect } from "node:util";

import type { MessageBoxOptions } from "electron";

import "@noldova/context.core";
import { type DiagnosticRedactor, LogText } from "@noldova/desktop.runtime";

import type { MainProcessFailureKind } from "../enums/main-process-failure-kind.js";
import { UnusableFolderException } from "../exceptions/unusable-folder.exception.js";
import type { IApplicationHost } from "../interfaces/i-application-host.js";
import type { IMainProcessLog } from "../interfaces/i-main-process-log.js";
import type { IDialogHost } from "../interfaces/i-dialog-host.js";
import { Resources } from "../resources.js";

export class MainProcessRecovery {
  private readonly app: IApplicationHost;
  private readonly dialog: IDialogHost;
  private readonly errorOutput: Writable;
  private readonly redactor: DiagnosticRedactor;
  private log: IMainProcessLog | undefined;
  private openLogFolderAsync: (() => Promise<boolean>) | undefined;
  private release: (() => void) | undefined;
  private hasFailed: boolean = false;

  public constructor(app: IApplicationHost, dialog: IDialogHost, errorOutput: Writable, redactor: DiagnosticRedactor) {
    this.app = app;
    this.dialog = dialog;
    this.errorOutput = errorOutput;
    this.redactor = redactor;
    this.log = undefined;
    this.openLogFolderAsync = undefined;
    this.release = undefined;
  }

  public attach(log: IMainProcessLog, openLogFolderAsync: () => Promise<boolean>, release: () => void): void {
    this.log = log;
    this.openLogFolderAsync = openLogFolderAsync;
    this.release = release;
  }

  public receive(error: unknown, kind: MainProcessFailureKind): void {
    this.record(Resources.formatMainProcessFailure(kind, MainProcessRecovery.describe(error)));
    if (this.hasFailed)
      return;
    this.hasFailed = true;
    this.askAsync(error).catch(async (failure: unknown) => {
      try {
        this.record(Resources.formatMainProcessBoxFailed(MainProcessRecovery.describe(failure)));
      }
      finally {
        await this.exitAsync(Resources.failureExitCode);
      }
    });
  }

  private async askAsync(error: unknown): Promise<void> {
    await this.app.whenReady();
    const openLogFolderAsync = this.openLogFolderAsync;
    const buttons = Object.isUndefined(openLogFolderAsync)
      ? [Resources.restartButton, Resources.quitButton]
      : [Resources.restartButton, Resources.openLogFolderButton, Resources.quitButton];
    const advice = Object.isUndefined(openLogFolderAsync) ? Resources.mainProcessFailedBeforeStartDetail : Resources.mainProcessFailedDetail;
    const options: MessageBoxOptions = {
      type: Resources.warningBoxType,
      message: Resources.mainProcessFailed,
      detail: error instanceof UnusableFolderException ? Resources.formatFailureDetail(error.message, advice) : advice,
      buttons,
      defaultId: 0,
      cancelId: buttons.length - 1,
      noLink: true
    };
    for (;;) {
      const choice = buttons[(await this.dialog.showMessageBox(null, options)).response] ?? Resources.quitButton;
      this.record(Resources.formatRecoveryChoice(choice));
      if (!Object.isUndefined(openLogFolderAsync) && choice === Resources.openLogFolderButton) {
        await openLogFolderAsync();
        continue;
      }
      if (choice === Resources.restartButton)
        this.app.relaunch();
      await this.exitAsync(Resources.quitExitCode);
      return;
    }
  }

  private async exitAsync(code: number): Promise<void> {
    try {
      this.release?.();
    }
    catch (failure) {
      this.record(Resources.formatMainProcessNotReleased(MainProcessRecovery.describe(failure)));
    }
    this.log?.flush();
    await this.log?.closeAsync?.();
    this.app.exit(code);
  }

  private record(text: string): void {
    if (Object.isUndefined(this.log))
      this.errorOutput.write(Resources.formatLogLine(new Date().toISOString(), this.redactor.redact(text)));
    else
      this.log.write(text);
  }

  private static describe(error: unknown): string {
    return LogText.lines(inspect(error)).join(Resources.logLineSeparator);
  }
}
