/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Assert } from "@noldova/context.testing";
import type { BuildIdentity, Event, QualifiedName } from "@noldova/desktop.protocol";
import {
  type IProcessStarter, Installation, type LaunchSettings, ProcessPresence, RuntimeLauncher, UpdateBarrier, UpdateBarrierState
} from "@noldova/desktop.runtime";

import type { RawConnectionFixture } from "./raw-connection.fixture.js";

export class UpdateBarrierFixture {
  public static readonly PRESENCE: ProcessPresence = ProcessPresence.create(process.platform);

  public static open(folder: string): Installation {
    return new Installation(path.join(folder, "installation"), t => UpdateBarrierFixture.PRESENCE.isRunningAsync(t));
  }

  public static createLauncher(settings: LaunchSettings, identity: BuildIdentity, starter?: IProcessStarter,
    log: (text: string) => void = () => undefined): RuntimeLauncher {
    return new RuntimeLauncher(settings, identity, UpdateBarrierFixture.open(path.dirname(settings.dataDirectory.root)), log, starter);
  }

  public static async holdAsync(installation: Installation, processId: number = process.pid, state: UpdateBarrierState = UpdateBarrierState.Preparing,
    presence: ProcessPresence = UpdateBarrierFixture.PRESENCE): Promise<void> {
    const [holder] = await presence.stampAsync([[processId, "main"]]);
    Assert.isDefined(holder);
    await mkdir(installation.folder, { recursive: true });
    await writeFile(installation.barrierFile, JSON.stringify(new UpdateBarrier(holder, "0.3.0", state, null).toJson()));
  }

  public static async readEventAsync(connection: RawConnectionFixture, name: QualifiedName): Promise<Event> {
    for (;;) {
      const event = await connection.readEventAsync();
      if (event.name.equals(name))
        return event;
    }
  }
}
