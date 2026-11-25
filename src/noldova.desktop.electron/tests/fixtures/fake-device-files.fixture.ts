/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeDeviceFileMissingException } from "../exceptions/fake-device-file-missing.exception.js";
import { CreatedDeviceFile } from "./created-device-file.fixture.js";
import { FakeDeviceFileStore } from "./fake-device-file-store.fixture.js";

export class FakeDeviceFiles {
  public readonly created: CreatedDeviceFile[] = [];
  public readonly appearance: FakeDeviceFileStore = new FakeDeviceFileStore();
  public readonly state: FakeDeviceFileStore = new FakeDeviceFileStore();
  public readonly updateReady: FakeDeviceFileStore = new FakeDeviceFileStore();
  public readonly windowState: FakeDeviceFileStore = new FakeDeviceFileStore();

  public create(folder: string, fileName: string): FakeDeviceFileStore {
    this.created.push(new CreatedDeviceFile(folder, fileName));
    switch (fileName) {
      case "appearance.json":
        return this.appearance;
      case "device-state.json":
        return this.state;
      case "update-ready.json":
        return this.updateReady;
      case "window-state.json":
        return this.windowState;
      default:
        throw new FakeDeviceFileMissingException(fileName);
    }
  }
}
