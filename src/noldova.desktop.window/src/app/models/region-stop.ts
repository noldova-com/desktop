/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class RegionStop {
  public readonly target: HTMLElement;
  private readonly test: (element: Element) => boolean;

  public constructor(target: HTMLElement, test: (element: Element) => boolean) {
    this.target = target;
    this.test = test;
  }

  public holds(element: Element): boolean {
    return this.test(element);
  }
}
