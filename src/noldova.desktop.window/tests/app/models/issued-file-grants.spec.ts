/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { IssuedFileGrant } from "../../../src/app/models/issued-file-grant";
import { IssuedFileGrants } from "../../../src/app/models/issued-file-grants";

describe("IssuedFileGrants", () => {
  it("keeps the granted files and the refused paths in their order", () => {
    const first = new IssuedFileGrant("0123456789abcdef0123456789abcdef", "report.pdf", "application/pdf", 2048);
    const second = new IssuedFileGrant("fedcba9876543210fedcba9876543210", "photo.png", "image/png", 512);

    const grants = new IssuedFileGrants([first, second], ["/tmp/secret.key"]);

    expect([grants.files, grants.refused]).toEqual([[first, second], ["/tmp/secret.key"]]);
  });

  it("has an empty answer with no files and nothing refused", () => {
    expect([IssuedFileGrants.none.files, IssuedFileGrants.none.refused]).toEqual([[], []]);
  });
});
