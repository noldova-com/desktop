/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class UserNamespaces {
  public static async findRefusalAsync(readTextAsync: (file: string) => Promise<string | null>): Promise<string | null> {
    for (const [file, value] of Resources.userNamespaceRestrictions)
      if ((await readTextAsync(file))?.trim() === value)
        return Resources.formatUserNamespaceRefusal(file, value);
    return null;
  }

  public static async canEnterAsync(runAsync: (command: string, commandArguments: readonly string[]) => Promise<number | null>): Promise<boolean> {
    try {
      return await runAsync(Resources.userNamespacesProbeCommand, Resources.userNamespacesProbeArguments) === 0;
    }
    catch (error) {
      if (error instanceof BuildException)
        return false;
      throw error;
    }
  }
}
