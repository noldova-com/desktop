/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { QualifiedName } from "@noldova/desktop.protocol";

@TestClass
export class QualifiedNameTests {
  @TestMethod
  @TestData("desktop.handshake", "desktop", "handshake", true)
  @TestData("notes.capture", "notes", "capture", false)
  @TestData("work-items.listOpen2", "work-items", "listOpen2", false)
  public parsesAValidName(text: string, owner: string, member: string, isShell: boolean): void {
    const name = QualifiedName.parse(text);

    Assert.areEqual(owner, name.owner);
    Assert.areEqual(member, name.member);
    Assert.areEqual(text, name.text);
    Assert.areEqual(text, name.toString());
    Assert.areEqual(isShell, name.isShell);
  }

  @TestMethod
  @TestData("desktop")
  @TestData(".handshake")
  @TestData("desktop.")
  @TestData("Shell.handshake")
  @TestData("desktop.Handshake")
  @TestData("desktop.hand-shake")
  @TestData("desktop.handshake.extra")
  @TestData("1st.handshake")
  @TestData("work--items.list")
  @TestData("work-items-.list")
  @TestData("desktop.hand shake")
  public rejectsAnInvalidName(text: string): void {
    const failure = Assert.throws(() => QualifiedName.parse(text, "method"), ArgumentException);

    Assert.areEqual("method", failure.parameterName);
  }

  @TestMethod
  public findsANameWithoutThrowing(): void {
    Assert.areEqual("work-items.listOpen2", QualifiedName.find("work-items.listOpen2")?.text);
    for (const text of ["desktop", ".handshake", "desktop.", "Shell.handshake", "desktop.handshake.extra"])
      Assert.isNull(QualifiedName.find(text), text);
  }

  @TestMethod
  public reportsTheNameParameterByDefault(): void {
    Assert.areEqual("name", Assert.throws(() => new QualifiedName("desktop", "Bad"), ArgumentException).parameterName);
    Assert.areEqual("text", Assert.throws(() => QualifiedName.parse("bad"), ArgumentException).parameterName);
  }

  @TestMethod
  public comparesByText(): void {
    Assert.isTrue(new QualifiedName("desktop", "handshake").equals(QualifiedName.parse("desktop.handshake")));
    Assert.isFalse(new QualifiedName("desktop", "handshake").equals(QualifiedName.parse("desktop.cancel")));
  }
}
