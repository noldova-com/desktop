/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FakeElectron } from "./fake-electron.fixture.js";
import type { FakeMainProcessEnvironment } from "./fake-main-process-environment.fixture.js";
import type { FakeRuntimeConnection } from "./fake-runtime-connection.fixture.js";
import type { FakeRuntimeLauncher } from "./fake-runtime-launcher.fixture.js";

export class StartedMainProcessFixture {
  public readonly electron: FakeElectron;
  public readonly launcher: FakeRuntimeLauncher;
  public readonly connection: FakeRuntimeConnection;
  public readonly process: FakeMainProcessEnvironment;

  public constructor(electron: FakeElectron, launcher: FakeRuntimeLauncher, connection: FakeRuntimeConnection, process: FakeMainProcessEnvironment) {
    this.electron = electron;
    this.launcher = launcher;
    this.connection = connection;
    this.process = process;
  }
}
