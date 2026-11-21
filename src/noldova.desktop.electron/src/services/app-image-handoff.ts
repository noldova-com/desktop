/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { NotAnAppImageException } from "../exceptions/not-an-app-image.exception.js";
import { UpdateChangedBeforeHandoffException } from "../exceptions/update-changed-before-handoff.exception.js";
import { UpdateUnsignedAtHandoffException } from "../exceptions/update-unsigned-at-handoff.exception.js";
import type { IUpdateHandoff } from "../interfaces/i-update-handoff.js";
import type { UpdateReadyRecord } from "../models/update-ready-record.js";
import { Resources } from "../resources.js";
import type { AppImageReplacement } from "./app-image-replacement.js";
import { UpdateController } from "./update-controller.js";

export class AppImageHandoff implements IUpdateHandoff {
  private readonly replacement: Pick<AppImageReplacement, "replaceAsync"> | null;
  private readonly verifyAsync: (record: UpdateReadyRecord) => Promise<string | null>;

  public constructor(replacement: Pick<AppImageReplacement, "replaceAsync"> | null, verifyAsync: (record: UpdateReadyRecord) => Promise<string | null>) {
    this.replacement = replacement;
    this.verifyAsync = verifyAsync;
  }

  public get refusal(): string | null {
    return Object.isNull(this.replacement) ? Resources.notAnAppImage : null;
  }

  public async handOffAsync(record: UpdateReadyRecord): Promise<null> {
    if (Object.isNull(this.replacement))
      throw new NotAnAppImageException();
    if (await UpdateController.hashFileAsync(record.file).catch(() => null) !== record.sha512)
      throw new UpdateChangedBeforeHandoffException();
    const failure = await this.verifyAsync(record);
    if (!Object.isNull(failure))
      throw new UpdateUnsignedAtHandoffException(record.file, failure);
    await this.replacement.replaceAsync(record.file);
    return null;
  }

  public clearAsync(): Promise<void> {
    return Promise.resolve();
  }
}
