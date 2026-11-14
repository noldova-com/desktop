/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";

import "@noldova/context.core";
import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";
import {
  type IRuntimePart, type IRuntimePartContext, Migration, type OwnedProcess, ProcessRequest, type PseudoTerminal, PseudoTerminalRequest, RuntimeCommand, type WorkItem
} from "@noldova/desktop.runtime";

import { Resources } from "./resources.js";

export class RuntimePart implements IRuntimePart {
  public readonly migrations: readonly Migration[] = [new Migration(Resources.readingsMigration, [Resources.createReadingsStatement])];
  private ticks: number = 0;
  private isPaused: boolean = false;
  private readonly work: WorkItem[] = [];
  private readonly programs: (OwnedProcess | PseudoTerminal)[] = [];

  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    if (existsSync(path.join(context.moduleFolder, Resources.failureMarker)))
      throw new Error(Resources.failureMessage);

    context.registerMethod(Resources.timeMethod, { handleAsync: async () => ({ time: new Date().toISOString() }) });
    const database = context.database;
    context.registerMethod(Resources.recordMethod, {
      handleAsync: async () => {
        database.run(Resources.insertReadingStatement, new Date().toISOString());
        return { readings: Number(database.read(Resources.countReadingsStatement)?.[Resources.countColumn]) };
      }
    });
    const ticked = context.declareEvent(Resources.tickedEvent);
    const tick = new RuntimeCommand(Resources.tickCommand, Resources.tickTitle, Resources.tickIcon, Resources.tickKey, {
      handleAsync: async () => {
        this.ticks += Number(context.settings.read(Resources.tickStepSetting));
        ticked.publish({ ticks: this.ticks });
        context.postNotification(new NotificationPost(
          QualifiedName.parse(Resources.alarmKind), Resources.tickedKey, Resources.tickedTitle, `Ticks: ${this.ticks}`, NotificationSeverity.Success, null, [], null));
        return { ticks: this.ticks };
      }
    });
    const pause = new RuntimeCommand(Resources.pauseCommand, Resources.pauseTitle, null, null, {
      handleAsync: async () => {
        this.isPaused = !this.isPaused;
        tick.setEnabled(!this.isPaused);
        return { isPaused: this.isPaused };
      }
    }, false);
    context.registerCommand(tick);
    context.registerCommand(pause);
    context.registerCommand(new RuntimeCommand(Resources.beginWorkCommand, Resources.beginWorkTitle, null, null, {
      handleAsync: async () => {
        const folder = await context.getWorkFolderAsync();
        const work = context.beginWork(Resources.workDescription);
        context.log.write(Resources.workBegan);
        work.signal.addEventListener(Resources.abortEvent, () => {
          const marker = path.join(folder, Resources.stoppedMarker);
          writeFileSync(`${marker}${Resources.partSuffix}`, String.empty);
          RuntimePart.renameWhole(`${marker}${Resources.partSuffix}`, marker);
          work[Symbol.dispose]();
        }, { once: true });
        this.work.push(work);
        return null;
      }
    }));
    context.registerCommand(new RuntimeCommand(Resources.startProgramCommand, Resources.startProgramTitle, null, null, {
      handleAsync: async request => {
        if (request.payload === Resources.terminalArgument)
          return await this.startTerminalAsync(context);
        const exits = request.payload === Resources.exitArgument ? [Resources.exitArgument] : [];
        const owned = await context.startProcessAsync(new ProcessRequest(
          process.execPath, [Resources.evaluateArgument, Resources.programScript, ...exits], await context.getWorkFolderAsync(), { [Resources.nodeVariable]: "1" }, []));
        this.programs.push(owned);
        for await (const line of createInterface({ input: owned.output }))
          return { processId: owned.processId, childProcessId: Number(line) };
        throw new Error(Resources.programEndedMessage);
      }
    }));
    context.registerCommand(new RuntimeCommand(Resources.stopProgramCommand, Resources.stopProgramTitle, null, null, {
      handleAsync: async () => {
        const programs = this.programs.splice(0);
        await Promise.all(programs.map(t => t.stopAsync()));
        return { stopped: programs.length };
      }
    }));
    context.registerCommand(new RuntimeCommand(Resources.finishWorkCommand, Resources.finishWorkTitle, null, null, {
      handleAsync: async () => {
        for (const work of this.work.splice(0))
          work[Symbol.dispose]();
        return null;
      }
    }));
    context.postNotification(new NotificationPost(
      QualifiedName.parse(Resources.alarmKind), null, Resources.alarmTitle, Resources.alarmText, NotificationSeverity.Info, null, [], null));
    context.postNotification(new NotificationPost(
      QualifiedName.parse(Resources.syncKind), null, Resources.syncTitle, null, NotificationSeverity.Info, null, [], NotificationPost.indeterminate));
  }

  public async deactivateAsync(): Promise<void> {
  }

  private async startTerminalAsync(context: IRuntimePartContext): Promise<{ processId: number; childProcessId: number }> {
    const library = await import("node-pty");
    const environment = Object.fromEntries(Object.entries(process.env).filter((t): t is [string, string] => !Object.isUndefined(t[1])));
    const terminal = await context.startPseudoTerminalAsync(new PseudoTerminalRequest(
      library, Resources.terminalProgram, [Resources.evaluateArgument, Resources.programScript], await context.getWorkFolderAsync(), Resources.terminalColumns, Resources.terminalRows, environment));
    this.programs.push(terminal);
    const line = await new Promise<string>((resolve, reject) => {
      let text = String.empty;
      terminal.onOutput(t => {
        text += t;
        if (t.includes(Resources.deviceQuery))
          terminal.write(Resources.deviceAnswer);
        const child = Resources.childLinePattern.exec(text);
        if (!Object.isNull(child))
          resolve(child[1] ?? String.empty);
      });
      void terminal.exited.then(() => reject(new Error(Resources.programEndedMessage)));
    });
    return { processId: terminal.processId, childProcessId: Number(line) };
  }

  private static renameWhole(from: string, to: string): void {
    const pause = new Int32Array(new SharedArrayBuffer(4));
    for (let attempt = 1; ; attempt++) {
      try {
        renameSync(from, to);
        return;
      }
      catch (error) {
        if (attempt >= Resources.renameAttempts || !Resources.heldFileCodes.includes(String(Object.isObject(error) && "code" in error ? error.code : undefined)))
          throw error;
      }
      Atomics.wait(pause, 0, 0, Resources.renameRetryDelay);
    }
  }
}
