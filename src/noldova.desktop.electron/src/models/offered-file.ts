/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class OfferedFile {
  public readonly name: string;
  public readonly mediaType: string;
  public readonly path: string | null;
  public readonly bytes: Uint8Array | null;
  public readonly size: number;

  public constructor(name: string, mediaType: string, filePath: string | null, bytes: Uint8Array | null, size: number) {
    this.name = name;
    this.mediaType = mediaType;
    this.path = filePath;
    this.bytes = bytes;
    this.size = size;
  }

  public static ofPath(filePath: string): OfferedFile {
    return new OfferedFile(path.basename(filePath), Resources.unknownMediaType, filePath, null, 0);
  }

  public static read(value: unknown): OfferedFile | null {
    if (!Object.isObject(value) || Array.isArray(value))
      return null;
    const name = Resources.nameField in value ? value[Resources.nameField] : undefined;
    const type = Resources.typeField in value ? value[Resources.typeField] : undefined;
    const filePath = Resources.pathField in value ? value[Resources.pathField] : undefined;
    const bytes = Resources.bytesField in value ? value[Resources.bytesField] : undefined;
    const size = Resources.sizeField in value ? value[Resources.sizeField] : undefined;
    if (!Object.isString(name) || !Object.isString(type) || !Object.isNumber(size) || !Number.isSafeInteger(size) || size < 0)
      return null;
    const mediaType = Resources.mediaTypePattern.test(type) ? type.toLowerCase() : Resources.unknownMediaType;
    if (Object.isString(filePath) && path.isAbsolute(filePath) && Object.isUndefined(bytes))
      return new OfferedFile(OfferedFile.nameOf(name, path.basename(filePath)), mediaType, filePath, null, size);
    if (bytes instanceof Uint8Array && Object.isUndefined(filePath) && bytes.byteLength === size)
      return new OfferedFile(OfferedFile.nameOf(name, Resources.pastedFileName), mediaType, null, bytes, size);
    if (Object.isUndefined(filePath) && Object.isUndefined(bytes))
      return new OfferedFile(OfferedFile.nameOf(name, Resources.pastedFileName), mediaType, null, null, size);
    return null;
  }

  private static nameOf(name: string, fallback: string): string {
    return String.isNullOrWhitespace(name) || Buffer.byteLength(name) > Resources.fileNameByteLimit ? fallback : name;
  }
}
