/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NotificationHandle } from "../../../src/app/models/notification-handle";

describe("NotificationHandle", () => {
  it("passes a dismissal to its notification", () => {
    let removals = 0;
    const handle = new NotificationHandle("7", () => removals++);

    handle.dismiss();

    expect(handle.id).toBe("7");
    expect(removals).toBe(1);
  });
});
