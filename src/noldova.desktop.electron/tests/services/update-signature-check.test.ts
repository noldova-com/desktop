/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash, generateKeyPairSync, type KeyObject, sign } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { UpdateInfo } from "electron-updater";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateSignatureCheck } from "@noldova/desktop.electron";

@TestClass
export class UpdateSignatureCheckTests {
  private static readonly NAME: string = "Noldova Desktop Sample-1.3.0-linux-x64.AppImage";
  private static readonly CONTENT: string = "Noldova Desktop Sample 1.3.0";

  @TestMethod
  public async passesASignatureByAnyShippedKeyOverTheVersionTargetNameAndHashAndRecordsHowLongItTook(): Promise<void> {
    await UpdateSignatureCheckTests.withFileAsync(async file => {
      const [first, second] = [UpdateSignatureCheckTests.createKeys(), UpdateSignatureCheckTests.createKeys()];
      const lines: string[] = [];
      let time = 1000;
      const check = new UpdateSignatureCheck([first.shipped, second.shipped], "linux", "x64", t => lines.push(t), () => (time += 7));
      const info = UpdateSignatureCheckTests.describe(UpdateSignatureCheckTests.sign(second.key, "1.3.0", "linux-x64"));

      const failure = await check.checkAsync(file, info);

      Assert.isNull(failure);
      Assert.areEqual("The update's signature check passed in 7 ms.", lines.join("|"));
    });
  }

  @TestMethod
  public async failsAnUpdateThisBuildCannotTrustAndSaysWhy(): Promise<void> {
    await UpdateSignatureCheckTests.withFileAsync(async file => {
      const [shipped, other] = [UpdateSignatureCheckTests.createKeys(), UpdateSignatureCheckTests.createKeys()];
      const lines: string[] = [];
      const check = new UpdateSignatureCheck([shipped.shipped], "linux", "x64", t => lines.push(t), () => 0);
      const valid = UpdateSignatureCheckTests.sign(shipped.key, "1.3.0", "linux-x64");
      const cases: readonly (readonly [UpdateSignatureCheck, UpdateInfo | null, string])[] = [
        [new UpdateSignatureCheck([], "linux", "x64", () => undefined, () => 0), UpdateSignatureCheckTests.describe(valid),
          "this build is unsigned, so it has no key to check the update's signature against"],
        [check, null, "the update's information lists no such file"],
        [check, { ...UpdateSignatureCheckTests.describe(valid), files: [] }, "the update's information lists no such file"],
        [check, UpdateSignatureCheckTests.describe(null), "the update's information carries no signature for it"],
        [check, UpdateSignatureCheckTests.describe(String.empty), "the update's information carries no signature for it"],
        [check, UpdateSignatureCheckTests.describe(5), "the update's information carries no signature for it"],
        [check, UpdateSignatureCheckTests.describe(valid, "other"), "its SHA-512 differs from the update's information"],
        [check, UpdateSignatureCheckTests.describe(UpdateSignatureCheckTests.sign(other.key, "1.3.0", "linux-x64")), "its signature is not by a key this build ships"],
        [check, UpdateSignatureCheckTests.describe(UpdateSignatureCheckTests.sign(shipped.key, "1.2.0", "linux-x64")), "its signature is not by a key this build ships"],
        [check, UpdateSignatureCheckTests.describe(UpdateSignatureCheckTests.sign(shipped.key, "1.3.0", "linux-arm64")), "its signature is not by a key this build ships"],
        [check, UpdateSignatureCheckTests.describe(UpdateSignatureCheckTests.respell(valid)), "its signature is not by a key this build ships"],
        [check, UpdateSignatureCheckTests.describe(valid.slice(0, 40)), "its signature is not by a key this build ships"]
      ];

      const failures: (string | null)[] = [];
      for (const [checker, info] of cases)
        failures.push(await checker.checkAsync(file, info));
      const broken = await new UpdateSignatureCheck(["not a key"], "linux", "x64", () => undefined, () => 0).checkAsync(file, UpdateSignatureCheckTests.describe(valid));

      Assert.areEqual(JSON.stringify(cases.map(t => t[2])), JSON.stringify(failures));
      Assert.isTrue(broken?.startsWith("its signature could not be checked: ") === true, String(broken));
      Assert.areEqual(cases.length - 1, lines.filter(t => t === "The update's signature check failed in 0 ms.").length);
    });
  }

  private static createKeys(): { readonly key: KeyObject; readonly shipped: string } {
    const pair = generateKeyPairSync("ed25519");
    return { key: pair.privateKey, shipped: pair.publicKey.export({ type: "spki", format: "der" }).toString("base64") };
  }

  private static sign(key: KeyObject, version: string, target: string): string {
    const sha512 = createHash("sha512").update(UpdateSignatureCheckTests.CONTENT).digest("base64");
    const message = `noldova-desktop-update/1\n${version}\n${target}\n${UpdateSignatureCheckTests.NAME}\n${sha512}\n`;
    return sign(null, Buffer.from(message, "utf8"), key).toString("base64");
  }

  private static respell(signature: string): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    return `${signature.slice(0, -3)}${alphabet.charAt(alphabet.indexOf(signature.charAt(signature.length - 3)) + 1)}==`;
  }

  private static describe(signature: unknown, sha512: string = createHash("sha512").update(UpdateSignatureCheckTests.CONTENT).digest("base64")): UpdateInfo {
    const entry = { url: UpdateSignatureCheckTests.NAME, sha512, size: 28, signature };
    return {
      version: "1.3.0",
      files: [{ url: "Noldova Desktop Sample-1.3.0-linux-x64.deb", sha512, size: 28 }, entry],
      path: UpdateSignatureCheckTests.NAME,
      sha512,
      releaseDate: "2026-11-20T00:00:00.000Z"
    };
  }

  private static async withFileAsync(action: (file: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "update-signature-"));
    try {
      const file = path.join(folder, UpdateSignatureCheckTests.NAME);
      await writeFile(file, UpdateSignatureCheckTests.CONTENT);
      await action(file);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
