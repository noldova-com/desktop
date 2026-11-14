/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { DiagnosticRedactor, RuntimeBuild } from "@noldova/desktop.runtime";

import type { IClipboardHost } from "../interfaces/i-clipboard-host.js";
import { Resources } from "../resources.js";
import type { OpenWindow } from "./open-window.js";

export class ClipboardCopier {
  private readonly clipboard: IClipboardHost;
  private readonly redactor: DiagnosticRedactor;
  private readonly dataFolder: string;
  private readonly log: (text: string) => void;
  private readonly copyingImages: WeakSet<OpenWindow> = new WeakSet();

  public constructor(clipboard: IClipboardHost, homeFolder: string, dataFolder: string, log: (text: string) => void) {
    this.clipboard = clipboard;
    this.redactor = new DiagnosticRedactor(homeFolder, [Resources.applicationName]);
    this.dataFolder = dataFolder;
    this.log = log;
  }

  public copyTextFrom(open: OpenWindow | null, text: unknown): boolean {
    if (!Object.isNull(open))
      return this.copyText(text);
    this.log(Resources.textCopyUntrusted);
    return false;
  }

  public copyDetailsFrom(open: OpenWindow | null, text: unknown): boolean {
    if (Object.isNull(open) || !Object.isString(text))
      return false;
    const identity = RuntimeBuild.identity;
    const details = this.redactor.redact([Resources.formatDataFolderDetails(this.dataFolder), text].join(Resources.lineBreak));
    return this.copyText([Resources.formatBuildDetails(identity.productVersion, identity.fingerprint), details].join(Resources.lineBreak));
  }

  public async copyImageAsync(open: OpenWindow | null, bytes: unknown): Promise<boolean> {
    if (Object.isNull(open)) {
      this.log(Resources.imageCopyUntrusted);
      return false;
    }
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > Resources.imageCopyByteLimit || !ClipboardCopier.isCopiablePng(bytes)) {
      this.log(Resources.imageCopyRefused);
      return false;
    }
    if (this.copyingImages.has(open)) {
      this.log(Resources.imageCopyBusy);
      return false;
    }
    this.copyingImages.add(open);
    try {
      if (await this.clipboard.writeImageAsync(bytes))
        return true;
      this.log(Resources.imageCopyUndecoded);
      return false;
    }
    catch (error) {
      this.log(Resources.formatImageNotCopied(String(error)));
      return false;
    }
    finally {
      this.copyingImages.delete(open);
    }
  }

  private copyText(text: unknown): boolean {
    if (!Object.isString(text) || text.length > Resources.copyTextLimit) {
      this.log(Resources.textCopyRefused);
      return false;
    }
    this.clipboard.writeText(text);
    return true;
  }

  private static isCopiablePng(bytes: Uint8Array): boolean {
    if (bytes.byteLength < Resources.pngHeaderLength || !Resources.pngSignature.every((t, i) => bytes[i] === t))
      return false;
    const header = new DataView(bytes.buffer, bytes.byteOffset);
    const width = header.getUint32(Resources.pngWidthOffset);
    const height = header.getUint32(Resources.pngHeightOffset);
    return width > 0 && height > 0 && width <= Resources.imageCopySideLimit && height <= Resources.imageCopySideLimit &&
      width * height <= Resources.imageCopyPixelLimit;
  }
}
