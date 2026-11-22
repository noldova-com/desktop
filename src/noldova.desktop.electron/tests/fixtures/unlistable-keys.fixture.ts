/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class UnlistableKeysFixture implements ProxyHandler<object> {
  public static readonly MESSAGE: string = "The keys can't be listed.";

  public ownKeys(): ArrayLike<string | symbol> {
    throw new TypeError(UnlistableKeysFixture.MESSAGE);
  }
}
