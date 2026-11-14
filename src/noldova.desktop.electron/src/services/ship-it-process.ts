/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { SystemCommand } from "@noldova/desktop.runtime";

import { ShipItNotRemovedException } from "../exceptions/ship-it-not-removed.exception.js";
import { ShipItUnreadableException } from "../exceptions/ship-it-unreadable.exception.js";
import type { IShipItProcess } from "../interfaces/i-ship-it-process.js";
import { Resources } from "../resources.js";

export class ShipItProcess implements IShipItProcess {
  private readonly label: string;
  private readonly command: Pick<SystemCommand, "runAsync">;

  public constructor(bundleIdentifier: string, command: Pick<SystemCommand, "runAsync">) {
    this.label = Resources.formatShipItLabel(bundleIdentifier);
    this.command = command;
  }

  public async findAsync(): Promise<number | null> {
    return ShipItProcess.processOf(await this.readAsync());
  }

  public async removeAsync(): Promise<void> {
    if (!Object.isUndefined(await this.readAsync()))
      await this.unloadAsync();
  }

  public async removeStoppedAsync(): Promise<void> {
    const job = await this.readAsync();
    if (!Object.isUndefined(job) && Object.isNull(ShipItProcess.processOf(job)))
      await this.unloadAsync();
  }

  private static processOf(job: readonly string[] | undefined): number | null {
    const processId = Number(job?.[Resources.launchListProcessColumn]);
    return Number.isSafeInteger(processId) && processId > 0 ? processId : null;
  }

  private async unloadAsync(): Promise<void> {
    try {
      await this.command.runAsync(Resources.launchControl, [Resources.launchControlRemove, this.label]);
    }
    catch (error) {
      throw new ShipItNotRemovedException(error);
    }
  }

  private async readAsync(): Promise<readonly string[] | undefined> {
    let output: string;
    try {
      output = await this.command.runAsync(Resources.launchControl, [Resources.launchControlList]);
    }
    catch (error) {
      throw new ShipItUnreadableException(error);
    }
    return output.split(Resources.lineBreak).map(t => t.split(Resources.launchListSeparator)).find(t => t[Resources.launchListLabelColumn] === this.label);
  }
}
