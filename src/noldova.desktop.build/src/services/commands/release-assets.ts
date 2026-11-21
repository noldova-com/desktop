/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";

import { BuildException } from "../../exceptions/build.exception.ts";
import { ProductIdentity } from "../../models/packages/product-identity.ts";
import { RootManifest } from "../../models/packages/root-manifest.ts";
import { PackageLayout } from "../packaging/package-layout.ts";
import { PackageTarget } from "../../models/packaging/package-target.ts";
import { UpdateSignature } from "../../models/release/update-signature.ts";
import { LinuxSigning } from "../packaging/linux-signing.ts";
import { ReleaseFileSet } from "../release/release-file-set.ts";
import { UpdateFeed } from "../packages/update-feed.ts";
import { Resources } from "../../resources.ts";

export class ReleaseAssets {
  private readonly root: string;
  private readonly platform: string;
  private readonly architecture: string;
  private readonly output: Writable;

  public constructor(root: string, platform: string, architecture: string, output: Writable) {
    this.root = root;
    this.platform = platform;
    this.architecture = architecture;
    this.output = output;
  }

  public async runAsync(assetArguments: readonly string[]): Promise<number> {
    const [option, feed, ...rest] = assetArguments;
    if (!Object.isUndefined(option) && (option !== Resources.updateFeedOption || Object.isUndefined(feed) || !UpdateFeed.isValid(feed) || rest.length > 0)) {
      this.output.write(Resources.releaseAssetsUsage);
      return Resources.usageExitCode;
    }
    try {
      const manifest = await RootManifest.readAsync(this.root);
      const product = await ProductIdentity.readAsync(this.root);
      const target = PackageTarget.fromProcess(this.platform, this.architecture).withInstallFolder(product.installFolder);
      const layout = new PackageLayout(this.root);
      const packaged = await ReleaseAssets.readProductAsync(layout.stagedProduct, feed ?? product.updateFeed);
      const keys = ReleaseAssets.readUpdateKeys(packaged);
      const signatures = keys.length === 0 ? new Map<string, string>() : await LinuxSigning.readAsync(layout.updateSignatures);
      const names = await new ReleaseFileSet(product.name, manifest.productVersion, [target]).writeAsync(layout.output, target, new Date().toISOString(),
        t => ReleaseAssets.check(keys, signatures, UpdateSignature.formatMessage(manifest.productVersion, target.id, t.name, t.digest.sha512), t.name));
      this.output.write(Resources.formatReleaseFiles(target.platform, target.architecture, manifest.productVersion, names));
      return 0;
    }
    catch (error) {
      if (!(error instanceof BuildException))
        throw error;
      this.output.write(Resources.formatOutputLine(error.message));
      return Resources.failureExitCode;
    }
  }

  private static async readProductAsync(file: string, expected: string): Promise<JsonReader> {
    let product: JsonReader;
    try {
      product = JsonReader.parse(await readFile(file, Resources.textEncoding));
    }
    catch (error) {
      throw new BuildException(Resources.formatPackagedProductUnreadable(file, error), new ExceptionOptions(error));
    }
    const feed = product.hasField(Resources.productUpdateFeedField) ? product.readValue(Resources.productUpdateFeedField) : undefined;
    if (feed !== expected)
      throw new BuildException(Resources.formatPackagedFeedMismatch(feed, expected));
    return product;
  }

  private static readUpdateKeys(product: JsonReader): readonly string[] {
    if (!product.hasField(Resources.productLinuxUpdateKeysField))
      return [];
    const keys = product.readValue(Resources.productLinuxUpdateKeysField);
    if (!Array.isArray(keys) || !keys.every(t => Object.isString(t)))
      throw new BuildException(Resources.packagedUpdateKeysInvalid);
    return UpdateSignature.readPublicKeys(keys.join(Resources.lineSeparator));
  }

  private static check(keys: readonly string[], signatures: ReadonlyMap<string, string>, message: Buffer, name: string): string | null {
    if (keys.length === 0)
      return null;
    const signature = signatures.get(name) ?? String.empty;
    if (!UpdateSignature.isSignedByOneOf(keys, message, signature))
      throw new BuildException(Resources.formatLinuxSignatureInvalid(name));
    return signature;
  }
}
