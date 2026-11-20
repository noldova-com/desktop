/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

describe("The test server's address", () => {
  it("serves the test page from 127.0.0.1, where the server listens, so the browser never resolves localhost to an address it doesn't", async () => {
    const response = await fetch(location.href, { cache: "no-store" });

    expect([location.hostname, location.port, new URL(response.url).hostname, response.ok]).toEqual(["127.0.0.1", "24326", "127.0.0.1", true]);
  });
});
