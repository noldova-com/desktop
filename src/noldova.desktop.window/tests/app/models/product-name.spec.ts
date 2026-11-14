/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProductName } from "../../../src/app/models/product-name";

describe("ProductName", () => {
  it("reads back the name the window was started with, until another is used", () => {
    const started = ProductName.current;
    try {
      ProductName.use("Noldova Notes");
      const first = ProductName.current;
      ProductName.use("Noldova Tasks");

      expect([first, ProductName.current]).toEqual(["Noldova Notes", "Noldova Tasks"]);
    } finally {
      ProductName.use(started);
    }
  });
});
