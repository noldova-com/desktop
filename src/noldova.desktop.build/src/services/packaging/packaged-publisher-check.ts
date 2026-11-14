/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";
import { JsonReader, type JsonValue } from "@noldova/context.json";

import { AsarArchive } from "./asar-archive.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class PackagedPublisherCheck {
  public static async verifyAsync(archive: string, publisher: string | null): Promise<string> {
    const text = await AsarArchive.readTextAsync(archive, Resources.packageStagedProductSegments);
    const product = path.join(archive, ...Resources.packageStagedProductSegments);
    const value = Object.isNull(text) ? undefined : PackagedPublisherCheck.readField(text);
    if (Object.isUndefined(value))
      throw new BuildException(Resources.formatPublisherFieldMissing(product));
    if (!Object.isNull(value) && !Object.isString(value))
      throw new BuildException(Resources.formatPublisherNotText(product));
    if (Object.isNull(publisher) && !Object.isNull(value))
      throw new BuildException(Resources.formatPublisherUnexpected(product));
    if (!Object.isNull(publisher) && Object.isNull(value))
      throw new BuildException(Resources.formatPublisherMissing(product));
    if (value !== publisher)
      throw new BuildException(Resources.formatPublisherDiffers(product));
    return Object.isNull(publisher)
      ? Resources.publisherNoneVerified
      : Resources.publisherMatchVerified;
  }

  private static readField(text: string): JsonValue | undefined {
    try {
      const product = JsonReader.parse(text);
      return product.hasField(Resources.productWindowsPublisherField) ? product.readValue(Resources.productWindowsPublisherField) : undefined;
    }
    catch {
      return undefined;
    }
  }
}
