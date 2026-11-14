/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, computed, inject } from "@angular/core";

import { SearchSession } from "../models/search-session.js";
import type { SearchSourceContribution } from "../models/search-source-contribution.js";
import { ShellSearchSourcesService } from "./shell-search-sources.service.js";
import { WindowPartHostService } from "./window-part-host.service.js";
import { Resources } from "../../resources.js";

@Injectable({ providedIn: "root" })
export class SearchService {
  private readonly host: WindowPartHostService = inject(WindowPartHostService);
  private readonly shell: ShellSearchSourcesService = inject(ShellSearchSourcesService);

  public readonly sources: Signal<readonly SearchSourceContribution[]> = computed(() => [...this.host.searchSources(), this.shell.commandsSource, this.shell.settingsSource]);
  public readonly placeholder: Signal<string> = computed(() => Resources.formatSearchPlaceholder(this.sources().map(t => t.placeholderName)));

  public createSession(): SearchSession {
    return new SearchSession(this.sources(), Resources.commandsSearchSource, (source, error) =>
      this.host.log(source.name.slice(0, source.name.indexOf(Resources.contributionSeparator)), Resources.formatSearchSourceFailed(source.name, error)));
  }
}
