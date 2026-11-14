/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DiagnosticRedactor } from "@noldova/desktop.runtime";

@TestClass
export class DiagnosticRedactorTests {
  @TestMethod
  public showsTheHomeFolderAsATildeWithEitherSeparatorAndInAnyCase(): void {
    const redactor = new DiagnosticRedactor("C:\\Users\\Person (1)");

    Assert.areEqual(
      "~\\notes and ~/notes and ~\\x",
      redactor.redact("C:\\Users\\Person (1)\\notes and c:/users/person (1)/notes and C:/USERS\\PERSON (1)\\x"));
  }

  @TestMethod
  public showsTheHomeFolderWrittenWithDoubledBackslashesOrWithItsShortNameAsATilde(): void {
    const spaced = new DiagnosticRedactor("C:\\Users\\Person Name");
    const dotted = new DiagnosticRedactor("C:\\Users\\first.last");

    Assert.areEqual(
      "{\"path\":\"~\\\\notes\"} and ~\\x and ~\\y",
      spaced.redact("{\"path\":\"C:\\\\Users\\\\Person Name\\\\notes\"} and C:\\Users\\PERSON~1\\x and c:\\users\\person~12\\y"));
    Assert.areEqual("~\\x and C:\\Users\\FIRST~1\\y", dotted.redact("C:\\Users\\FIRST~1.LAS\\x and C:\\Users\\FIRST~1\\y"));
    Assert.areEqual("~\\x and ~\\y", new DiagnosticRedactor("C:\\Users\\J\u00fcrgen").redact("C:\\Users\\JURGEN~1\\x and C:\\Users\\J_RGEN~2\\y"));
  }

  @TestMethod
  public showsTheHomeFolderAndTheUserNamePercentEncodedInAFileUrlAsInAStackFrame(): void {
    const spaced = new DiagnosticRedactor("C:\\Users\\First Last");
    const accented = new DiagnosticRedactor("/home/j\u00fcrgen");

    Assert.areEqual(
      "at run (file:///~/app/main.js:10:5) for [redacted]",
      spaced.redact("at run (file:///C:/Users/First%20Last/app/main.js:10:5) for First%20Last"));
    Assert.areEqual(
      "at run (file://~/app/main.js:10:5) for [redacted]",
      accented.redact("at run (file:///home/j%C3%BCrgen/app/main.js:10:5) for J%c3%bcrgen"));
  }

  @TestMethod
  public leavesAFolderWhoseNameOnlyStartsWithTheHomeFolders(): void {
    const redactor = new DiagnosticRedactor("/home/al");
    const accented = new DiagnosticRedactor("/home/ale");

    Assert.areEqual(
      "/home/alice/x, /home/alé, /home/al.old, /home/al smith/x, /home/al (old)/x, /home/al_2, ~: missing, (~). ~ and ~.",
      redactor.redact("/home/alice/x, /home/alé, /home/al.old, /home/al smith/x, /home/al (old)/x, /home/al_2, /home/al: missing, (/home/al). /home/AL and /home/al."));
    Assert.areEqual("/home/ale\u0301/x and ~/x", accented.redact("/home/ale\u0301/x and /home/ale/x"));
  }

  @TestMethod
  public replacesEmailAddressesAndTheAccountsInAddresses(): void {
    const redactor = new DiagnosticRedactor("/home/person");

    Assert.areEqual(
      "mail [redacted] or [redacted]; fetch https://[redacted]@host.example/x and git+https://[redacted]@host.example/y",
      redactor.redact("mail someone@example.com or a.b+c@mail.example.org; fetch https://user:secret@host.example/x and git+https://token@host.example/y"));
    Assert.areEqual("open https://[redacted]@intranet/x", redactor.redact("open https://user:p@ss@intranet/x"));
  }

  @TestMethod
  public replacesTheUserNameOutsideTheHomeFolderButNotAGenericOrShortOne(): void {
    const redactor = new DiagnosticRedactor("/home/alice");

    Assert.areEqual(
      "D:\\[redacted]\\notes, signed in as [redacted]; alicette, [redacted]_2, [redacted]2 and ~/x",
      redactor.redact("D:\\alice\\notes, signed in as Alice; alicette, alice_2, alice2 and /home/alice/x"));
    Assert.areEqual("the runner started in ~/x", new DiagnosticRedactor("/home/runner").redact("the runner started in /home/runner/x"));
    Assert.areEqual("al and ~/x", new DiagnosticRedactor("/home/al").redact("al and /home/al/x"));
  }

  @TestMethod
  public replacesTheUserNameOfAProfileFolderWithADomainOrNumberSuffix(): void {
    const domain = new DiagnosticRedactor("C:\\Users\\person.CORP");
    const numbered = new DiagnosticRedactor("C:\\Users\\person.000");

    Assert.areEqual("signed in as [redacted] at ~\\x", domain.redact("signed in as person at C:\\Users\\person.CORP\\x"));
    Assert.areEqual("signed in as [redacted] at ~\\x", numbered.redact("signed in as Person at C:\\Users\\person.000\\x"));
    Assert.areEqual("first and ~/x", new DiagnosticRedactor("/home/first.last").redact("first and /home/first.last/x"));
  }

  @TestMethod
  public replacesATokenWhoseFirstPartIsShortOrThatHasTwoSlashes(): void {
    const redactor = new DiagnosticRedactor("/home/person");

    Assert.areEqual(
      "token [redacted], key /etc/app/[redacted] and [redacted]",
      redactor.redact("token Fak3+T0k/aB3dE5fG7hI9aB3dE5fG7hI9aB3dE5fG7==, key /etc/app/aB3dE5fG7hI9jK/lM1nO3pQ5rS7tU2/vW9xY1zA3bC5d== and aB3dE5fG7hI9jK/lM1nO3pQ5rS7tU2/vW9xY1zA3bC5d=="));
  }

  @TestMethod
  public replacesATokenWithSlashesAndKeepsThePathBeforeItAndAroundALongValue(): void {
    const redactor = new DiagnosticRedactor("/home/person");

    Assert.areEqual(
      "key /etc/app/[redacted] and hash /cache/[redacted]/x",
      redactor.redact("key /etc/app/Ab3dEf9hIjK1LmNoPq/Rs+tUv2WxYz0aBc4dEf6gH= and hash /cache/0123456789abcdef0123456789abcdef/x"));
  }

  @TestMethod
  public keepsTheAppsOwnNamesWhenTheUserNameIsOneOfTheirWordsAndRedactsItElsewhere(): void {
    const redactor = new DiagnosticRedactor("/Users/noldova", ["Noldova Desktop Sample"]);
    const text = "Noldova Desktop Sample saved /Users/noldova/notes.json for Noldova, as noldova asked Noldova Desktop Sample";

    Assert.areEqual("Noldova Desktop Sample saved ~/notes.json for [redacted], as [redacted] asked Noldova Desktop Sample", redactor.redact(text));
    Assert.areEqual("[redacted] Desktop Sample", new DiagnosticRedactor("/Users/noldova").redact("Noldova Desktop Sample"));
    Assert.areEqual("[redacted] Desktop Sample", new DiagnosticRedactor("/Users/noldova", [String.empty]).redact("Noldova Desktop Sample"));
    Assert.areEqual("Noldova Desktop Sample", new DiagnosticRedactor("/home/runner", ["Noldova Desktop Sample"]).redact("Noldova Desktop Sample"));
  }

  @TestMethod
  public redactsAUserNameThatHoldsAnOwnNameInsideALongerWord(): void {
    const accounts = ["Acme2", "Acmeer", "MyAcme", "Acme_2"];

    Assert.areEqual(
      JSON.stringify(accounts.map(() => "[redacted] opened Acme in ~\\notes")),
      JSON.stringify(accounts.map(t => new DiagnosticRedactor(`C:/Users/${t}`, ["Acme"]).redact(`${t} opened Acme in C:\\Users\\${t}\\notes`))));
  }

  @TestMethod
  public keepsTheCompanysPackageScopesInAStackWhenTheUserNameIsTheirWord(): void {
    const redactor = new DiagnosticRedactor("/home/noldova");
    const stack = "Error: noldova failed\n    at node_modules/@noldova/desktop.cli/x.js:1:2\n    at node_modules\\@noldova\\context.core\\x.js:3:4";

    Assert.areEqual(
      "Error: [redacted] failed\n    at node_modules/@noldova/desktop.cli/x.js:1:2\n    at node_modules\\@noldova\\context.core\\x.js:3:4",
      redactor.redact(stack));
    Assert.areEqual("[redacted]-com/x and [redacted]/y", redactor.redact("noldova-com/x and noldova/y"));
  }

  @TestMethod
  public keepsOrdinaryLogTextAndPathsOutsideTheHomeFolder(): void {
    const redactor = new DiagnosticRedactor("/home/person");
    const text = "Started 3 modules in 1.2 s from /usr/lib/node_modules/typescript/lib/tsc and C:/Program Files/App, id 0f3c-12ab, " +
      "@noldova/desktop.runtime@0.0.17 and typescript@5.6.2, /home/other, /tmp/test-run-nWlAXH/desktop-main-process-RSYG1z/Downloads, " +
      "/source/repos/MyApp2/Bin/Debug/net80";

    Assert.areEqual(text, redactor.redact(text));
  }

  @TestMethod
  public keepsALongClassNameMadeOfWordsButNotALongValueOfLettersAlone(): void {
    const redactor = new DiagnosticRedactor("/home/person");

    Assert.areEqual(
      "Window error in clock: WindowPartActivationFailedException: failed, key [redacted] and [redacted]",
      redactor.redact("Window error in clock: WindowPartActivationFailedException: failed, key QwErTyUiOpAsDfGhJkLzXcVbNmQwErTyUi and WindowPartActivationFailedExceptionX"));
  }

  @TestMethod
  public replacesOpaqueValuesAndKeepsShorterWords(): void {
    const redactor = new DiagnosticRedactor("/home/person");

    Assert.areEqual(
      "token [redacted] for /home/other, id abc-123",
      redactor.redact(`token ${"a1B2_c3D4-".repeat(4)} for /home/other, id abc-123`));
  }
}
