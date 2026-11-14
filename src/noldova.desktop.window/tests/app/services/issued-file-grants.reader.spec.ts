/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";

import { IssuedFileGrant } from "../../../src/app/models/issued-file-grant";
import { IssuedFileGrants } from "../../../src/app/models/issued-file-grants";
import { IssuedFileGrantsReader } from "../../../src/app/services/issued-file-grants.reader";

describe("IssuedFileGrantsReader", () => {
  it("reads each granted file and each refused name, in order", () => {
    const grants = IssuedFileGrantsReader.read({
      granted: [
        { grant: "0123456789abcdef0123456789abcdef", name: "notes.md", mediaType: "text/markdown", size: 120 },
        { grant: "fedcba9876543210fedcba9876543210", name: "photo.png", mediaType: "image/png", size: 4096 }
      ],
      refused: ["secret.key"]
    });

    expect(grants).toEqual(new IssuedFileGrants([
      new IssuedFileGrant("0123456789abcdef0123456789abcdef", "notes.md", "text/markdown", 120),
      new IssuedFileGrant("fedcba9876543210fedcba9876543210", "photo.png", "image/png", 4096)
    ], ["secret.key"]));
  });

  it("reads an answer with nothing granted or refused as empty lists", () => {
    const grants = IssuedFileGrantsReader.read({ granted: [], refused: [] });

    expect([grants.files, grants.refused]).toEqual([[], []]);
  });

  it("reads null, a choice the person cancelled, as no grants", () => {
    expect(IssuedFileGrantsReader.read(null)).toBe(IssuedFileGrants.none);
  });

  it("refuses an answer that is not an object, misses a list or holds a grant of the wrong form", () => {
    const answers: unknown[] = [
      "granted",
      { refused: [] },
      { granted: [] },
      { granted: [{ grant: "0123456789abcdef0123456789abcdef", name: "notes.md", mediaType: "text/markdown", size: 1.5 }], refused: [] },
      { granted: [{ grant: "0123456789abcdef0123456789abcdef", name: "notes.md", size: 120 }], refused: [] }
    ];

    for (const answer of answers)
      expect(() => IssuedFileGrantsReader.read(answer)).toThrow(JsonException);
  });
});
