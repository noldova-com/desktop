/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class MappedFile {
  public readonly path: string;
  public readonly device: bigint;
  public readonly inode: bigint;
  public readonly isDeleted: boolean;

  public constructor(path: string, device: bigint, inode: bigint, isDeleted: boolean) {
    this.path = path;
    this.device = device;
    this.inode = inode;
    this.isDeleted = isDeleted;
  }

  public isSameFile(device: bigint, inode: bigint): boolean {
    return this.device === device && this.inode === inode;
  }
}
