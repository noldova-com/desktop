/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { KeyObject } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";

import type { IPackageSigning } from "../../interfaces/i-package-signing.ts";
import type { PackageTarget } from "../../models/packaging/package-target.ts";
import { PackageDigest } from "../../models/release/package-digest.ts";
import { UpdateSignature } from "../../models/release/update-signature.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class LinuxSigning implements IPackageSigning {
  private readonly key: KeyObject;
  private readonly file: string;
  private readonly target: PackageTarget;
  private readonly version: string;

  public readonly builderEnvironment: NodeJS.ProcessEnv = {};
  public readonly windowsPublisher: string | null = null;
  public readonly updateKeys: readonly string[];

  public constructor(credentials: NodeJS.ProcessEnv, target: PackageTarget, version: string, file: string) {
    const missing = Resources.linuxSigningCredentials.filter(t => (credentials[t] ?? String.empty).length === 0);
    if (missing.length > 0)
      throw new BuildException(Resources.formatLinuxSigningCredentialsMissing(missing));
    this.key = UpdateSignature.readPrivateKey(String(credentials[Resources.linuxSigningKeyVariable]));
    this.updateKeys = UpdateSignature.readPublicKeys(String(credentials[Resources.linuxUpdateKeysVariable]));
    if (!this.updateKeys.includes(UpdateSignature.formatPublicKey(this.key)))
      throw new BuildException(Resources.linuxSigningKeyNotShipped);
    this.target = target;
    this.version = version;
    this.file = file;
  }

  public static async readAsync(file: string): Promise<ReadonlyMap<string, string>> {
    let signatures: Readonly<Record<string, unknown>>;
    try {
      signatures = JsonReader.parse(await readFile(file, Resources.textEncoding)).toJson();
    }
    catch (error) {
      throw new BuildException(Resources.formatUpdateSignaturesUnreadable(file, error), new ExceptionOptions(error));
    }
    return new Map(Object.entries(signatures).filter((t): t is [string, string] => Object.isString(t[1])));
  }

  public prepareAsync(): Promise<void> {
    return Promise.resolve();
  }

  public async finishAsync(packages: readonly string[]): Promise<string> {
    const signatures: Record<string, string> = {};
    for (const file of packages) {
      const name = path.basename(file);
      signatures[name] = UpdateSignature.sign(this.key, UpdateSignature.formatMessage(this.version, this.target.id, name, (await PackageDigest.readAsync(file)).sha512));
    }
    await writeFile(this.file, Resources.formatJsonFile(signatures));
    return Resources.formatLinuxPackagesSigned(packages.map(t => path.basename(t)));
  }

  public async verifyAsync(packages: readonly string[]): Promise<string> {
    const signatures = await LinuxSigning.readAsync(this.file);
    for (const file of packages) {
      const name = path.basename(file);
      const message = UpdateSignature.formatMessage(this.version, this.target.id, name, (await PackageDigest.readAsync(file)).sha512);
      if (!UpdateSignature.isSignedByOneOf(this.updateKeys, message, signatures.get(name) ?? String.empty))
        throw new BuildException(Resources.formatLinuxSignatureInvalid(name));
    }
    return Resources.formatLinuxSignaturesVerified(packages.map(t => path.basename(t)));
  }

  public disposeAsync(): Promise<void> {
    return Promise.resolve();
  }
}
