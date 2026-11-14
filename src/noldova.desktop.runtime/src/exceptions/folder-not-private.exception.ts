/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { SystemCommandException } from "./system-command.exception.js";

export class FolderNotPrivateException extends SystemCommandException {
  public readonly folder: string;
  public readonly access: string;

  public constructor(folder: string, access: string) {
    super(Resources.formatFolderNotPrivate(folder, access));

    this.folder = folder;
    this.access = access;
  }
}
