/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash, randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { link, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonException, JsonReader } from "@noldova/context.json";
import { UpdateProcess } from "@noldova/desktop.protocol";

import { UpdateBarrierState } from "../../enums/update-barrier-state.js";
import { UpdateBarrierStatus } from "../../enums/update-barrier-status.js";
import { CaughtFailure } from "../../models/caught-failure.js";
import { SystemErrorCode } from "../../models/system-error-code.js";
import { UpdateBarrier } from "../../models/update-barrier.js";
import { Resources } from "../../resources.js";
import { FilePresence } from "../files/file-presence.js";
import { FileRenamer } from "../files/file-renamer.js";

export class Installation {
  private readonly isRunningAsync: (holder: UpdateProcess) => Promise<boolean>;
  private readonly renamer: FileRenamer = new FileRenamer();

  public readonly folder: string;
  public readonly barrierFile: string;
  public readonly recordFolder: string;
  public readonly mainProcessFolder: string;

  public constructor(folder: string, isRunningAsync: (holder: UpdateProcess) => Promise<boolean>) {
    this.folder = folder;
    this.barrierFile = path.join(folder, Resources.barrierFileName);
    this.recordFolder = path.join(folder, Resources.dataDirectoriesFolderName);
    this.mainProcessFolder = path.join(folder, Resources.mainProcessesFolderName);
    this.isRunningAsync = isRunningAsync;
  }

  public static locate(deviceFolder: string, programPath: string, platform: string): string {
    const canonical = Installation.canonicalize(programPath);
    return path.join(deviceFolder, Resources.installationsFolderName, Installation.digest(platform === Resources.windowsPlatform ? canonical.toLowerCase() : canonical));
  }

  private static canonicalize(file: string): string {
    try {
      return realpathSync.native(file);
    }
    catch (error) {
      if (!SystemErrorCode.isAny(error, Resources.unreadablePathCodes))
        throw error;
      return path.resolve(file);
    }
  }

  private static digest(text: string): string {
    return createHash(Resources.tokenDigestAlgorithm).update(text).digest(Resources.hexEncoding).slice(0, Resources.installationIdLength);
  }

  public async recordAsync(dataDirectory: string): Promise<void> {
    const root = path.resolve(dataDirectory);
    const file = path.join(this.recordFolder, `${Installation.digest(root)}${Resources.jsonExtension}`);
    const temporary = path.join(this.recordFolder, Resources.formatTemporaryName(path.basename(file), randomUUID()));
    await mkdir(this.recordFolder, { recursive: true });
    await writeFile(temporary, JSON.stringify({ [Resources.dataDirectoryField]: root }));
    await this.renamer.renameAsync(temporary, file);
  }

  public async listDataDirectoriesAsync(): Promise<readonly string[]> {
    const files = await FilePresence.unlessMissingAsync(readdir(this.recordFolder)) ?? [];
    const roots = await Promise.all(files.filter(t => t.endsWith(Resources.jsonExtension)).map(t => Installation.readEntryAsync(path.join(this.recordFolder, t))));
    return roots.filter(t => !Object.isNull(t));
  }

  public async recordMainProcessAsync(mainProcess: UpdateProcess): Promise<void> {
    const file = path.join(this.mainProcessFolder, `${mainProcess.processId}${Resources.jsonExtension}`);
    const temporary = path.join(this.mainProcessFolder, Resources.formatTemporaryName(path.basename(file), randomUUID()));
    await mkdir(this.mainProcessFolder, { recursive: true });
    await writeFile(temporary, JSON.stringify(mainProcess.toJson()));
    await this.renamer.renameAsync(temporary, file);
  }

  public async listMainProcessesAsync(): Promise<readonly UpdateProcess[]> {
    const files = await FilePresence.unlessMissingAsync(readdir(this.mainProcessFolder)) ?? [];
    const mainProcesses = await Promise.all(files.filter(t => t.endsWith(Resources.jsonExtension)).map(t => this.readMainProcessAsync(path.join(this.mainProcessFolder, t))));
    return mainProcesses.filter(t => !Object.isNull(t));
  }

  public async holdAsync(barrier: UpdateBarrier, version: string): Promise<boolean> {
    if (await this.checkAsync(version) !== UpdateBarrierStatus.None)
      return false;
    await mkdir(this.folder, { recursive: true });
    const temporary = await this.writeTemporaryAsync(barrier);
    let isHeld = false;
    try {
      await link(temporary, this.barrierFile);
      isHeld = true;
    }
    catch (error) {
      if (!SystemErrorCode.is(error, Resources.existingFileErrorCode))
        throw error;
    }
    finally {
      await rm(temporary, { force: true }).catch((error: unknown) => {
        if (!SystemErrorCode.isAny(error, Resources.busyFileErrorCodes))
          throw error;
      });
    }
    return isHeld;
  }

  public async replaceAsync(barrier: UpdateBarrier): Promise<void> {
    await this.renamer.renameAsync(await this.writeTemporaryAsync(barrier), this.barrierFile);
  }

  public async releaseAsync(): Promise<void> {
    await rm(this.barrierFile, { force: true });
  }

  public async readAsync(): Promise<UpdateBarrier | null> {
    const text = await this.readBarrierAsync();
    return Object.isNull(text) ? null : UpdateBarrier.fromJson(JsonReader.parse(text).toJson());
  }

  public readTextAsync(): Promise<string | null> {
    return this.readBarrierAsync();
  }

  public async checkAsync(version: string): Promise<UpdateBarrierStatus> {
    const text = await this.readBarrierAsync();
    if (Object.isNull(text))
      return UpdateBarrierStatus.None;
    const barrier = Installation.parse(text);
    if (Object.isNull(barrier))
      return UpdateBarrierStatus.Unfinished;
    if (await this.isRunningAsync(barrier.holder))
      return UpdateBarrierStatus.Held;
    if (barrier.state === UpdateBarrierState.HandedOff && barrier.version !== version)
      return !Object.isNull(barrier.handoff) && await this.isRunningAsync(barrier.handoff) ? UpdateBarrierStatus.Held : UpdateBarrierStatus.Unfinished;
    return await this.removeStaleAsync(text, version);
  }

  public async hasEndedAsync(): Promise<boolean> {
    const text = await this.readBarrierAsync();
    if (Object.isNull(text))
      return true;
    const barrier = UpdateBarrier.fromJson(JsonReader.parse(text).toJson());
    return barrier.state !== UpdateBarrierState.HandedOff && !await this.isRunningAsync(barrier.holder);
  }

  public async removeAsync(text: string): Promise<boolean> {
    const claimed = path.join(this.folder, Resources.formatTemporaryName(Resources.barrierFileName, randomUUID()));
    if (Object.isNull(await FilePresence.unlessMissingAsync(this.renamer.renameAsync(this.barrierFile, claimed).then(() => claimed))))
      return true;
    const isJudged = await readFile(claimed, Resources.utf8Encoding) === text;
    if (!isJudged)
      await Installation.putBackAsync(claimed, this.barrierFile);
    await rm(claimed, { force: true });
    return isJudged;
  }

  private async removeStaleAsync(text: string, version: string): Promise<UpdateBarrierStatus> {
    return await this.removeAsync(text) ? UpdateBarrierStatus.None : await this.checkAsync(version);
  }

  private static async putBackAsync(claimed: string, file: string): Promise<void> {
    try {
      await link(claimed, file);
    }
    catch (error) {
      if (!SystemErrorCode.is(error, Resources.existingFileErrorCode))
        throw error;
    }
  }

  private static parse(text: string): UpdateBarrier | null {
    try {
      return UpdateBarrier.fromJson(JsonReader.parse(text).toJson());
    }
    catch (error) {
      CaughtFailure.expect(error, JsonException);
      return null;
    }
  }

  private async writeTemporaryAsync(barrier: UpdateBarrier): Promise<string> {
    const temporary = path.join(this.folder, Resources.formatTemporaryName(Resources.barrierFileName, randomUUID()));
    await writeFile(temporary, JSON.stringify(barrier.toJson()));
    return temporary;
  }

  private static async readEntryAsync(file: string): Promise<string | null> {
    const text = await FilePresence.unlessMissingAsync(readFile(file, Resources.utf8Encoding));
    if (Object.isNull(text))
      return null;
    let root: string;
    try {
      root = JsonReader.parse(text).readString(Resources.dataDirectoryField);
    }
    catch (error) {
      CaughtFailure.expect(error, JsonException);
      return null;
    }
    return await FilePresence.existsAsync(root) ? root : null;
  }

  private async readMainProcessAsync(file: string): Promise<UpdateProcess | null> {
    const text = await FilePresence.unlessMissingAsync(readFile(file, Resources.utf8Encoding));
    const mainProcess = Object.isNull(text) ? null : Installation.parseMainProcess(text);
    if (Object.isNull(mainProcess))
      return null;
    if (await this.isRunningAsync(mainProcess))
      return mainProcess;
    await rm(file, { force: true });
    return null;
  }

  private static parseMainProcess(text: string): UpdateProcess | null {
    try {
      return UpdateProcess.fromJson(JsonReader.parse(text).toJson());
    }
    catch (error) {
      CaughtFailure.expect(error, JsonException);
      return null;
    }
  }

  private readBarrierAsync(): Promise<string | null> {
    return FilePresence.unlessMissingAsync(readFile(this.barrierFile, Resources.utf8Encoding));
  }
}
