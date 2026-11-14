/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class DomFixture {
  public static host(fixture: { readonly nativeElement: unknown }): HTMLElement {
    const host = fixture.nativeElement;
    if (!(host instanceof HTMLElement))
      throw new Error("The fixture's host is not an HTML element.");
    return host;
  }

  public static one(root: ParentNode, selector: string): HTMLElement {
    return DomFixture.oneOf(root, selector, HTMLElement);
  }

  public static oneOf<T extends Element>(root: ParentNode, selector: string, type: abstract new () => T): T {
    const element = root.querySelector(selector);
    if (Object.isNull(element))
      throw new Error(`Nothing matches ${selector}.`);
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
      throw new Error(`No ancestor matches ${selector}.`);
    return DomFixture.checked(ancestor, selector, HTMLElement);
  }

  public static present<T>(value: T | null | undefined): T {
    if (Object.isNullOrUndefined(value))
      throw new Error("The element is missing.");
    return value;
  }

  private static checked<T extends Element>(element: Element, selector: string, type: abstract new () => T): T {
    if (!(element instanceof type))
      throw new Error(`${selector} matches a ${element.localName}, not a ${type.name}.`);
    return element;
  }
}
