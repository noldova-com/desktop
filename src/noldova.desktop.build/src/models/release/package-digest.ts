/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { finished } from "node:stream/promises";

import { Resources } from "../../resources.ts";

export class PackageDigest {
  public readonly sha256: string;
  public readonly sha512: string;
  public readonly size: number;

  public constructor(sha256: string, sha512: string, size: number) {
    this.sha256 = sha256;
    this.sha512 = sha512;
    this.size = size;
  }

  public static fromBytes(bytes: Buffer): PackageDigest {
    return new PackageDigest(createHash(Resources.checksumAlgorithm).update(bytes).digest(Resources.checksumDigestEncoding),
      createHash(Resources.integrityAlgorithm).update(bytes).digest(Resources.integrityDigestEncoding), bytes.length);
  }

  public static async readAsync(file: string): Promise<PackageDigest> {
    const sha256 = createHash(Resources.checksumAlgorithm);
    const sha512 = createHash(Resources.integrityAlgorithm);
    let size = 0;
    const stream = createReadStream(file);
    stream.on(Resources.dataEvent, t => {
      sha256.update(t);
      sha512.update(t);
      size += Buffer.byteLength(t);
    });
    await finished(stream);
    return new PackageDigest(sha256.digest(Resources.checksumDigestEncoding), sha512.digest(Resources.integrityDigestEncoding), size);
  }
}
