/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class UiWorkflowsResources {
  public static readonly playwrightCli: readonly string[] = ["node_modules", "playwright", "cli.js"];
  public static readonly playwrightConfig: string = "src/noldova.desktop.electron/tests/e2e/playwright.config.ts";
  public static readonly typeScriptCli: readonly string[] = ["node_modules", "typescript", "bin", "tsc"];
  public static readonly endToEndProject: string = "src/noldova.desktop.electron/tests/e2e";
  public static readonly projectOption: string = "--project";
  public static readonly testCommand: string = "test";
  public static readonly configOption: string = "--config";
  public static readonly recordSegments: readonly string[] = ["_build", "ui-builds.record"];
  public static readonly declarationsSegments: readonly string[] = ["_build", "modules", "declarations.json"];
  public static readonly productSegments: readonly string[] = ["_build", "product.json"];
  public static readonly treeOutputs: readonly (readonly string[])[] = [
    ["_build", "window"],
    ["_build", "variants", "no-modules"],
    ["_build", "variants", "without-clock"],
    ["_build", "variants", "update-feed"]
  ];
  public static readonly builds: readonly (readonly string[])[] = [
    ["--test", "--without", "notes", "--without", "alarm", "--without", "clock", "--without", "reminder", "--without", "beacon", "--without", "pages", "--output", "_build/variants/no-modules"],
    ["--test", "--without", "alarm", "--without", "clock", "--output", "_build/variants/without-clock"],
    ["--test", "--update-feed", "http://127.0.0.1:47324/", "--output", "_build/variants/update-feed"],
    ["--test"]
  ];
  public static readonly current: string = "The builds of the UI workflows are current.\n";
  public static readonly requireCurrent: string = "--require-current";
  public static readonly notCurrent: string = "The builds of the UI workflows are not current, and --require-current forbids building them here, so nothing ran.\n";
  public static readonly building: string = "Building the test build and its variants for the UI workflows...\n";
}
