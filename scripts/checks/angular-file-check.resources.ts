/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.ts";

export class AngularFileCheckResources {
  public static readonly title: string = "Angular files";
  public static readonly appFile: RegExp = /^src\/(?:[^/]+\/)+src\/app\/.+\.ts$/;
  public static readonly sourceFile: RegExp = /^src\/.+\.ts$/;
  public static readonly changeDetectionField: string = "changeDetection";
  public static readonly onPush: string = "OnPush";
  public static readonly onPushValue: number = 0;
  public static readonly onPushRule: string = "Angular 22 detects changes OnPush by default, so a component leaves changeDetection: ChangeDetectionStrategy.OnPush out.";
  public static readonly wordStart: RegExp = /(?<=.)(?=[A-Z])/g;
  public static readonly componentDecorator: string = "Component";
  public static readonly injectableDecorator: string = "Injectable";
  public static readonly componentSuffix: string = ".component.ts";
  public static readonly serviceSuffix: string = ".service.ts";
  public static readonly templateSuffix: string = ".component.html";
  public static readonly serviceRole: string = "Service";
  public static readonly componentsFolder: string = "components";
  public static readonly templateUrlField: string = "templateUrl";
  public static readonly rule: string = "https://github.com/noldova-com/.github/blob/main/standards/stacks/ANGULAR.md, Components and services, puts each component in src/app/components/<folder>/<name>.component.ts with its template beside it, and each @Injectable service in <name>.service.ts.";
  public static readonly componentsFolderIndex: number = -3;
  public static readonly appFolderIndex: number = -4;

  public static formatPascalCase(name: string): string {
    return name.split(Resources.dash).map(t => `${t.charAt(0).toUpperCase()}${t.slice(1)}`).join(String.empty);
  }

  public static formatChecked(files: number, sources: number): string {
    return `Checked the component and service names of ${files} Angular files, and the change detection of the components in ${sources} source files.${Resources.lineEnd}`;
  }

  public static formatTemplate(name: string): string {
    return `./${name}${AngularFileCheckResources.templateSuffix}`;
  }

  public static formatMisplacedService(location: string, className: string, expected: string): string {
    return `${location}: the service ${className} is not in its file ${expected}; ${AngularFileCheckResources.rule}`;
  }

  public static formatNoComponent(file: string): string {
    return `${file}: holds no @Component class; ${AngularFileCheckResources.rule}`;
  }

  public static formatNoService(file: string): string {
    return `${file}: holds no @Injectable class whose name ends in Service; ${AngularFileCheckResources.rule}`;
  }

  public static formatComponentFile(location: string, className: string): string {
    return `${location}: the component ${className} is not in a <name>${AngularFileCheckResources.componentSuffix} file; ${AngularFileCheckResources.rule}`;
  }

  public static formatComponentName(location: string, className: string, expected: string): string {
    return `${location}: the component ${className} is not named ${expected} for its file; ${AngularFileCheckResources.rule}`;
  }

  public static formatComponentFolder(location: string, className: string): string {
    return `${location}: the component ${className} is not in src/app/components/<folder>/ with a file name that starts with the folder name; ${AngularFileCheckResources.rule}`;
  }

  public static formatTemplateUnnamed(location: string, className: string, template: string): string {
    return `${location}: the component ${className} does not name ${template} as its templateUrl; ${AngularFileCheckResources.rule}`;
  }

  public static formatTemplateMissing(location: string, className: string, template: string): string {
    return `${location}: the component ${className} names ${template}, which is not in the repository; ${AngularFileCheckResources.rule}`;
  }

  public static formatOnPush(location: string): string {
    return `${location}: sets OnPush change detection; ${AngularFileCheckResources.onPushRule}`;
  }
}
