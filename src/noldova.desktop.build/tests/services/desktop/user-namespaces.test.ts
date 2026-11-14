/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { UserNamespaces } from "../../../src/services/desktop/user-namespaces.js";

@TestClass
export class UserNamespacesTests {
  @TestMethod
  public async findsNoRefusalWhenEverySettingAllowsThemOrIsAbsentAsync(): Promise<void> {
    const hosts: readonly Readonly<Record<string, string>>[] = [
      {},
      { "/proc/sys/kernel/apparmor_restrict_unprivileged_userns": "0\n", "/proc/sys/kernel/unprivileged_userns_clone": "1\n", "/proc/sys/user/max_user_namespaces": "63432\n" }
    ];

    for (const host of hosts)
      Assert.isNull(await UserNamespaces.findRefusalAsync(t => Promise.resolve(host[t] ?? null)), JSON.stringify(host));
  }

  @TestMethod
  public async namesTheFirstSettingThatRefusesThemAsync(): Promise<void> {
    const cases: readonly (readonly [Readonly<Record<string, string>>, string])[] = [
      [{ "/proc/sys/kernel/apparmor_restrict_unprivileged_userns": "1\n", "/proc/sys/user/max_user_namespaces": "0\n" }, "/proc/sys/kernel/apparmor_restrict_unprivileged_userns is 1"],
      [{ "/proc/sys/kernel/unprivileged_userns_clone": "0\n" }, "/proc/sys/kernel/unprivileged_userns_clone is 0"],
      [{ "/proc/sys/user/max_user_namespaces": "0" }, "/proc/sys/user/max_user_namespaces is 0"]
    ];

    for (const [host, refusal] of cases)
      Assert.areEqual(refusal, await UserNamespaces.findRefusalAsync(t => Promise.resolve(host[t] ?? null)));
  }

  @TestMethod
  public async entersOnlyWhenTheLaunchersProbeSucceedsAsync(): Promise<void> {
    const calls: string[] = [];
    const runs: readonly (() => Promise<number | null>)[] = [
      () => Promise.resolve(0),
      () => Promise.resolve(1),
      () => Promise.resolve(null),
      () => Promise.reject(new BuildException("\"unshare\" could not start."))
    ];

    const results: boolean[] = [];
    for (const run of runs)
      results.push(await UserNamespaces.canEnterAsync((command, commandArguments) => {
        calls.push([command, ...commandArguments].join(" "));
        return run();
      }));

    Assert.areEqual("true,false,false,false", results.join(","));
    Assert.areEqual("unshare -Ur true", [...new Set(calls)].join("|"));
  }

  @TestMethod
  public async throwsAProbeFailureThatIsNotTheProcesssOwnAsync(): Promise<void> {
    const error = await Assert.throwsAsync(() => UserNamespaces.canEnterAsync(() => Promise.reject(new RangeError("broken"))), RangeError);

    Assert.areEqual("broken", error.message);
  }
}
