/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash, generateKeyPairSync, type KeyObject, verify } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { LinuxSigning } from "../../../src/services/packaging/linux-signing.js";

interface IKeyPair {
  readonly privateKey: KeyObject;
  readonly publicKey: KeyObject;
}

@TestClass
export class LinuxSigningTests {
  private static readonly TARGET: PackageTarget = PackageTarget.fromProcess("linux", "arm64");

  @TestMethod
  public async signsEachPackageForTheUpdateFeedAndChecksItsSignaturesAsync(): Promise<void> {
    await LinuxSigningTests.withFolderAsync(async folder => {
      const [signer, next] = [generateKeyPairSync("ed25519"), generateKeyPairSync("ed25519")];
      const signatures = path.join(folder, "update-signatures.json");
      const packages = [path.join(folder, "App-1.2.3-linux-arm64.AppImage"), path.join(folder, "App-1.2.3-linux-arm64.deb")];
      await writeFile(packages[0] ?? String.empty, "image");
      await writeFile(packages[1] ?? String.empty, "debian");
      const signing = new LinuxSigning(LinuxSigningTests.credentials(signer, [next, signer]), LinuxSigningTests.TARGET, "1.2.3", signatures);

      const signed = await signing.finishAsync(packages);
      const checked = await signing.verifyAsync(packages);
      const written = await LinuxSigning.readAsync(signatures);
      const message = `noldova-desktop-update/1\n1.2.3\nlinux-arm64\nApp-1.2.3-linux-arm64.deb\n${createHash("sha512").update("debian").digest("base64")}\n`;

      Assert.areEqual("Signed App-1.2.3-linux-arm64.AppImage, App-1.2.3-linux-arm64.deb for the update feed.\n", signed);
      Assert.areEqual("Each of App-1.2.3-linux-arm64.AppImage, App-1.2.3-linux-arm64.deb carries a valid signature by a key the app ships.", checked);
      Assert.areEqual(JSON.stringify([LinuxSigningTests.publicKey(next), LinuxSigningTests.publicKey(signer)]), JSON.stringify(signing.updateKeys));
      Assert.areEqual("App-1.2.3-linux-arm64.AppImage,App-1.2.3-linux-arm64.deb", [...written.keys()].join());
      Assert.isTrue(verify(null, Buffer.from(message), signer.publicKey, Buffer.from(written.get("App-1.2.3-linux-arm64.deb") ?? String.empty, "base64")));
      Assert.areEqual(0, Object.keys(signing.builderEnvironment).length);
      Assert.isNull(signing.windowsPublisher);
      await signing.prepareAsync();
      await signing.disposeAsync();
    });
  }

  @TestMethod
  public async refusesAPackageChangedAfterItsSignatureOrNotSignedAsync(): Promise<void> {
    await LinuxSigningTests.withFolderAsync(async folder => {
      const signer = generateKeyPairSync("ed25519");
      const image = path.join(folder, "App-1.2.3-linux-arm64.AppImage");
      const debian = path.join(folder, "App-1.2.3-linux-arm64.deb");
      await writeFile(image, "image");
      await writeFile(debian, "debian");
      const signing = new LinuxSigning(LinuxSigningTests.credentials(signer, [signer]), LinuxSigningTests.TARGET, "1.2.3", path.join(folder, "update-signatures.json"));
      await signing.finishAsync([image]);

      const unsigned = await Assert.throwsAsync(() => signing.verifyAsync([image, debian]), BuildException);
      await writeFile(image, "changed");
      const changed = await Assert.throwsAsync(() => signing.verifyAsync([image]), BuildException);

      Assert.areEqual("App-1.2.3-linux-arm64.deb carries no valid signature by a key the app ships.", unsigned.message);
      Assert.areEqual("App-1.2.3-linux-arm64.AppImage carries no valid signature by a key the app ships.", changed.message);
    });
  }

  @TestMethod
  public refusesMissingCredentialsOrASigningKeyTheAppDoesNotShip(): void {
    const [signer, other] = [generateKeyPairSync("ed25519"), generateKeyPairSync("ed25519")];

    const missing = Assert.throws(() => new LinuxSigning({ LINUX_UPDATE_SIGNING_KEY: String.empty }, LinuxSigningTests.TARGET, "1.2.3", "signatures.json"), BuildException);
    const unshipped = Assert.throws(() => new LinuxSigning(LinuxSigningTests.credentials(signer, [other]), LinuxSigningTests.TARGET, "1.2.3", "signatures.json"), BuildException);

    Assert.areEqual("Signing Linux packages needs LINUX_UPDATE_SIGNING_KEY, LINUX_UPDATE_PUBLIC_KEYS, the Ed25519 key that signs the update packages and the public keys the app ships.",
      missing.message);
    Assert.areEqual("The public half of LINUX_UPDATE_SIGNING_KEY is not among LINUX_UPDATE_PUBLIC_KEYS, so the packaged app would refuse its own updates; "
      + "ship the key one release before signing with it.", unshipped.message);
  }

  @TestMethod
  public async refusesSignaturesItCannotReadAndSkipsAnEntryThatIsNoSignatureAsync(): Promise<void> {
    await LinuxSigningTests.withFolderAsync(async folder => {
      const file = path.join(folder, "update-signatures.json");

      const missing = await Assert.throwsAsync(() => LinuxSigning.readAsync(file), BuildException);
      await writeFile(file, "{");
      const broken = await Assert.throwsAsync(() => LinuxSigning.readAsync(file), BuildException);
      await writeFile(file, JSON.stringify({ "App.AppImage": "c2lnbmF0dXJl", "App.deb": 5 }));
      const read = await LinuxSigning.readAsync(file);

      Assert.isTrue(missing.message.startsWith(`The update signatures ${file} could not be read as JSON: Error: ENOENT`), missing.message);
      Assert.isDefined(missing.cause);
      Assert.isTrue(broken.message.startsWith(`The update signatures ${file} could not be read as JSON: `), broken.message);
      Assert.areEqual(JSON.stringify([["App.AppImage", "c2lnbmF0dXJl"]]), JSON.stringify([...read]));
      Assert.areEqual("{\"App.AppImage\":\"c2lnbmF0dXJl\",\"App.deb\":5}", await readFile(file, "utf8"));
    });
  }

  private static credentials(signer: IKeyPair, shipped: readonly IKeyPair[]): NodeJS.ProcessEnv {
    return {
      LINUX_UPDATE_SIGNING_KEY: signer.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      LINUX_UPDATE_PUBLIC_KEYS: shipped.map(t => LinuxSigningTests.publicKey(t)).join("\n")
    };
  }

  private static publicKey(pair: IKeyPair): string {
    return pair.publicKey.export({ type: "spki", format: "der" }).toString("base64");
  }

  private static async withFolderAsync(action: (folder: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-linux-signing-"));
    try {
      await action(folder);
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }
}
