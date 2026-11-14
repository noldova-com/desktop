/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import type { SourceLiteral } from "../../../src/models/structure/source-literal.js";
import { SourceScanner } from "../../../src/services/structure/source-scanner.js";

@TestClass
export class SourceScannerTests {
  @TestMethod
  public findsTheSpecifiersOfImportsExportsAndImportOrRequireCalls(): void {
    const source = new SourceScanner([
      "import a from \"./a.js\";",
      "export { b } from './b.js';",
      "import \"./side.js\";",
      "const c = await import(\"./c.js\");",
      "const d = require(\"./d.js\");",
      "const e = load(\"./e.js\");"
    ].join("\n")).scan();

    Assert.areEqual("./a.js@1 ./b.js@2 ./side.js@3 ./c.js@4 ./d.js@5", SourceScannerTests.format(source.imports));
    Assert.areEqual("./e.js@6", SourceScannerTests.format(source.texts));
  }

  @TestMethod
  public findsTheSelectorsOfComponentsAndKeepsOtherKeysAsTexts(): void {
    const source = new SourceScanner("@Component({ selector: \"app-root\", template: \"<p></p>\" })\nconst named = { name: \"n\" };").scan();

    Assert.areEqual("app-root@1", SourceScannerTests.format(source.selectors));
    Assert.areEqual("<p></p>@1 n@2", SourceScannerTests.format(source.texts));
  }

  @TestMethod
  public findsTheLinesOfCommentsAndNoTextsInsideThem(): void {
    const closed = new SourceScanner("// one\nconst a = 1; /* two\nthree */ const b = \"/* not */\";\n// end").scan();
    const open = new SourceScanner("const a = 1;\n/* open\n\"inside\"").scan();

    Assert.areEqual([1, 2, 4].join(), closed.comments.join());
    Assert.areEqual("/* not */@3", SourceScannerTests.format(closed.texts));
    Assert.areEqual("2", open.comments.join());
    Assert.areEqual(0, open.texts.length);
  }

  @TestMethod
  public readsEscapesLineContinuationsAndStringsEndedByTheLine(): void {
    const source = new SourceScanner("const a = \"a\\\"b\\\\c\";\nconst b = \"one\\\ntwo\";\nconst c = 'three';\nconst d = \"open\nconst e = 'four';\nconst f = \"last").scan();

    Assert.areEqual("a\"b\\c@1 onetwo@2 three@4 open@5 four@6 last@7", SourceScannerTests.format(source.texts));
  }

  @TestMethod
  public readsTheTextsOfTemplatesAroundTheirSubstitutions(): void {
    const source = new SourceScanner("const a = `plain`;\nconst b = `a${b}c${ { d: 1 }.d }e`;\nconst c = `x\\`y\nz`;\nconst d = \"after\";\nconst e = `open").scan();

    Assert.areEqual("plain@1 a@2 c@2 e@2 x`y\nz@3 after@5 open@6", SourceScannerTests.format(source.texts));
  }

  @TestMethod
  public skipsRegularExpressionsButNotDivisions(): void {
    const source = new SourceScanner([
      "/\"q\"/.test(x);",
      "const r = /a[/\"]b\\/c/g;",
      "const q = 4 / 2 / (x) / y[0] / \"divided\";",
      "function f() { return /\"/; }",
      "const s = /unclosed",
      "const t = \"t\";"
    ].join("\n")).scan();

    Assert.areEqual("divided@3 t@6", SourceScannerTests.format(source.texts));
  }

  @TestMethod
  @TestData("function named() {}", true)
  @TestData("const f = () => 1;", true)
  @TestData("if (a) { b(); }", true)
  @TestData("const a = { b: 1 }; a.function = 2;", false)
  @TestData("let a = 1; a == 2; a >= 3;", false)
  public tellsWhetherTheSourceHasAFunctionBody(text: string, hasFunctionBody: boolean): void {
    Assert.areEqual(hasFunctionBody, new SourceScanner(text).scan().hasFunctionBody);
  }

  private static format(literals: readonly SourceLiteral[]): string {
    return literals.map(t => `${t.value}@${t.line}`).join(" ");
  }
}
