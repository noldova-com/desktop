/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export class BuildVariantFixture {
  public static readonly noModules: string = "no-modules";
  public static readonly documentTabs: string = "document-tabs";

  private static readonly BUILD_FOLDER: string = path.resolve("_build");
  private static readonly VARIANTS_FOLDER: string = path.join(BuildVariantFixture.BUILD_FOLDER, "variants");
  private static readonly SWAPPED_FOLDER: string = path.join(BuildVariantFixture.BUILD_FOLDER, "swapped-build");
  private static readonly WINDOW_FOLDER: string = "window";
  private static readonly DECLARATIONS_SEGMENTS: readonly string[] = ["modules", "declarations.json"];
  private static readonly DECLARATIONS_FILE: string = "declarations.json";
  private static readonly PRODUCT_FILE: string = "product.json";

  public static async swapInAsync(name: string): Promise<void> {
    await BuildVariantFixture.restoreAsync();
    const variant = path.join(BuildVariantFixture.VARIANTS_FOLDER, name);
    if (!existsSync(variant))
      throw new Error(`The build variant ${name} is missing; build it with npm run build -- --test --without <module id> --output ${variant}.`);
    await mkdir(BuildVariantFixture.SWAPPED_FOLDER, { recursive: true });
    for (const [built, kept, source] of BuildVariantFixture.swaps(variant)) {
      await rename(built, kept);
      await cp(source, built, { recursive: true });
    }
  }

  public static async changeDeclarationsAsync(change: (text: string) => string): Promise<void> {
    await BuildVariantFixture.restoreAsync();
    const built = path.join(BuildVariantFixture.BUILD_FOLDER, ...BuildVariantFixture.DECLARATIONS_SEGMENTS);
    const text = await readFile(built, "utf8");
    await mkdir(BuildVariantFixture.SWAPPED_FOLDER, { recursive: true });
    await rename(built, path.join(BuildVariantFixture.SWAPPED_FOLDER, BuildVariantFixture.DECLARATIONS_FILE));
    await writeFile(built, change(text));
  }

  public static async restoreAsync(): Promise<void> {
    if (!existsSync(BuildVariantFixture.SWAPPED_FOLDER))
      return;
    for (const [built, kept] of BuildVariantFixture.swaps(BuildVariantFixture.SWAPPED_FOLDER))
      if (existsSync(kept)) {
        await rm(built, { recursive: true, force: true, maxRetries: 10 });
        await rename(kept, built);
      }
    await rm(BuildVariantFixture.SWAPPED_FOLDER, { recursive: true, force: true, maxRetries: 10 });
  }

  private static swaps(variant: string): readonly (readonly [string, string, string])[] {
    return [
      [
        path.join(BuildVariantFixture.BUILD_FOLDER, BuildVariantFixture.WINDOW_FOLDER),
        path.join(BuildVariantFixture.SWAPPED_FOLDER, BuildVariantFixture.WINDOW_FOLDER),
        path.join(variant, BuildVariantFixture.WINDOW_FOLDER)
      ],
      [
        path.join(BuildVariantFixture.BUILD_FOLDER, ...BuildVariantFixture.DECLARATIONS_SEGMENTS),
        path.join(BuildVariantFixture.SWAPPED_FOLDER, BuildVariantFixture.DECLARATIONS_FILE),
        path.join(variant, ...BuildVariantFixture.DECLARATIONS_SEGMENTS)
      ],
      [
        path.join(BuildVariantFixture.BUILD_FOLDER, BuildVariantFixture.PRODUCT_FILE),
        path.join(BuildVariantFixture.SWAPPED_FOLDER, BuildVariantFixture.PRODUCT_FILE),
        path.join(variant, BuildVariantFixture.PRODUCT_FILE)
      ]
    ];
  }
}
