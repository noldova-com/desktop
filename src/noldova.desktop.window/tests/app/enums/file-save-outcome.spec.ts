/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FileSaveOutcome } from "../../../src/app/enums/file-save-outcome";

describe("FileSaveOutcome", () => {
  it("names the three outcomes with matching string values", () => {
    expect(Object.entries(FileSaveOutcome)).toEqual([["Saved", "Saved"], ["Cancelled", "Cancelled"], ["Failed", "Failed"]]);
  });
});
