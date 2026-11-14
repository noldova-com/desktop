/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IProfileWatch } from "../../src/interfaces/i-profile-watch.js";

export class ProfileChangeFixture {
  public readonly zshFolders: (string | undefined)[] = [];
  public readonly followed: (string | undefined)[] = [];
  public disposals: number = 0;
  public isOpening: boolean = false;
  public stamp: string = String.empty;
  public failure: Error | null = null;

  private onChange: () => void = () => undefined;

  public get watches(): number {
    return this.zshFolders.length;
  }

  public readonly watch = (zshFolder: string | undefined, onChange: () => void): IProfileWatch => {
    this.zshFolders.push(zshFolder);
    this.onChange = onChange;
    return {
      followAsync: t => {
        this.followed.push(t);
        return Promise.resolve(this.isOpening);
      },
      readStampAsync: () => Object.isNull(this.failure) ? Promise.resolve(this.stamp) : Promise.reject(this.failure),
      [Symbol.dispose]: () => {
        this.disposals++;
      }
    };
  };

  public change(): void {
    this.onChange();
  }
}
