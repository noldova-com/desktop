/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { BuildCommandLine } from "@noldova/desktop.build";
import { KeyChord, ShellKeys } from "@noldova/desktop.protocol";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { Resources } from "../../../src/resources.js";
import { ModuleWebViews } from "../../../src/services/modules/module-web-views.js";
import { ModuleAppFixture } from "../../fixtures/module-app.fixture.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class ModuleWebViewsTests {
  private static readonly FOLDER: string = "src/modules/browser";
  private static readonly PATH: string = "src/modules/browser/webViews.json";
  private static readonly METHOD: string = "Page.captureScreenshot";

  private static readonly NO_PRODUCT: string = "The root package.json must declare desktop.product.\n";
  private static readonly FILE: string = "node_modules/@noldova/sample/webViews.json ";
  private static readonly REFUSED: string = "it needs Mod, Ctrl or Alt, or a function key, or is Escape among the loading keys, and it must not be a key that editing, the operating system or Noldova Desktop holds.\n";

  @TestMethod
  @TestData("[{\"name\":\"reload\",\"keys\":[\"Mod+R\",\"F5\"],\"macKeys\":[\"Mod+R\"]},{\"name\":\"newTab\",\"keys\":[\"Mod+T\"]}]")
  @TestData("[{\"name\":\"back\",\"keys\":[\"Ctrl+BracketLeft\"],\"macKeys\":[\"Ctrl+BracketLeft\"]},{\"name\":\"hide\",\"keys\":[\"Mod+H\"],\"macKeys\":[\"Mod+Shift+H\"]}]")
  @TestData("[]")
  public acceptsKeysThatAreFreeOnEachPlatform(keys: string): Promise<void> {
    return ModuleWebViewsTests.assertOutputAsync({ keys: JSON.parse(keys) }, ModuleWebViewsTests.NO_PRODUCT);
  }

  @TestMethod
  @TestData("[{\"name\":\"back\",\"keys\":[\"Alt+ArrowLeft\"],\"macKeys\":[\"F6\"]}]", "back.keys Alt+ArrowLeft", "Windows and Linux")
  @TestData("[{\"name\":\"back\",\"keys\":[\"F6\"],\"macKeys\":[\"Mod+BracketLeft\"]}]", "back.macKeys Mod+BracketLeft", "macOS")
  @TestData("[{\"name\":\"hide\",\"keys\":[\"Mod+H\"]}]", "hide.keys Mod+H", "macOS")
  @TestData("[{\"name\":\"next\",\"keys\":[\"Ctrl+Tab\"]}]", "next.keys Ctrl+Tab", "Windows and Linux")
  @TestData("[{\"name\":\"stop\",\"keys\":[\"Mod+Shift+Period\"]}]", "stop.keys Mod+Shift+Period", "Windows and Linux")
  @TestData("[{\"name\":\"copy\",\"keys\":[\"Ctrl+C\"]}]", "copy.keys Ctrl+C", "Windows and Linux")
  @TestData("[{\"name\":\"close\",\"keys\":[\"Alt+F4\"]}]", "close.keys Alt+F4", "Windows and Linux")
  @TestData("[{\"name\":\"type\",\"keys\":[\"Shift+R\"]}]", "type.keys Shift+R", "Windows and Linux")
  @TestData("[{\"name\":\"escape\",\"keys\":[\"Escape\"]}]", "escape.keys Escape", "Windows and Linux")
  public refusesAKeyThatIsTypingOrHeldOnAPlatform(keys: string, given: string, platform: string): Promise<void> {
    return ModuleWebViewsTests.assertOutputAsync({ keys: JSON.parse(keys) },
      `${ModuleWebViewsTests.FILE}gives ${given}, which cannot be declared on ${platform}: ${ModuleWebViewsTests.REFUSED}`);
  }

  @TestMethod
  @TestData("{}", "must list its keys as an array.")
  @TestData("[\"reload\"]", "must describe keys[0] with a name, its keys and optionally its macOS keys.")
  @TestData("[{\"name\":\"reload\",\"keys\":[\"Mod+R\"],\"label\":\"Reload\"}]", "must describe keys[0] with a name, its keys and optionally its macOS keys.")
  @TestData("[{\"name\":\"Reload\",\"keys\":[\"Mod+R\"]}]", "must name keys[0] with a lowercase letter followed by letters and digits.")
  @TestData("[{\"name\":\"reload\",\"keys\":[]}]", "must give reload.keys one to 4 keys.")
  @TestData("[{\"name\":\"reload\",\"keys\":[\"F1\",\"F2\",\"F3\",\"F4\",\"F5\"]}]", "must give reload.keys one to 4 keys.")
  @TestData("[{\"name\":\"reload\",\"keys\":[\"Mod+R\"],\"macKeys\":[7]}]", "must give reload.macKeys one to 4 keys.")
  @TestData("[{\"name\":\"reload\",\"keys\":[\"Mod+Nope\"]}]", "gives reload.keys Mod+Nope, which is not a key in Noldova Desktop's format, such as Mod+R or F5.")
  @TestData("[{\"name\":\"reload\",\"keys\":[\"Mod+Ctrl+R\"]}]", "gives reload.keys Mod+Ctrl+R, which is not a key in Noldova Desktop's format, such as Mod+R or F5.")
  @TestData("[{\"name\":\"reload\",\"keys\":[\"Hyper+R\"]}]", "gives reload.keys Hyper+R, which is not a key in Noldova Desktop's format, such as Mod+R or F5.")
  @TestData("[{\"name\":\"reload\",\"keys\":[\"Mod+Mod+R\"]}]", "gives reload.keys Mod+Mod+R, which is not a key in Noldova Desktop's format, such as Mod+R or F5.")
  @TestData("[{\"name\":\"reload\",\"keys\":[\"Mod+R\"]},{\"name\":\"reload\",\"keys\":[\"F5\"]}]", "must name each of its keys and loading keys once, with at most 32 names in all.")
  @TestData("[{\"name\":\"reload\",\"keys\":[\"Mod+R\",\"Ctrl+R\"],\"macKeys\":[\"Mod+R\"]}]", "gives a key more than once on Windows and Linux.")
  @TestData("[{\"name\":\"reload\",\"keys\":[\"Mod+R\"]},{\"name\":\"refresh\",\"keys\":[\"F5\"],\"macKeys\":[\"Mod+R\"]}]", "gives a key more than once on macOS.")
  public refusesKeysThatAreNotWellFormed(keys: string, problem: string): Promise<void> {
    return ModuleWebViewsTests.assertOutputAsync({ keys: JSON.parse(keys) }, `${ModuleWebViewsTests.FILE}${problem}\n`);
  }

  @TestMethod
  public refusesMoreThanThirtyTwoNames(): Promise<void> {
    const keys = Array.from({ length: 33 }, (_, index) => ({ name: `key${index}`, keys: [index < 24 ? `F${index + 1}` : `Mod+Shift+F${index - 23}`] }));
    return ModuleWebViewsTests.assertOutputAsync({ keys }, `${ModuleWebViewsTests.FILE}must name each of its keys and loading keys once, with at most 32 names in all.\n`);
  }

  @TestMethod
  @TestData("[{\"name\":\"focusAddress\",\"keys\":[\"Mod+L\"]}]", "[{\"name\":\"stop\",\"keys\":[\"Escape\"]}]")
  @TestData("[]", "[{\"name\":\"stop\",\"keys\":[\"Escape\",\"F6\"],\"macKeys\":[\"Shift+Escape\"]}]")
  @TestData("[{\"name\":\"regions\",\"keys\":[\"F6\",\"Shift+F6\"]}]", "[]")
  public acceptsLoadingKeysWithEscapeAndF6AmongTheKeys(keys: string, loadingKeys: string): Promise<void> {
    return ModuleWebViewsTests.assertOutputAsync({ keys: JSON.parse(keys), loadingKeys: JSON.parse(loadingKeys) }, ModuleWebViewsTests.NO_PRODUCT);
  }

  @TestMethod
  @TestData("[{\"name\":\"stop\",\"keys\":[\"Mod+R\"]}]", "[{\"name\":\"stop\",\"keys\":[\"Escape\"]}]", "must name each of its keys and loading keys once, with at most 32 names in all.")
  @TestData("[{\"name\":\"reload\",\"keys\":[\"F5\"]}]", "[{\"name\":\"stop\",\"keys\":[\"Escape\",\"F5\"]}]", "gives a key more than once on Windows and Linux.")
  @TestData("[]", "[\"stop\"]", "must describe loadingKeys[0] with a name, its keys and optionally its macOS keys.")
  @TestData("[]", "[{\"name\":\"Stop\",\"keys\":[\"Escape\"]}]", "must name loadingKeys[0] with a lowercase letter followed by letters and digits.")
  @TestData("[]", "{}", "must list its loadingKeys as an array.")
  public refusesALoadingKeyThatRepeatsAKeyOrIsNotWellFormed(keys: string, loadingKeys: string, problem: string): Promise<void> {
    return ModuleWebViewsTests.assertOutputAsync({ keys: JSON.parse(keys), loadingKeys: JSON.parse(loadingKeys) }, `${ModuleWebViewsTests.FILE}${problem}\n`);
  }

  @TestMethod
  @TestData("Enter", "Windows and Linux")
  @TestData("Mod+Escape", "Windows and Linux")
  @TestData("Mod+Shift+Period", "Windows and Linux")
  public refusesALoadingKeyThatIsTypingOtherThanEscapeOrHeld(key: string, platform: string): Promise<void> {
    return ModuleWebViewsTests.assertOutputAsync({ loadingKeys: [{ name: "stop", keys: [key] }] },
      `${ModuleWebViewsTests.FILE}gives stop.keys ${key}, which cannot be declared on ${platform}: ${ModuleWebViewsTests.REFUSED}`);
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public acceptsNewWindowsDeclaredTrueOrFalse(value: boolean): Promise<void> {
    return ModuleWebViewsTests.assertOutputAsync({ methods: [{ name: "Page.enable" }], newWindows: value }, ModuleWebViewsTests.NO_PRODUCT);
  }

  @TestMethod
  @TestData("\"yes\"")
  @TestData("1")
  @TestData("null")
  public refusesNewWindowsThatAreNotTrueOrFalse(value: string): Promise<void> {
    return ModuleWebViewsTests.assertOutputAsync({ newWindows: JSON.parse(value) }, `${ModuleWebViewsTests.FILE}must say newWindows as true or false.\n`);
  }

  @TestMethod
  public refusesAnUnknownField(): Promise<void> {
    return ModuleWebViewsTests.assertOutputAsync({ popups: true }, `${ModuleWebViewsTests.FILE}must be an object with optional methods, events, keys, newWindows and loadingKeys.\n`);
  }

  @TestMethod
  @TestData("win32", false)
  @TestData("darwin", true)
  public keepsTheSameDefaultKeysAsTheProtocol(platform: string, isMac: boolean): void {
    const build = Resources.webViewShellKeys.flatMap(([command, standard, mac]) => (isMac ? mac : standard).map(t => `${command} ${t}`));
    const protocol = ShellKeys.list(platform).map(([key, command]) => `${command} ${key.text}`);

    Assert.areEqual(protocol.join(","), build.join(","));
    Assert.areEqual(ShellKeys.stopAgentControl.text, Resources.webViewStopAgentControlKey);
    Assert.areEqual(String.empty, [...Resources.webViewEditingKeys, ...isMac ? Resources.webViewMacSystemKeys : Resources.webViewStandardSystemKeys]
      .filter(t => Object.isNull(KeyChord.parse(t).findReservedOwner(null))).join(","));
    Assert.areEqual(String.empty, Resources.webViewKeyNames.filter(t => Object.isNull(KeyChord.find(t))).join(","));
  }

  @TestMethod
  public async readsMethodsWithTheirParameterRulesEventsAndNewWindows(): Promise<void> {
    const webViews = {
      methods: [
        { name: "Page.enable" },
        {
          name: ModuleWebViewsTests.METHOD,
          parameters: {
            format: { values: ["png", "jpeg"], required: true },
            quality: { minimum: 0, maximum: 100 },
            scale: { maximum: 4 },
            label: { maxLength: 20 },
            clip: { required: false, fields: { x: { minimum: 0 }, zoom: { values: [1, 2, true] } } },
            anything: {}
          }
        }
      ],
      events: ["Page.loadEventFired"],
      newWindows: true
    };
    await using tree = await SourceTreeFixture.createAsync({ [ModuleWebViewsTests.PATH]: JSON.stringify(webViews) });

    const read = await ModuleWebViews.readAsync(tree.path, ModuleWebViewsTests.FOLDER);

    Assert.areEqual(JSON.stringify(webViews), JSON.stringify(read));
  }

  @TestMethod
  public async readsNoWebViewsWhenTheModuleHasNoFile(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync();

    Assert.isNull(await ModuleWebViews.readAsync(tree.path, ModuleWebViewsTests.FOLDER));
  }

  @TestMethod
  public async refusesAFileThatIsNotJson(): Promise<void> {
    Assert.areEqual(`${ModuleWebViewsTests.PATH} could not be read as JSON.`, await ModuleWebViewsTests.failAsync("{\"methods\":"));
  }

  @TestMethod
  @TestData("{}", "must list its methods as an array")
  @TestData("[\"Page.enable\"]", "must describe methods[0] with a name and optionally parameters")
  @TestData("[{\"name\":\"Page.enable\",\"returns\":{}}]", "must describe methods[0] with a name and optionally parameters")
  @TestData("[{\"name\":\"page.enable\"}]", "must name methods[0] as a debugging protocol domain, a dot and a name, such as Page.captureScreenshot")
  @TestData("[{\"name\":1}]", "must name methods[0] as a debugging protocol domain, a dot and a name, such as Page.captureScreenshot")
  @TestData("[{\"name\":\"Page.enable\"},{\"name\":\"Page\"}]", "must name methods[1] as a debugging protocol domain, a dot and a name, such as Page.captureScreenshot")
  @TestData("[{\"name\":\"Page.enable\"},{\"name\":\"Page.enable\"}]", "names a method more than once")
  public async refusesMethodsThatAreNotDistinctDomainMethods(methods: string, problem: string): Promise<void> {
    Assert.areEqual(`${ModuleWebViewsTests.PATH} ${problem}.`, await ModuleWebViewsTests.failAsync(`{"methods":${methods}}`));
  }

  @TestMethod
  @TestData("Page.navigate")
  @TestData("Network.setRequestInterception")
  @TestData("DOM.setFileInputFiles")
  @TestData("Input.dispatchDragEvent")
  @TestData("Input.setInterceptDrags")
  @TestData("DOM.getFileInfo")
  @TestData("Input.setIgnoreInputEvents")
  @TestData("Target.createTarget")
  @TestData("Browser.close")
  public async refusesAMethodThatNavigatesOrUndoesWhatTheHostHolds(name: string): Promise<void> {
    Assert.areEqual(`${ModuleWebViewsTests.PATH} ${Resources.formatWebViewMethodRefused(name)}.`, await ModuleWebViewsTests.failAsync(JSON.stringify({ methods: [{ name }] })));
  }

  @TestMethod
  @TestData("\"Page.loadEventFired\"", "must list its events as an array")
  @TestData("[\"page.loadEventFired\"]", "must list its events once each as a debugging protocol domain, a dot and a name, such as Page.loadEventFired")
  @TestData("[1]", "must list its events once each as a debugging protocol domain, a dot and a name, such as Page.loadEventFired")
  @TestData("[\"Page.loadEventFired\",\"Page.loadEventFired\"]", "must list its events once each as a debugging protocol domain, a dot and a name, such as Page.loadEventFired")
  public async refusesEventsThatAreNotDistinctDomainEvents(events: string, problem: string): Promise<void> {
    Assert.areEqual(`${ModuleWebViewsTests.PATH} ${problem}.`, await ModuleWebViewsTests.failAsync(`{"events":${events}}`));
  }

  @TestMethod
  @TestData("[]", "must give the parameters of Page.captureScreenshot as an object from each name to its rule")
  @TestData("{\"Format\":{}}", "names the parameter Page.captureScreenshot.Format, which is not a lowercase letter followed by letters and digits")
  @TestData("{\"format\":\"png\"}", "must give Page.captureScreenshot.format a rule of only required, values, minimum, maximum, maxLength, fields")
  @TestData("{\"format\":{\"pattern\":\"png\"}}", "must give Page.captureScreenshot.format a rule of only required, values, minimum, maximum, maxLength, fields")
  @TestData("{\"format\":{\"values\":[\"png\"],\"maxLength\":3}}", "must give Page.captureScreenshot.format at most one of values, a minimum and maximum, a maxLength and fields")
  @TestData("{\"format\":{\"minimum\":0,\"fields\":{}}}", "must give Page.captureScreenshot.format at most one of values, a minimum and maximum, a maxLength and fields")
  @TestData("{\"format\":{\"required\":\"yes\"}}", "must give Page.captureScreenshot.format a required of true or false")
  @TestData("{\"format\":{\"values\":\"png\"}}", "must give Page.captureScreenshot.format values that are distinct texts, numbers or booleans, at least one")
  @TestData("{\"format\":{\"values\":[]}}", "must give Page.captureScreenshot.format values that are distinct texts, numbers or booleans, at least one")
  @TestData("{\"format\":{\"values\":[\"png\",\"png\"]}}", "must give Page.captureScreenshot.format values that are distinct texts, numbers or booleans, at least one")
  @TestData("{\"format\":{\"values\":[null]}}", "must give Page.captureScreenshot.format values that are distinct texts, numbers or booleans, at least one")
  @TestData("{\"format\":{\"values\":[{}]}}", "must give Page.captureScreenshot.format values that are distinct texts, numbers or booleans, at least one")
  @TestData("{\"quality\":{\"minimum\":\"0\"}}", "must give Page.captureScreenshot.quality a minimum and maximum that are numbers, the minimum no greater than the maximum")
  @TestData("{\"quality\":{\"maximum\":\"9\"}}", "must give Page.captureScreenshot.quality a minimum and maximum that are numbers, the minimum no greater than the maximum")
  @TestData("{\"quality\":{\"minimum\":null}}", "must give Page.captureScreenshot.quality a minimum and maximum that are numbers, the minimum no greater than the maximum")
  @TestData("{\"quality\":{\"maximum\":null}}", "must give Page.captureScreenshot.quality a minimum and maximum that are numbers, the minimum no greater than the maximum")
  @TestData("{\"quality\":{\"minimum\":5,\"maximum\":1}}", "must give Page.captureScreenshot.quality a minimum and maximum that are numbers, the minimum no greater than the maximum")
  @TestData("{\"label\":{\"maxLength\":0}}", "must give Page.captureScreenshot.label a maxLength that is a positive whole number")
  @TestData("{\"label\":{\"maxLength\":1.5}}", "must give Page.captureScreenshot.label a maxLength that is a positive whole number")
  @TestData("{\"label\":{\"maxLength\":\"5\"}}", "must give Page.captureScreenshot.label a maxLength that is a positive whole number")
  @TestData("{\"clip\":{\"fields\":[]}}", "must give the parameters of Page.captureScreenshot.clip as an object from each name to its rule")
  @TestData("{\"clip\":{\"fields\":{\"x\":{\"maxLength\":-1}}}}", "must give Page.captureScreenshot.clip.x a maxLength that is a positive whole number")
  public async refusesParameterRulesThatAreNotWellFormed(parameters: string, problem: string): Promise<void> {
    const text = `{"methods":[{"name":"${ModuleWebViewsTests.METHOD}","parameters":${parameters}}]}`;

    Assert.areEqual(`${ModuleWebViewsTests.PATH} ${problem}.`, await ModuleWebViewsTests.failAsync(text));
  }

  @TestMethod
  public async refusesKeysThatAreNotAListOfChords(): Promise<void> {
    const text = JSON.stringify({ keys: [{ name: "reload", keys: "Mod+R" }] });

    Assert.areEqual(`${ModuleWebViewsTests.PATH} must give reload.keys one to 4 keys.`, await ModuleWebViewsTests.failAsync(text));
  }

  private static async failAsync(text: string): Promise<string> {
    await using tree = await SourceTreeFixture.createAsync({ [ModuleWebViewsTests.PATH]: text });
    return (await Assert.throwsAsync(() => ModuleWebViews.readAsync(tree.path, ModuleWebViewsTests.FOLDER), BuildException)).message;
  }

  private static async assertOutputAsync(webViews: Readonly<Record<string, unknown>>, ending: string): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeModuleFileAsync("webViews.json", JSON.stringify(webViews));

    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    await new BuildCommandLine(app.path, {}, process.platform, process.arch, output, new PassThrough()).runAsync(["build"]);
    const text = chunks.join(String.empty);

    Assert.isTrue(text.endsWith(ending), text);
  }
}
