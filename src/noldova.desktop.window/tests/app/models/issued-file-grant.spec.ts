/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { IssuedFileGrant } from "../../../src/app/models/issued-file-grant";

describe("IssuedFileGrant", () => {
  it("keeps the grant, the file's name, its media type and its size", () => {
    const grant = new IssuedFileGrant("0123456789abcdef0123456789abcdef", "report.pdf", "application/pdf", 2048);

    expect([grant.grant, grant.name, grant.mediaType, grant.size]).toEqual(["0123456789abcdef0123456789abcdef", "report.pdf", "application/pdf", 2048]);
  });
});
