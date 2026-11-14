/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IFolderProtector } from "@noldova/desktop.runtime";

import { AccessControlFixture } from "./access-control.fixture.js";

export class AccessRecordingProtectorFixture implements IFolderProtector {
  private readonly protector: IFolderProtector;

  public before: string = String.empty;

  public constructor(protector: IFolderProtector) {
    this.protector = protector;
  }

  public async protectAsync(folder: string): Promise<void> {
    this.before = process.platform === "win32" ? AccessControlFixture.readSddl(folder) : String.empty;
    await this.protector.protectAsync(folder);
  }
}
