/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { UnansweredCallException } from "../exceptions/unanswered-call.exception.js";
import { FakeCall } from "./fake-call.js";

export abstract class Fake<T extends object> {
  private readonly recorded: FakeCall<T>[] = [];
  private readonly live: Set<FakeCall<T>> = new Set<FakeCall<T>>();
  private readonly thrown: unknown[] = [];
  private readonly allowed: Set<keyof T> = new Set<keyof T>();
  private isStrict: boolean = false;

  protected readonly answers: { -readonly [K in keyof T]?: T[K] } = {};

  public get calls(): readonly FakeCall<T>[] {
    return this.recorded;
  }

  public get errors(): readonly unknown[] {
    return this.thrown;
  }

  public callsOf(member: keyof T & string): readonly (readonly unknown[])[] {
    return this.recorded.filter(t => t.member === member).map(t => t.args);
  }

  public activeCallsOf(member: keyof T & string): readonly (readonly unknown[])[] {
    return [...this.live].filter(t => t.member === member).map(t => t.args);
  }

  public answer<K extends keyof T>(member: K, implementation: T[K]): void {
    this.answers[member] = implementation;
  }

  public beStrict(): void {
    this.isStrict = true;
    for (const part of this.parts())
      part.beStrict();
  }

  public allow(...members: (keyof T & string)[]): void {
    for (const member of members)
      this.allowed.add(member);
  }

  protected ask<A extends unknown[], R>(member: keyof T & string, args: A, answer: ((...args: A) => R) | undefined): R {
    return this.answerOf(member, args, answer)(...args);
  }

  protected respondAsync<A extends unknown[], R>(member: keyof T & string, args: A, answer: ((...args: A) => Promise<R>) | undefined): Promise<R> {
    return this.answerOfAsync(member, args, answer, t => t(...args));
  }

  protected answerOf<F>(member: keyof T & string, args: readonly unknown[], answer: F | undefined): F {
    this.recorded.push(new FakeCall<T>(member, args));
    return this.propertyOf(member, answer);
  }

  protected async answerOfAsync<F, R>(member: keyof T & string, args: readonly unknown[], answer: F | undefined, call: (answer: F) => Promise<R>): Promise<R> {
    this.recorded.push(new FakeCall<T>(member, args));
    if (Object.isUndefined(answer))
      throw new UnansweredCallException(member);
    return await call(answer);
  }

  protected tell<A extends unknown[]>(member: keyof T & string, args: A, answer: ((...args: A) => void) | undefined): void {
    this.recorded.push(new FakeCall<T>(member, args));
    if (Object.isUndefined(answer))
      this.refuseUnallowed(member);
    else
      answer(...args);
  }

  protected track(member: keyof T & string, args: readonly unknown[]): () => void {
    const call = new FakeCall<T>(member, args);
    this.recorded.push(call);
    if (Object.isUndefined(this.answers[member]))
      this.refuseUnallowed(member);
    this.live.add(call);
    return () => {
      this.live.delete(call);
    };
  }

  protected listen<L>(member: keyof T & string, args: readonly unknown[], listeners: Set<L>, listener: L): () => void {
    const release = this.track(member, args);
    listeners.add(listener);
    return () => {
      release();
      listeners.delete(listener);
    };
  }

  protected propertyOf<V>(member: keyof T & string, answer: V | undefined): V {
    if (Object.isUndefined(answer))
      throw new UnansweredCallException(member);
    return answer;
  }

  protected parts(): readonly Pick<Fake<object>, "beStrict">[] {
    return [];
  }

  protected raise<L>(listeners: ReadonlySet<L>, call: (listener: L) => void): void {
    for (const listener of [...listeners])
      call(listener);
  }

  protected raiseIsolated<L>(listeners: ReadonlySet<L>, call: (listener: L) => void, report: (error: unknown) => void = t => this.thrown.push(t)): void {
    for (const listener of [...listeners])
      try {
        call(listener);
      } catch (error) {
        report(error);
      }
  }

  protected raiseLive<L>(listeners: ReadonlySet<L>, call: (listener: L) => void, report: (error: unknown) => void = t => this.thrown.push(t)): void {
    this.raiseIsolated(listeners, t => {
      if (listeners.has(t))
        call(t);
    }, report);
  }

  protected async raiseLiveAsync<L>(listeners: ReadonlySet<L>, call: (listener: L) => void | Promise<void>, report: (error: unknown) => void = t => this.thrown.push(t)): Promise<void> {
    const endings: Promise<void>[] = [];
    for (const listener of [...listeners])
      if (listeners.has(listener))
        endings.push(Promise.try(() => call(listener)).catch(report));
    await Promise.all(endings);
  }

  private refuseUnallowed(member: keyof T & string): void {
    if (this.isStrict && !this.allowed.has(member))
      throw new UnansweredCallException(member);
  }
}
