/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { UpdateFeed } from "../../../src/services/packages/update-feed.js";

@TestClass
export class UpdateFeedTests {
  @TestMethod
  @TestData("https://updates.example.com/app/", true)
  @TestData("http://localhost:8080/", true)
  @TestData("http://127.0.0.1/feed/", true)
  @TestData("http://[::1]/feed/", true)
  @TestData("http://updates.example.com/", false)
  @TestData("https://updates.example.com/app", false)
  @TestData("ftp://updates.example.com/", false)
  @TestData("not a url/", false)
  public acceptsASecureFeedOrALocalOneEndingInASlash(feed: string, isValid: boolean): void {
    Assert.areEqual(isValid, UpdateFeed.isValid(feed));
  }

  @TestMethod
  @TestData("https://updates.example.com/app/", true)
  @TestData("http://localhost:8080/", false)
  @TestData("https://updates.example.com/app", false)
  @TestData("https://updates.example.com/a?b/", false)
  @TestData("https://updates.example.com/a#b/", false)
  @TestData("https://user@updates.example.com/", false)
  @TestData("https://user:secret@updates.example.com/", false)
  @TestData("https://:secret@updates.example.com/", false)
  public namesOnlyASecureFeedWithoutUserOrQuery(feed: string, isNamed: boolean): void {
    Assert.areEqual(isNamed, UpdateFeed.isNamed(feed));
  }

  @TestMethod
  public pointsAtTheLatestReleaseOfTheRepository(): void {
    const feed = UpdateFeed.ofRepository("noldova-com/notes");

    Assert.areEqual("https://github.com/noldova-com/notes/releases/latest/download/", feed);
    Assert.isTrue(UpdateFeed.isNamed(feed));
  }
}
