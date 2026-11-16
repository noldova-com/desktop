/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { commands } from "vitest/browser";

describe("failed module request setup", () => {
  const refusedAt = (name: string): string => `http://localhost:1/${name}-${crypto.randomUUID()}.js`;
  const failedLoadAsync = async (url: string): Promise<string> => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = url;
    const ended = new Promise<string>(resolve => script.addEventListener("error", t => resolve(t.type), { once: true }));
    document.head.append(script);
    const type = await ended;
    script.remove();
    return type;
  };
  const printedFor = async (url: string): Promise<readonly string[]> => (await commands.watchFailedModuleRequests()).filter(t => t.endsWith(` ${url}`));

  it("prints a module request the browser refuses once, with when it failed, its network error and its URL", async () => {
    const url = refusedAt("module");

    expect(await failedLoadAsync(url)).toBe("error");

    await expect.poll(() => printedFor(url)).toHaveLength(1);
    const printed = await printedFor(url);
    expect(printed[0]).toMatch(/^Failed module request at \d{4}-\d\d-\d\dT[\d:.]+Z: net::ERR_[A-Z_]+ http:/u);
  });

  it("prints a module the test server answers with an error status once, with when, its status, its type and its URL, and not the cancel the browser reports before a later failure", async () => {
    const url = new URL(`/tests/missing-module-${crypto.randomUUID()}.js`, location.origin).href;
    const later = refusedAt("later");

    expect(await failedLoadAsync(url)).toBe("error");
    expect(await failedLoadAsync(later)).toBe("error");
    await expect.poll(() => printedFor(later)).toHaveLength(1);

    const printed = await printedFor(url);
    expect(printed).toHaveLength(1);
    expect(printed[0]).toMatch(/^Failed module response at \d{4}-\d\d-\d\dT[\d:.]+Z: [45]\d\d /u);
  });

  it("prints a module the test server answers with a page rather than JavaScript once, with its status and its type, and not the cancel the browser reports before a later failure", async () => {
    const id = crypto.randomUUID();
    const page = new URL(location.href);
    page.searchParams.set("module", id);
    const later = refusedAt("later");

    expect(await failedLoadAsync(page.href)).toBe("error");
    expect(await failedLoadAsync(later)).toBe("error");
    await expect.poll(() => printedFor(later)).toHaveLength(1);

    const printed = (await commands.watchFailedModuleRequests()).filter(t => t.includes(`module=${id}`));
    expect(printed).toHaveLength(1);
    expect(printed[0]).toMatch(/^Failed module response at \S+: 200 text\/html/u);
  });

  it("prints nothing for a refused request that is not a module's, such as a fetch, which the browser reports before a later module's", async () => {
    const fetched = refusedAt("fetch");
    const module = refusedAt("module");

    await expect(fetch(fetched)).rejects.toThrow(TypeError);
    expect(await failedLoadAsync(module)).toBe("error");
    await expect.poll(() => printedFor(module)).toHaveLength(1);

    expect(await printedFor(fetched)).toEqual([]);
  });
});
