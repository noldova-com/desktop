/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import { BuildException } from "../../src/noldova.desktop.build/src/exceptions/build.exception.ts";
import type { ProductIdentity } from "../../src/noldova.desktop.build/src/models/packages/product-identity.ts";
import type { SourceFile } from "../structure/source-file.ts";
import { SourceScanner } from "../../src/noldova.desktop.build/src/services/structure/source-scanner.ts";
import type { SourceTree } from "../structure/source-tree.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class ProductIdentityCheck implements ICheck {
  private readonly tree: SourceTree;
  private readonly readProductAsync: () => Promise<ProductIdentity>;

  public readonly title: string = Resources.productIdentityCheckTitle;

  public constructor(tree: SourceTree, readProductAsync: () => Promise<ProductIdentity>) {
    this.tree = tree;
    this.readProductAsync = readProductAsync;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    let product: ProductIdentity;
    try {
      product = await this.readProductAsync();
    }
    catch (error) {
      if (!(error instanceof BuildException))
        throw error;
      output.write(`${error.message}${Resources.lineEnd}`);
      return false;
    }

    const patterns = ProductIdentityCheck.listLiterals(product).map(t => [t, new RegExp(Resources.formatProductIdentityPattern(t), Resources.productIdentityPatternFlags)] as const);
    const files = (await this.tree.readAsync()).files.filter(t => t.isProduction && Resources.productIdentityShellPrefixes.some(u => t.path.startsWith(u)));
    const findings = files.flatMap(t => ProductIdentityCheck.findIdentity(t, patterns));
    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.formatProductIdentityChecked(files.length));
    return findings.length === 0;
  }

  private static listLiterals(product: ProductIdentity): readonly string[] {
    return [...new Set([
      product.name,
      product.applicationId,
      product.developmentApplicationId,
      product.dataFolder,
      product.windowsDeviceFolder,
      product.macosDeviceFolder,
      product.linuxDeviceFolder,
      product.dataDirectoryVariable,
      product.icons
    ])];
  }

  private static findIdentity(file: SourceFile, patterns: readonly (readonly [string, RegExp])[]): readonly string[] {
    return ProductIdentityCheck.readTexts(file).flatMap(([text, line]) => {
      const matches = patterns.flatMap(([value, pattern]) => [...text.matchAll(pattern)].map(t => ({ value, start: t.index, end: t.index + value.length })));
      return matches
        .filter(t => !matches.some(u => u !== t && u.start <= t.start && u.end >= t.end && u.end - u.start > t.end - t.start))
        .sort((first, second) => first.start - second.start)
        .map(t => Resources.formatProductIdentityFinding(file.formatLocation(line), t.value));
    });
  }

  private static readTexts(file: SourceFile): readonly (readonly [string, number])[] {
    if (!file.isScript && !file.isJson)
      return file.text.split(Resources.lineEnd).map((t, index) => [t, index + 1] as const);
    const source = new SourceScanner(file.text).scan();
    return [...source.selectors, ...source.texts].sort((first, second) => first.line - second.line).map(t => [t.value, t.line] as const);
  }
}
