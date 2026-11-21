/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { generateKeyPairSync, verify } from "node:crypto";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { UpdateSignature } from "../../../src/models/release/update-signature.js";

@TestClass
export class UpdateSignatureTests {
  private static readonly KEYS_INVALID: string =
    "LINUX_UPDATE_PUBLIC_KEYS must list distinct Ed25519 public keys, each the base64 of its DER SubjectPublicKeyInfo, separated by spaces or lines.";
  private static readonly KEY_INVALID: string = "LINUX_UPDATE_SIGNING_KEY must be an Ed25519 private key in PKCS #8 PEM, so it is not shown here.";

  @TestMethod
  public signsTheVersionTargetNameAndHashSoAnyListedKeyVerifiesIt(): void {
    const [signer, other] = [generateKeyPairSync("ed25519"), generateKeyPairSync("ed25519")];
    const key = UpdateSignature.readPrivateKey(signer.privateKey.export({ type: "pkcs8", format: "pem" }).toString());
    const shipped = UpdateSignature.formatPublicKey(key);
    const keys = UpdateSignature.readPublicKeys(`  ${UpdateSignature.formatPublicKey(other.privateKey)}\n${shipped}\n`);
    const message = UpdateSignature.formatMessage("1.2.3", "linux-x64", "App-1.2.3-linux-x64.AppImage", "c2hhNTEy");

    const signature = UpdateSignature.sign(key, message);

    Assert.areEqual("noldova-desktop-update/1\n1.2.3\nlinux-x64\nApp-1.2.3-linux-x64.AppImage\nc2hhNTEy\n", message.toString("utf8"));
    Assert.areEqual(shipped, signer.publicKey.export({ type: "spki", format: "der" }).toString("base64"));
    Assert.areEqual(2, keys.length);
    Assert.isTrue(verify(null, message, signer.publicKey, Buffer.from(signature, "base64")));
    Assert.isTrue(UpdateSignature.isSignedByOneOf(keys, message, signature));
    Assert.isFalse(UpdateSignature.isSignedByOneOf([keys[0] ?? String.empty], message, signature));
    Assert.isFalse(UpdateSignature.isSignedByOneOf(keys, UpdateSignature.formatMessage("1.2.4", "linux-x64", "App-1.2.3-linux-x64.AppImage", "c2hhNTEy"), signature));
    Assert.isFalse(UpdateSignature.isSignedByOneOf(keys, message, UpdateSignatureTests.respell(signature)));
    Assert.isFalse(UpdateSignature.isSignedByOneOf(keys, message, signature.slice(0, 40)));
    Assert.isFalse(UpdateSignature.isSignedByOneOf(keys, message, String.empty));
  }

  @TestMethod
  public refusesPublicKeysThatAreNotADistinctListOfEd25519Keys(): void {
    const key = UpdateSignature.formatPublicKey(generateKeyPairSync("ed25519").privateKey);
    const rsa = generateKeyPairSync("rsa", { modulusLength: 1024 }).publicKey.export({ type: "spki", format: "der" }).toString("base64");

    for (const text of [String.empty, " \n", `${key} ${key}`, "key", "AAAA", rsa, key.slice(0, -1)])
      Assert.areEqual(UpdateSignatureTests.KEYS_INVALID, Assert.throws(() => UpdateSignature.readPublicKeys(text), BuildException).message, text);
  }

  @TestMethod
  public refusesASigningKeyThatIsNotAnEd25519PrivateKeyWithoutShowingIt(): void {
    const rsa = generateKeyPairSync("rsa", { modulusLength: 1024 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();

    const unreadable = Assert.throws(() => UpdateSignature.readPrivateKey("the key"), BuildException);
    const other = Assert.throws(() => UpdateSignature.readPrivateKey(rsa), BuildException);

    Assert.areEqual(UpdateSignatureTests.KEY_INVALID, unreadable.message);
    Assert.isDefined(unreadable.cause);
    Assert.areEqual(UpdateSignatureTests.KEY_INVALID, other.message);
  }

  private static respell(signature: string): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    return `${signature.slice(0, -3)}${alphabet.charAt(alphabet.indexOf(signature.charAt(signature.length - 3)) + 1)}==`;
  }
}
