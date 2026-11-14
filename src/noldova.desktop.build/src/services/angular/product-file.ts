/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { ProductIdentity } from "../../models/packages/product-identity.ts";
import { AboutLogo } from "./about-logo.ts";
import { Resources } from "../../resources.ts";

export class ProductFile {
  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public get file(): string {
    return path.join(this.root, ...Resources.productFileSegments);
  }

  public async writeAsync(): Promise<void> {
    const product = await ProductIdentity.readAsync(this.root);
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(this.file, [
      Resources.licenseHeaderBlock,
      Resources.productAboutTypeImport,
      String.empty,
      Resources.formatProductNameLine(product.name),
      Resources.formatProductAboutLine({ ...product.about.toJson(), logo: AboutLogo.of(this.root, product)?.toJson() ?? null }),
      String.empty
    ].join(Resources.lineSeparator));
  }
}
