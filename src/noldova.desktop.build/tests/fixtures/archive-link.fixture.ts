/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ArchiveLinkFixture {
  public readonly repository: string;
  public readonly target: string;

  public constructor(repository: string, target: string) {
    this.repository = repository;
    this.target = target;
  }
}
