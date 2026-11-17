/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import { ShipItNotFoundException } from "../exceptions/ship-it-not-found.exception.js";
import { UpdateChangedBeforeHandoffException } from "../exceptions/update-changed-before-handoff.exception.js";
import { UpdateHandoffException } from "../exceptions/update-handoff.exception.js";
import { UpdateNoLongerOfferedException } from "../exceptions/update-no-longer-offered.exception.js";
import { UpdateNotStagedInTimeException } from "../exceptions/update-not-staged-in-time.exception.js";
import { UpdateNotStagedException } from "../exceptions/update-not-staged.exception.js";
import type { INativeUpdater } from "../interfaces/i-native-updater.js";
import type { IShipItProcess } from "../interfaces/i-ship-it-process.js";
import type { IUpdateHandoff } from "../interfaces/i-update-handoff.js";
import type { IUpdater } from "../interfaces/i-updater.js";
import type { UpdateReadyRecord } from "../models/update-ready-record.js";
import { Resources } from "../resources.js";
import { UpdateController } from "./update-controller.js";

export class SquirrelHandoff implements IUpdateHandoff {
  private readonly updater: IUpdater;
  private readonly native: INativeUpdater;
  private readonly shipIt: IShipItProcess;
  private readonly schedule: (delay: number, run: () => void) => () => void;
  private readonly log: (text: string) => void;
  private lateStage: (() => void) | undefined;

  public readonly refusal: string | null = null;

  public constructor(
    updater: IUpdater,
    native: INativeUpdater,
    shipIt: IShipItProcess,
    schedule: (delay: number, run: () => void) => () => void,
    log: (text: string) => void) {
    this.updater = updater;
    this.native = native;
    this.shipIt = shipIt;
    this.schedule = schedule;
    this.log = log;
    this.lateStage = undefined;
  }

  public async clearAsync(): Promise<void> {
    await this.shipIt.removeStoppedAsync().catch((error: unknown) => this.log(Resources.formatStoppedShipItNotRemoved(String(error))));
  }

  public async handOffAsync(record: UpdateReadyRecord): Promise<number> {
    if (this.updater.downloadedFile !== record.file) {
      if (await this.updater.checkAsync() !== record.version)
        throw new UpdateNoLongerOfferedException(record.version);
      await this.updater.downloadAsync(record.version, () => undefined);
    }
    if (await UpdateController.hashFileAsync(record.file).catch(() => null) !== record.sha512)
      throw new UpdateChangedBeforeHandoffException();
    try {
      await this.stageAsync();
      const processId = await this.shipIt.findAsync();
      if (Object.isNull(processId))
        throw new ShipItNotFoundException();
      return processId;
    }
    catch (error) {
      await this.removeShipItAsync();
      throw error;
    }
  }

  private stageAsync(): Promise<void> {
    return new Promise((resolve, reject) => {
      const finish = (failure: UpdateHandoffException | null): void => {
        cancel();
        this.native.removeListener(Resources.squirrelStagedEvent, onStaged);
        this.native.removeListener(Resources.errorEvent, onFailed);
        if (Object.isNull(failure))
          resolve();
        else
          reject(failure);
      };
      const onStaged = (): void => finish(null);
      const onFailed = (error: unknown): void => finish(new UpdateNotStagedException(new ExceptionOptions(error)));
      const cancel = this.schedule(Resources.updateStageLimit, () => {
        finish(new UpdateNotStagedInTimeException());
        this.lateStage = () => {
          this.forgetLateStage();
          void this.removeShipItAsync();
        };
        this.native.on(Resources.squirrelStagedEvent, this.lateStage);
      });
      this.native.on(Resources.squirrelStagedEvent, onStaged);
      this.native.on(Resources.errorEvent, onFailed);
      this.forgetLateStage();
      try {
        this.native.checkForUpdates();
      }
      catch (error) {
        onFailed(error);
      }
    });
  }

  private forgetLateStage(): void {
    if (!Object.isUndefined(this.lateStage))
      this.native.removeListener(Resources.squirrelStagedEvent, this.lateStage);
    this.lateStage = undefined;
  }

  private async removeShipItAsync(): Promise<void> {
    await this.shipIt.removeAsync().catch((error: unknown) => this.log(Resources.formatStagedUpdateKept(String(error))));
  }
}
