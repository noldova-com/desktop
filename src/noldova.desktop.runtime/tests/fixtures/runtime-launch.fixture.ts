/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rm } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ClientSettings, DataDirectory, DiscoveryReader, LaunchSettings, OwnershipLock, RuntimeEntry } from "@noldova/desktop.runtime";

import { FixtureFolderOwnedException } from "../exceptions/fixture-folder-owned.exception.js";
import { RuntimeDiscoveryMissingException } from "../exceptions/runtime-discovery-missing.exception.js";
import { RuntimeProcessesNotKilledException } from "../exceptions/runtime-processes-not-killed.exception.js";
import { RecordingStarterFixture } from "./recording-starter.fixture.js";
import { SocketFolderFixture } from "./socket-folder.fixture.js";
import { WaitFixture } from "./wait.fixture.js";

export class RuntimeLaunchFixture implements AsyncDisposable {
  private static readonly EXIT_TIMEOUT: number = 5_000;
  private static readonly RETRY_DELAY: number = 25;

  private readonly root: string;

  public readonly dataDirectory: DataDirectory;
  public readonly starter: RecordingStarterFixture = new RecordingStarterFixture();

  private constructor(root: string) {
    this.root = root;
    this.dataDirectory = new DataDirectory(path.join(root, "data"));
  }

  public static async createAsync(): Promise<RuntimeLaunchFixture> {
    return new RuntimeLaunchFixture((await SocketFolderFixture.createAsync("nol-launch-")).path);
  }

  public static isRunning(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    }
    catch {
      return false;
    }
  }

  public static waitForExitAsync(processId: number): Promise<boolean> {
    return WaitFixture.untilAsync(() => !RuntimeLaunchFixture.isRunning(processId), RuntimeLaunchFixture.EXIT_TIMEOUT);
  }

  public createSettings(idleGraceMilliseconds: number = 30_000, entryPath: string = RuntimeEntry.entryPath): LaunchSettings {
    return new LaunchSettings(
      this.dataDirectory,
      process.execPath,
      entryPath,
      { ...process.env },
      process.platform,
      idleGraceMilliseconds,
      10_000,
      new ClientSettings(2_000, 5_000, 1_000));
  }

  public async readProcessIdAsync(): Promise<number> {
    const discovery = await DiscoveryReader.readAsync(this.dataDirectory);
    if (Object.isNull(discovery))
      throw new RuntimeDiscoveryMissingException();
    return discovery.processId;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    const running = await this.starter.stopAsync(RuntimeLaunchFixture.EXIT_TIMEOUT);
    if (running.length > 0)
      throw new RuntimeProcessesNotKilledException(running, RuntimeLaunchFixture.EXIT_TIMEOUT, this.root);
    if (OwnershipLock.isOwned(this.dataDirectory))
      throw new FixtureFolderOwnedException(this.dataDirectory.root, this.root);
    await rm(this.root, { recursive: true, force: true, maxRetries: 20, retryDelay: RuntimeLaunchFixture.RETRY_DELAY });
  }
}
