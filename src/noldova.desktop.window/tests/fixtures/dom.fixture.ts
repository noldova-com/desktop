/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { ElementRef } from "@angular/core";
import type { ComponentFixture } from "@angular/core/testing";

import { ElementMissingException } from "../exceptions/element-missing.exception";
import { ElementTypeMismatchException } from "../exceptions/element-type-mismatch.exception";
import { HostNotElementException } from "../exceptions/host-not-element.exception";
import { NoAncestorMatchesException } from "../exceptions/no-ancestor-matches.exception";
import { NoElementMatchesException } from "../exceptions/no-element-matches.exception";

export class DomFixture {
  public static host(fixture: ComponentFixture<unknown> | ElementRef<unknown>): HTMLElement {
    const host = fixture.nativeElement;
    if (!(host instanceof HTMLElement))
      throw new HostNotElementException();
    return host;
  }

  public static one(root: ParentNode, selector: string): HTMLElement {
    return DomFixture.oneOf(root, selector, HTMLElement);
  }

  public static oneOf<T extends Element>(root: ParentNode, selector: string, type: abstract new () => T): T {
    const element = root.querySelector(selector);
    if (Object.isNull(element))
      throw new NoElementMatchesException(selector);
    return DomFixture.checked(element, selector, type);
  }

  public static maybe(root: ParentNode, selector: string): HTMLElement | null {
    const element = root.querySelector(selector);
    return Object.isNull(element) ? null : DomFixture.checked(element, selector, HTMLElement);
  }

  public static all(root: ParentNode, selector: string): HTMLElement[] {
    return DomFixture.allOf(root, selector, HTMLElement);
  }

  public static allOf<T extends Element>(root: ParentNode, selector: string, type: abstract new () => T): T[] {
    return [...root.querySelectorAll(selector)].map(t => DomFixture.checked(t, selector, type));
  }

  public static closest(element: Element, selector: string): HTMLElement {
    const ancestor = element.closest(selector);
    if (Object.isNull(ancestor))
      throw new NoAncestorMatchesException(selector);
    return DomFixture.checked(ancestor, selector, HTMLElement);
  }

  public static present<T>(value: T | null | undefined): T {
    if (Object.isNullOrUndefined(value))
      throw new ElementMissingException();
    return value;
  }

  private static checked<T extends Element>(element: Element, selector: string, type: abstract new () => T): T {
    if (!(element instanceof type))
      throw new ElementTypeMismatchException(selector, element.localName, type.name);
    return element;
  }
}
