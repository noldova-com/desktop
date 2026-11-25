/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Fake } from "@noldova/desktop.protocol/testing";

export class FakeMember<T extends object> {
  public readonly kind: string;
  public readonly call: (fake: Fake<T> & T) => unknown;
  public readonly track: ((fake: Fake<T> & T) => () => void) | null;

  private constructor(kind: string, call: (fake: Fake<T> & T) => unknown, track: ((fake: Fake<T> & T) => () => void) | null) {
    this.kind = kind;
    this.call = call;
    this.track = track;
  }

  public static answered<T extends object>(call: (fake: Fake<T> & T) => unknown): FakeMember<T> {
    return new FakeMember("answered", call, null);
  }

  public static told<T extends object>(call: (fake: Fake<T> & T) => unknown): FakeMember<T> {
    return new FakeMember("told", call, null);
  }

  public static property<T extends object>(call: (fake: Fake<T> & T) => unknown): FakeMember<T> {
    return new FakeMember("property", call, null);
  }

  public static fake<T extends object>(call: (fake: Fake<T> & T) => unknown): FakeMember<T> {
    return new FakeMember("fake", call, null);
  }

  public static tracked<T extends object>(track: (fake: Fake<T> & T) => () => void): FakeMember<T> {
    return new FakeMember("tracked", track, track);
  }

  public static listened<T extends object>(track: (fake: Fake<T> & T) => () => void): FakeMember<T> {
    return new FakeMember("listened", track, track);
  }
}
