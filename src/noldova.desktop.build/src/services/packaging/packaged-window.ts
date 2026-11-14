/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader, type JsonValue } from "@noldova/context.json";

import { BuildException } from "../../exceptions/build.exception.ts";
import type { IWindowWait } from "../../interfaces/i-window-wait.ts";
import { Resources } from "../../resources.ts";

export class PackagedWindow {
  public static verify(status: unknown, productName: string): string {
    const result = PackagedWindow.inspect(status, productName);
    if (result instanceof BuildException)
      throw result;
    return result;
  }

  public static async waitAsync(wait: IWindowWait, productName: string): Promise<string> {
    const started = wait.now();
    for (;;) {
      const status = await wait.queryAsync();
      const failure = PackagedWindow.inspect(PackagedWindow.parse(status.output), productName);
      if (!(failure instanceof BuildException))
        return failure;
      if (wait.mainProcess.hasExited)
        throw new BuildException(Resources.formatWindowMainEnded(wait.mainProcess.ending, failure.message, await wait.readTailAsync()));
      if (wait.now() - started >= wait.limit)
        throw new BuildException(Resources.formatWindowTimedOut(wait.limit, failure.message, status.exitCode, status.text,
          await wait.readTailAsync()));
      await wait.pauseAsync();
    }
  }

  private static inspect(status: unknown, productName: string): string | BuildException {
    let window: JsonValue = null;
    let title: string;
    let isVisible: boolean;
    let isPainted: boolean;
    try {
      const reader = JsonReader.fromValue(status);
      window = reader.hasField(Resources.statusWindowField) ? reader.readValue(Resources.statusWindowField) : null;
      const shown = JsonReader.fromValue(window);
      title = shown.readString(Resources.statusTitleField);
      isVisible = shown.readBoolean(Resources.statusIsVisibleField);
      isPainted = shown.readBoolean(Resources.statusIsPaintedField);
    }
    catch (error) {
      return new BuildException(Resources.formatWindowUnreported(window), new ExceptionOptions(error));
    }
    const pageSuffix = Resources.formatWindowPageSuffix(productName);
    if (title !== productName && !(title.endsWith(pageSuffix) && title.length > pageSuffix.length))
      return new BuildException(Resources.formatWindowMistitled(title, productName, pageSuffix));
    if (!isVisible)
      return new BuildException(Resources.formatWindowHidden(title));
    if (!isPainted)
      return new BuildException(Resources.formatWindowUnpainted(title));
    return Resources.formatWindowShown(title);
  }

  private static parse(text: string): JsonValue {
    try {
      return JsonReader.parse(text).toJson();
    }
    catch {
      return null;
    }
  }
}
