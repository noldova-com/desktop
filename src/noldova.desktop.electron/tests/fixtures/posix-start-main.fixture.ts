/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { app } from "electron";

import { ChildProgramHost } from "@noldova/desktop.electron";
import { ChildProcessStarter, type IPosixProcessAddon, NativeAddon, PosixProcessApi } from "@noldova/desktop.runtime";

const [addon = String.empty, file = String.empty] = process.argv.slice(-2);

void app.whenReady().then(async () => {
  const host = new ChildProgramHost(process.platform, 0, new ChildProcessStarter(process.platform, new PosixProcessApi(new NativeAddon<IPosixProcessAddon>(addon, ["startDetached"]))));
  await host.startDetachedAsync("/bin/sh", ["-c", "ls /proc/self/fd > \"$0.part\" && mv \"$0.part\" \"$0\"", file], process.env, process.cwd());
  app.quit();
}).catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  app.exit(1);
});
