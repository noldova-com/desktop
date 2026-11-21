/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class NpmLogsFixture {
  public static readonly REQUESTS: readonly string[] = Array.from({ length: 7 }, (_, t) => `${t + 1} http fetch GET 200 https://registry.npmjs.org/package-${t}/-/package-${t}-1.0.0.tgz 12ms (cache miss)`);
  public static readonly STALLED: readonly string[] = [...NpmLogsFixture.REQUESTS, "8 error code ETIMEDOUT", "9 error syscall read", "10 error errno -60"];
  public static readonly RESET: readonly string[] = [...NpmLogsFixture.REQUESTS, "8 error code ECONNRESET", "9 error syscall read", "10 error errno -54"];
  public static readonly ABORTED: readonly string[] = [...NpmLogsFixture.REQUESTS, "8 error code ECONNRESET", "9 error network aborted"];
  public static readonly CONNECTING: readonly string[] = [...NpmLogsFixture.REQUESTS, "8 error code ETIMEDOUT", "9 error syscall connect", "10 error errno -60"];
  public static readonly OTHER: readonly string[] = [...NpmLogsFixture.REQUESTS, "8 error code EINTEGRITY", "9 error syscall read"];
}
