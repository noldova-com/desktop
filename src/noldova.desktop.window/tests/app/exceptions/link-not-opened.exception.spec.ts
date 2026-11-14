/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";

import { LinkNotOpenedException } from "../../../src/app/exceptions/link-not-opened.exception";

describe("LinkNotOpenedException", () => {
  it("is an exception whose message names the product", () => {
    const exception = new LinkNotOpenedException("Sample App");

    expect(exception).toBeInstanceOf(Exception);
    expect(exception.message).toBe("Sample App did not open the link: it opens only well-formed http, https and mailto links, in the system's own application.");
  });
});
