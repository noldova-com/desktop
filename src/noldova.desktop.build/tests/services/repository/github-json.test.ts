/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { GitHubJson } from "../../../src/services/repository/github-json.js";

@TestClass
export class GitHubJsonTests {
  private static readonly SOURCE: Readonly<Record<string, unknown>> = {
    object: { id: 1 },
    list: [{ id: 2 }, { id: 3 }],
    text: "v1.2.3",
    empty: null,
    count: 4,
    flag: true
  };

  @TestMethod
  public readsEachKindOfValue(): void {
    const source = GitHubJsonTests.SOURCE;

    Assert.areEqual("{\"id\":1}", JSON.stringify(GitHubJson.child(source, "object", "the release")));
    Assert.areEqual("[{\"id\":2},{\"id\":3}]", JSON.stringify(GitHubJson.children(source, "list", "the release")));
    Assert.areEqual("v1.2.3", GitHubJson.text(source, "text", "the release"));
    Assert.areEqual("v1.2.3", GitHubJson.nullableText(source, "text", "the release"));
    Assert.isNull(GitHubJson.nullableText(source, "empty", "the release"));
    Assert.areEqual(4, GitHubJson.number(source, "count", "the release"));
    Assert.isTrue(GitHubJson.flag(source, "flag", "the release"));
  }

  @TestMethod
  public namesTheValueThatHasTheWrongShape(): void {
    const source = GitHubJsonTests.SOURCE;
    const failures: readonly (readonly [() => unknown, string])[] = [
      [() => GitHubJson.object([], "the release"), "the release must be an object."],
      [() => GitHubJson.object(null, "the release"), "the release must be an object."],
      [() => GitHubJson.array({}, "the releases"), "the releases must be an array."],
      [() => GitHubJson.child(source, "text", "the release"), "the release.text must be an object."],
      [() => GitHubJson.children(source, "object", "the release"), "the release.object must be an array."],
      [() => GitHubJson.children({ list: [{ id: 2 }, 3] }, "list", "the release"), "the release.list[1] must be an object."],
      [() => GitHubJson.text(source, "count", "the release"), "the release.count must be text."],
      [() => GitHubJson.nullableText(source, "missing", "the release"), "the release.missing must be text."],
      [() => GitHubJson.number(source, "text", "the release"), "the release.text must be a whole number."],
      [() => GitHubJson.number({ size: 1.5 }, "size", "the release"), "the release.size must be a whole number."],
      [() => GitHubJson.flag(source, "count", "the release"), "the release.count must be true or false."]
    ];

    for (const [read, message] of failures) {
      const error = Assert.throws(read, BuildException);

      Assert.areEqual(message, error.message);
    }
  }
}
