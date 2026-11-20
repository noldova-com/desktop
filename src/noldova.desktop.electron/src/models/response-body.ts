/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ResponseBody {
  public static async letGoAsync(response: { readonly body?: { cancel(): Promise<void> } | null }): Promise<void> {
    await response.body?.cancel().catch(() => undefined);
  }
}
