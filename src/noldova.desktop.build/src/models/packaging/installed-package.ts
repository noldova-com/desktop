/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class InstalledPackage {
  public readonly mainProcess: string;
  public readonly program: string;
  public readonly resources: string;
  public readonly command: string | null;

  public constructor(mainProcess: string, program: string, resources: string, command: string | null) {
    this.mainProcess = mainProcess;
    this.program = program;
    this.resources = resources;
    this.command = command;
  }
}
