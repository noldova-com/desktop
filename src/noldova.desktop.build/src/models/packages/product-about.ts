/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ProductAbout {
  public static readonly NONE: ProductAbout = new ProductAbout(null, null, null, null);

  public readonly description: string | null;
  public readonly website: string | null;
  public readonly releases: string | null;
  public readonly licenses: string | null;

  public constructor(description: string | null, website: string | null, releases: string | null, licenses: string | null) {
    this.description = description;
    this.website = website;
    this.releases = releases;
    this.licenses = licenses;
  }

  public toJson(): Readonly<Record<string, string | null>> {
    return { description: this.description, website: this.website, releases: this.releases, licenses: this.licenses };
  }
}
