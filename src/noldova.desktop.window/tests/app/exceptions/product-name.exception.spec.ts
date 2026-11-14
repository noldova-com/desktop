/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";

import { ProductNameException } from "../../../src/app/exceptions/product-name.exception";

describe("ProductNameException", () => {
  it("is an exception with its message", () => {
    const exception = new ProductNameException();

    expect(exception).toBeInstanceOf(Exception);
    expect(exception.message).toBe("The window needs the app's product name, desktop.product.name in its root package.json, which the app's build passes to WindowApplication.startAsync.");
  });
});
