/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { UiWorkflowBuild } from "./ui-workflow-build.ts";

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
  public static readonly documentTabsSpec: string = "title-bar-document-tabs.spec.ts";
  public static readonly builds: readonly UiWorkflowBuild[] = [
    new UiWorkflowBuild(["--test", "--without", "notes", "--without", "alarm", "--without", "clock", "--without", "reminder", "--without", "beacon", "--without", "pages", "--output", "_build/variants/no-modules"],
      ["_build", "variants", "no-modules"]),
    new UiWorkflowBuild(["--test", "--without", "alarm", "--without", "clock", "--output", "_build/variants/without-clock"], ["_build", "variants", "without-clock"]),
    new UiWorkflowBuild(["--test", "--update-feed", "http://127.0.0.1:47324/", "--output", "_build/variants/update-feed"], ["_build", "variants", "update-feed"]),
    new UiWorkflowBuild(["--test", "--document-tabs", "--output", "_build/variants/document-tabs"], ["_build", "variants", "document-tabs"], UiWorkflowsResources.documentTabsSpec),
    new UiWorkflowBuild(["--test"], ["_build", "window"])
  ];
  public static readonly listArguments: readonly string[] = ["--list", "--reporter=list"];
  public static readonly listTimeout: number = 300000;
  public static readonly notListed: string = "Playwright couldn't list the specs this run takes, as before the packages are first built, so every variant made for one spec builds too.\n";
  public static readonly current: string = "The builds of the UI workflows are current.\n";
  public static readonly requireCurrent: string = "--require-current";
  public static readonly notCurrent: string = "The builds of the UI workflows are not current, and --require-current forbids building them here, so nothing ran.\n";
  public static readonly building: string = "Building the test build and its variants for the UI workflows...\n";
}
