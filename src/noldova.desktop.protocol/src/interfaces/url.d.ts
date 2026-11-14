/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

declare global {
  interface URL {
    readonly href: string;
    readonly protocol: string;
    readonly username: string;
    readonly password: string;
  }

  var URL: {
    readonly prototype: URL;
    new(url: string): URL;
    canParse(url: string): boolean;
  };
}

export {};
