/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import type { BuildIdentity, MainWindow, ModuleStatusList, WorkReport } from "@noldova/desktop.protocol";

export class StatusReport {
  public readonly identity: BuildIdentity;
  public readonly dataDirectory: string;
  public readonly modules: ModuleStatusList;
  public readonly work: WorkReport;
  public readonly window: MainWindow | null;

  public constructor(identity: BuildIdentity, dataDirectory: string, modules: ModuleStatusList, work: WorkReport, window: MainWindow | null) {
    this.identity = identity;
    this.dataDirectory = dataDirectory;
    this.modules = modules;
    this.work = work;
    this.window = window;
  }

  public toJson(): JsonObject {
    return {
      build: this.identity.toJson(),
      dataDirectory: this.dataDirectory,
      modules: this.modules.modules.map(t => ({ id: t.id, state: t.state, ...Object.isNull(t.cause) ? {} : { cause: t.cause } })),
      work: [...this.work.descriptions],
      window: this.window?.toJson() ?? null
    };
  }
}
