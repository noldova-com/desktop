/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly lineEnd: string = "\n";
  public static readonly encoding: BufferEncoding = "utf8";
  public static readonly pathSeparator: string = "/";
  public static readonly listSeparator: string = ", ";
  public static readonly space: string = " ";
  public static readonly indent: string = "  ";
  public static readonly dash: string = "-";
  public static readonly dot: string = ".";
  public static readonly jsonIndent: number = 2;
  public static readonly successExitCode: number = 0;
  public static readonly failedExitCode: number = 1;
  public static readonly sourceFolder: string = "src";
  public static readonly manifestFile: string = "package.json";
  public static readonly scriptExtension: string = ".ts";
  public static readonly declarationsExtension: string = ".d.ts";
  public static readonly markdownExtension: string = ".md";
  public static readonly nameField: string = "name";
  public static readonly fileField: string = "file";
  public static readonly summaryVariable: string = "GITHUB_STEP_SUMMARY";
  public static readonly usageExitCode: number = 2;
  public static readonly summaryAmpersand: string = "&";
  public static readonly summaryAmpersandEntity: string = "&amp;";
  public static readonly summaryLessThan: string = "<";
  public static readonly summaryLessThanEntity: string = "&lt;";
  public static readonly summaryGreaterThan: string = ">";
  public static readonly summaryGreaterThanEntity: string = "&gt;";
  public static readonly summaryPipe: string = "|";
  public static readonly summaryPipeEntity: string = "&#124;";
  public static readonly totalsVersionField: string = "version";
  public static readonly totalsRunnerField: string = "runner";
  public static readonly totalsTitleField: string = "title";
  public static readonly totalsShardField: string = "shard";
  public static readonly totalsDiscoveredField: string = "discovered";
  public static readonly totalsSelectedField: string = "selected";
  public static readonly totalsPassedField: string = "passed";
  public static readonly totalsFailedField: string = "failed";
  public static readonly totalsRerunPassedField: string = "rerunPassed";
  public static readonly totalsSkippedField: string = "skipped";
  public static readonly totalsUnselectedField: string = "unselected";
  public static readonly totalsUnreachedField: string = "unreached";
  public static readonly totalsSkipsField: string = "skips";
  public static readonly totalsTestField: string = "test";
  public static readonly totalsNamesField: string = "names";
  public static readonly totalsReasonField: string = "reason";
  public static readonly totalsFilesField: string = "files";
  public static readonly totalsExpectedField: string = "expected";
  public static readonly totalsCoverageField: string = "coverage";
  public static readonly totalsUnitField: string = "unit";
  public static readonly totalsCoveredField: string = "covered";
  public static readonly totalsTotalField: string = "total";
  public static readonly totalsDuplicatesField: string = "duplicates";
  public static readonly totalsEmptyField: string = "empty";
  public static readonly testIdentitySeparator: string = " › ";
  public static readonly testOptionsDocuments: string = "documents";
  public static readonly testOptionsFilterOption: string = "--filter";
  public static readonly testOptionsRepeatOption: string = "--repeat";
  public static readonly testOptionsRerunFailedOption: string = "--rerun-failed";
  public static readonly testOptionsSkipTestDetailsOption: string = "--skip-test-details";
  public static readonly testOptionsSkipCoverageDetailsOption: string = "--skip-coverage-details";
  public static readonly testOptionsOptionPrefix: string = "--";
  public static readonly testOptionsCountPattern: RegExp = /^[1-9]\d*$/;
  public static readonly testOptionsDocumentsAlone: string = "documents takes no other option.";
  public static readonly testOptionsFilterValue: string = "--filter takes a text that is not blank and does not start with --.";
  public static readonly testOptionsRepeatValue: string = "--repeat takes a whole number from 1.";
  public static readonly testOptionsRepeatOnce: string = "--repeat may be given only once.";
  public static readonly testOptionsRerunFailedOnce: string = "--rerun-failed may be given only once.";
  public static readonly testOptionsShardPattern: RegExp = /^--shard=([1-9]\d*)\/([1-9]\d*)$/;
  public static readonly testOptionsShardPrefix: string = "--shard=";
  public static readonly testOptionsShardParts: number = 2;
  public static readonly testPartPackageTests: number = 1;
  public static readonly testOptionsShardValue: string = "--shard takes 1/2, the package tests, or 2/2, every other check.";
  public static readonly testOptionsShardOnce: string = "--shard may be given only once.";
  public static readonly testOptionsShardFiltered: string = "--shard runs a whole part, so it takes no --filter.";
  public static readonly testOptionsDefaultRepeat: number = 1;
  public static readonly buildCommandLineSegments: readonly string[] = ["src", "noldova.desktop.build", "src", "services", "build-command-line.ts"];
  public static readonly buildCommand: string = "build";
  public static readonly parentFolder: string = "..";
  public static readonly nodeModulesFolder: string = "node_modules";
  public static readonly npmPathVariable: string = "npm_execpath";
  public static readonly buildStdio: "inherit" = "inherit";
  public static readonly buildBootstrapArguments: readonly string[] = ["ci", "--ignore-scripts", "--no-audit", "--no-fund"];
  public static readonly buildListCopiesOption: string = "--list-copies";
  public static readonly buildInstallCommand: string = "install";
  public static readonly npmCiLogsPrefix: string = "npm-ci-logs-";
  public static readonly npmCiLogsVariable: string = "npm_config_logs_dir";
  public static readonly npmCiErrorCodePattern: RegExp = /^\d+ error code (ETIMEDOUT|ECONNRESET)\r?$/m;
  public static readonly npmCiReadPattern: RegExp = /^\d+ error (syscall read|network aborted)\r?$/m;
  public static readonly npmCiRequestPattern: RegExp = /^\d+ http fetch /;
  public static readonly npmCiRequestLines: number = 5;
  public static readonly npmCiRetryPause: number = 5000;
  public static readonly uiWorkflowsCiScript: readonly string[] = ["scripts", "ui-workflows.ts"];
  public static readonly uiWorkflowsCiSessionBus: string = "sh";
  public static readonly uiWorkflowsCiSessionBusArguments: readonly string[] = ["-c", "stop() { { kill \"$bus\"; for tick in 1 2 3 4 5 6 7 8 9 10; do ps -o stat= -p \"$bus\" | grep -qv '^Z' || break; sleep 0.5; done; kill -KILL \"$bus\"; wait \"$bus\"; } 2>/dev/null; }; folder=$(mktemp -d) || exit 1; mkfifo \"$folder/bus\" || { rm -rf \"$folder\"; exit 1; }; dbus-daemon --session --nofork --print-address=3 3> \"$folder/bus\" & bus=$!; (sleep \"${NOLDOVA_SESSION_BUS_START_SECONDS:-30}\" & sleeper=$!; trap 'kill \"$sleeper\" 2>/dev/null; exit 0' TERM; wait \"$sleeper\" && kill \"$bus\" 2>/dev/null) & watchdog=$!; if ! read -r DBUS_SESSION_BUS_ADDRESS < \"$folder/bus\"; then echo \"The session bus did not start.\" >&2; { kill \"$watchdog\"; wait \"$watchdog\"; kill \"$bus\"; wait \"$bus\"; } 2>/dev/null; rm -rf \"$folder\"; exit 1; fi; kill \"$watchdog\" 2>/dev/null; wait \"$watchdog\"; export DBUS_SESSION_BUS_ADDRESS; status=0; \"$@\" || status=$?; stop; rm -rf \"$folder\"; exit \"$status\"", "sh"];
  public static readonly uiWorkflowsCiVirtualDisplay: string = "xvfb-run";
  public static readonly uiWorkflowsCiVirtualDisplayArguments: readonly string[] = ["--auto-servernum", "--server-args=-screen 0 2560x1440x24"];
  public static readonly carryDocsUsage: string = "Usage: node scripts/carry-docs.ts <Angular project file> <compiled package folder> <entry file>..., run from the repository's root\n";
  public static readonly carryDocsPurpose: string = "declaration-docs";
  public static readonly apiEntryFolder: string = "api";
  public static readonly carryDocsRule: string = "Each export and public member of an entry is declared and documented in its src/api/<entry>.d.ts.";
  public static readonly formatDocumentsUsage: string = "Usage: npm run format:documents\n";
  public static readonly angularTestLogFile: string = "_build/angular-tests.log";
  public static readonly angularTestRetryVariable: string = "NOLDOVA_TEST_RETRY";
  public static readonly angularTestDebugVariable: string = "DEBUG";
  public static readonly angularTestLoggedNamespaces: string = "vite:deps";
  public static readonly angularTestProjectFolder: string = "noldova.desktop.window";
  public static readonly angularTestWorkspaceFile: string = "angular.json";
  public static readonly typeScriptProjectFile: string = "tsconfig.json";
  public static readonly angularTestDependencyCache: string = "node_modules/.vite";
  public static readonly angularTestCli: string = "node_modules/@angular/cli/bin/ng.js";
  public static readonly angularTestArguments: readonly string[] = ["test", "--reporters=default", "--reporters=json"];
  public static readonly angularTestOutputFileOption: string = "--output-file";
  public static readonly angularTestIncludeOption: string = "--include";
  public static readonly angularTestNoCoverageOption: string = "--no-coverage";
  public static readonly angularTestReportSegments: readonly string[] = ["_build", "angular-tests.json"];
  public static readonly angularTestCoverageSegments: readonly string[] = ["_build", "angular-coverage"];
  public static readonly angularTestCoverageSummaryFile: string = "coverage-summary.json";
  public static readonly angularTestCoverageUnit: string = "statements";
  public static readonly angularTestTarget: string = "test";
  public static readonly angularTestPassedStatus: string = "passed";
  public static readonly angularTestRetryOn: string = "1";
  public static readonly angularTestOptionsPath: readonly string[] = ["architect", Resources.angularTestTarget, "options"];
  public static readonly angularWorkspaceProjectsField: string = "projects";
  public static readonly angularTestExcludeField: string = "exclude";
  public static readonly angularTestIncludeField: string = "include";
  public static readonly angularTestCompilerOptionsField: string = "compilerOptions";
  public static readonly angularTestPathsField: string = "paths";
  public static readonly angularReportTestResultsField: string = "testResults";
  public static readonly angularCoverageTotalField: string = "total";
  public static readonly angularCoverageCoveredField: string = "covered";
  public static readonly angularReportAssertionResultsField: string = "assertionResults";
  public static readonly angularReportStatusField: string = "status";
  public static readonly angularReportFailureMessagesField: string = "failureMessages";
  public static readonly angularReportFullNameField: string = "fullName";
  public static readonly angularTestDebugNamespaceSeparator: string = ",";
  public static readonly angularTestFailedStatus: string = "failed";
  public static readonly angularTestPendingStatus: string = "pending";
  public static readonly angularTestSkipReasons: ReadonlyMap<string, string> = new Map([["skipped", "No reason given."], ["todo", "To do."]]);
  public static readonly angularReportAncestorTitlesField: string = "ancestorTitles";
  public static readonly angularReportTitleField: string = "title";
  public static readonly packageTestRunner: string = "package";
  public static readonly packageTestEntrySegments: readonly string[] = ["scripts", "checks", "serial-test-run.ts"];
  public static readonly packageTestCoverageSegments: readonly string[] = ["_build", "coverage"];
  public static readonly packageTestSourceMapsOption: string = "--enable-source-maps";
  public static readonly serialTestFiltersVariable: string = "NOLDOVA_TEST_FILTERS";
  public static readonly serialTestResultFileVariable: string = "NOLDOVA_TEST_RESULT_FILE";
  public static readonly serialTestGroupVariable: string = "NOLDOVA_TEST_GROUP";
  public static readonly serialTestPartsVariable: string = "NOLDOVA_TEST_PARTS";
  public static readonly packageTestRerunLabel: string = ", its failed tests run again";
  public static readonly buildFolder: string = "_build";
  public static readonly packageTestCompiledTestsFolder: string = "tests";
  public static readonly packageTestResultName: string = "test-result";
  public static readonly packageTestRerunResultName: string = "test-rerun-result";
  public static readonly packageTestLogName: string = "package-tests";
  public static readonly packageTestRerunLogName: string = "package-tests-rerun";
  public static readonly packageTestResultExtension: string = ".json";
  public static readonly packageTestLogExtension: string = ".log";
  public static readonly packageTestRuntimePackage: string = "@noldova/desktop.runtime";
  public static readonly packageTestRuntimeProcessPaths: readonly string[] = [
    "services/process",
    "services/client",
    "models/app-image-source.test.js",
    "models/process-launch-command.test.js",
    "models/watched-pseudo-terminal-handle.test.js",
    "services/database/database-backup.test.js",
    "services/database/migrated-database.test.js",
    "services/discovery/discovery.reader.test.js",
    "services/files/file-renamer.test.js",
    "services/files/folder-watch.test.js",
    "services/files/module-files.test.js",
    "services/installation/installation.test.js",
    "services/lifetime/app-image-copy-cleanup.test.js",
    "services/lifetime/move-aside-method.test.js",
    "services/lifetime/update-preparation.test.js"
  ];
  public static readonly packageTestElectronPackage: string = "@noldova/desktop.electron";
  public static readonly packageTestCliPackage: string = "@noldova/desktop.cli";
  public static readonly serialTestNodeCoverageVariable: string = "NODE_V8_COVERAGE";
  public static readonly packageTestTotalsTitle: string = "Package tests";
  public static readonly serialTestResultsFileVariable: string = "NOLDOVA_TEST_RESULTS_FILE";
  public static readonly packageTestResultsName: string = "package-test-results";
  public static readonly packageTestRerunning: string = "Running the failed package tests once more.\n";
  public static readonly packageTestUnit: string = "package tests";
  public static readonly packageTestAllFilters: readonly string[] = [];
  public static readonly packageTestNoTests: string = "No package has tests.\n";
  public static readonly packageTestNoneDiscovered: string = "Packages have test output, but the test framework discovered no test in it.\n";
  public static readonly packageTestGroupSeparator: string = "; ";
  public static readonly testResultsIsCompleteField: string = "isComplete";
  public static readonly testResultsFailedField: string = "failed";
  public static readonly testResultsIdentityField: string = "identity";
  public static readonly testResultsFailureField: string = "failure";
  public static readonly packageTestCheckTitle: string = "Package tests and coverage";
  public static readonly serialTestDefaultTimeout: number = 40_000;
  public static readonly serialTestPackagingTimeout: number = 90_000;
  public static readonly serialTestPackagingCategory: string = "Packaging";
  public static readonly serialTestGeneralSuite: string = "General";
  public static readonly serialTestSlowestCount: number = 10;
  public static readonly serialTestShutdownGrace: number = 1000;
  public static readonly serialTestStandardErrorDescriptor: number = 2;
  public static readonly serialTestRemovalRetries: number = 5;
  public static readonly serialTestMethodWithoutClass: string = "A test method completed before its class started.";
  public static readonly serialTestSkipDetailsVariable: string = "NOLDOVA_TEST_SKIP_TEST_DETAILS";
  public static readonly serialTestTimeoutVariable: string = "NOLDOVA_TEST_TIMEOUT_MILLISECONDS";
  public static readonly serialTestPackagingTimeoutVariable: string = "NOLDOVA_TEST_PACKAGING_TIMEOUT_MILLISECONDS";
  public static readonly serialTestTemporaryRootVariable: string = "NOLDOVA_TEST_TEMPORARY_ROOT";
  public static readonly serialTestCoverageDirectoryVariable: string = "NOLDOVA_TEST_COVERAGE_DIRECTORY";
  public static readonly serialTestTemporaryVariables: readonly string[] = ["TMPDIR", "TEMP", "TMP"];
  public static readonly serialTestTemporaryPrefix: string = "noldova-test-run-";
  public static readonly serialTestPairRequired: string = "Each test project requires a package name and a root directory.";
  public static readonly serialTestFiltersInvalid: string = "The test filters must be a JSON array of non-empty strings.";
  public static readonly serialTestTimeoutInvalid: string = "The timeout must be a positive integer of milliseconds.";
  public static readonly serialTestNoTestMatched: string = "No test matched the filters; a filter that selects nothing fails the run.\n";
  public static readonly serialTestPartsEmpty: string = "These parts of the test process hold no test file, so their folders and files no longer match the tests' and the split in scripts/checks/package-test-check.ts needs them renamed: ";
  public static readonly testProcessPartWindowsSeparator: RegExp = /\\/g;
  public static readonly testProcessPartsInvalid: string = "The test process's parts must be a JSON array of package names, each with its paths and whether it leaves them out.";
  public static readonly testProcessPartExceptPrefix: string = "but ";
  public static readonly testProcessPartPathsField: string = "paths";
  public static readonly testProcessPartIsExceptField: string = "isExcept";
  public static readonly flakyRecordSegments: readonly string[] = ["_build", "flaky-tests.json"];
  public static readonly flakyRecordMaximumFailureLines: number = 20;
  public static readonly flakyRecordMaximumFailureLength: number = 2000;
  public static readonly flakyRecordEllipsis: string = "…";
  public static readonly flakyRecordMalformed: string = "The flaky test record is not a list of tests with a runner, a file, a name and a failure.";
  public static readonly flakyRecordSummaryHeader: string = "### Flaky tests\n\nThese tests failed, then passed when they ran again in the same job.\n\n| Runner | Test | File | Failure |\n|---|---|---|---|\n";
  public static readonly flakyRecordRunnerField: string = "runner";
  public static readonly flakyRecordFailureField: string = "failure";
  public static readonly flakyRecordSummaryEscapes: ReadonlyMap<string, string> = new Map([["&", "&amp;"], ["<", "&lt;"], [">", "&gt;"], ["|", "&#124;"], ["`", "&#96;"], ["\n", " "]]);
  public static readonly loggedProcessStdio: ["inherit", "pipe", "pipe"] = ["inherit", "pipe", "pipe"];
  public static readonly packageCoverageUnit: string = "files";
  public static readonly packageCoverageIncomplete: string = "Production coverage is incomplete.\n";
  public static readonly angularTestRunner: string = "angular";
  public static readonly angularTestUnit: string = "spec files";
  public static readonly angularTestTotalsTitle: string = "Angular tests";
  public static readonly angularTestNoReport: string = "The Angular tests passed but wrote no report of the spec files they ran.\n";
  public static readonly angularTestLogHint: string = `The Angular tests' full output is in ${Resources.angularTestLogFile}.\n`;
  public static readonly angularTestEndedBySignal: string = "The Angular tests were ended by a signal and wrote no report.\n";
  public static readonly angularTestCheckTitle: string = "Angular tests and coverage";
  public static readonly testWaitContractFile: string = "README.md";
  public static readonly testWaitListHeader: string = "| Test file | Why it pauses |";
  public static readonly testWaitListRow: RegExp = /^\| `([^`]+)` \| .+ \|$/;
  public static readonly testWaitTableRowPrefix: string = "|";
  public static readonly testWaitSourcePrefix: string = "src/";
  public static readonly testWaitPauses: readonly RegExp[] = [
    /\bimport\s*(?:\{[^}]*\b(?:setTimeout|scheduler)\b[^}]*\}|\*\s*as\s+[\w$]+|[\w$]+)\s*from\s*["'](?:node:)?timers\/promises["']/g,
    /\bscheduler\.wait\s*\(/g,
    /\bAtomics\.wait(?:Async)?\s*\(/g,
    /\bwaitForTimeout\s*\(/g,
    /(?<![.\w$])setTimeout\(\s*[A-Za-z_$][\w$]*\s*,/g,
    /(?<![.\w$])setTimeout\([^\n]*,\s*\d[\d_]*\s*\)/g,
    /\bnew\s+Promise\b(?:<[^>\n]*>)?\(\s*\(?\s*[A-Za-z_$][\w$]*\s*\)?\s*=>\s*\{?\s*setTimeout\s*\(/g
  ];
  public static readonly testWaitQuotes: readonly string[] = ["\"", "'", "`"];
  public static readonly testWaitEscape: string = "\\";
  public static readonly testWaitCheckTitle: string = "Test waits";
  public static readonly scriptTestArguments: readonly string[] = ["--test", "--test-timeout=10000", "scripts/angular/tests/**/*.test.ts", "scripts/checks/tests/**/*.test.ts", "scripts/tests/**/*.test.ts", "src/noldova.desktop.window/scripts/angular/tests/**/*.test.ts"];
  public static readonly scriptTestCheckTitle: string = "Script tests";
  public static readonly typeCheckProjectArguments: readonly string[] = ["--project", "scripts/tsconfig.json"];
  public static readonly typeCheckTitle: string = "Script types";
  public static readonly windowNodeLoadScript: string = "scripts/node-load/load.mts";
  public static readonly windowNodeLoadProjectArguments: readonly string[] = ["--project", "scripts/node-load/tsconfig.json"];
  public static readonly windowNodeLoadCheckTitle: string = "Window in Node.js";
  public static readonly declarationConsumerProjects: readonly string[] = ["build", "cli", "electron", "runtime"].map(t => `scripts/declarations/tsconfig-${t}.json`);
  public static readonly projectOption: string = "--project";
  public static readonly declarationConsumerCheckTitle: string = "Declarations without types";
  public static readonly markupCommentStart: string = "<!--";
  public static readonly markupCommentEnd: string = "-->";
  public static readonly apiDocLicenseTag: string = "license";
  public static readonly apiDocLineBreakPattern: RegExp = /\r?\n/;
  public static readonly apiDocWindowsLineBreak: string = "\r\n";
  public static readonly apiDocIndentPattern: RegExp = /^[ \t]*/;
  public static readonly apiMainEntrySubpath: string = ".";
  public static readonly apiMainEntryName: string = "index";
  public static readonly apiEntryScriptPattern: RegExp = /\.[cm]?js$/;
  public static readonly manifestExportsField: string = "exports";
  public static readonly apiEntryTypesField: string = "types";
  public static readonly apiEntryRelativePrefix: string = "./";
  public static readonly apiEntryTypesPattern: RegExp = /^\.\/api\/([a-z][a-z0-9-]*)\.d\.ts$/;
  public static readonly apiPartExampleRoot: readonly string[] = [Resources.nodeModulesFolder, ".cache", "noldova"];
  public static readonly apiGeneratedPrefix: string = "ɵ";
  public static readonly apiPrototypeMember: string = "prototype";
  public static readonly apiConstructorMember: string = "__constructor";
  public static readonly apiSymbolMemberNames: ReadonlyMap<string, string> = new Map([
    [Resources.apiConstructorMember, ".constructor"],
    ["__call", " call signature"],
    ["__new", " construct signature"],
    ["__index", " index signature"]
  ]);
  public static readonly parentFolderPrefix: string = `${Resources.parentFolder}${Resources.pathSeparator}`;
  public static readonly documentLinkRepositoryUrl: string = "https://github.com/noldova-com/desktop/";
  public static readonly documentLinkRepositoryFilePattern: RegExp = /^(?:blob|tree)\/main\/(.*)$/;
  public static readonly documentLinkSchemePattern: RegExp = /^[a-z][a-z0-9+.-]*:/i;
  public static readonly documentLinkExternalProtocols: readonly string[] = ["http:", "https:", "mailto:"];
  public static readonly documentLinkAnchorSeparator: string = "#";
  public static readonly documentLinkRootPrefix: string = "/";
  public static readonly documentLinkRootFolders: readonly string[] = [".", ""];
  public static readonly documentLinkTrailingSeparatorPattern: RegExp = /\/+$/;
  public static readonly documentLinkOutside: string = "points outside the repository";
  public static readonly documentLinkInvalidPath: string = "has an invalid percent-encoded path";
  public static readonly documentLinkInvalidUrl: string = "is not a valid URL";
  public static readonly documentLinkUnsupportedProtocol: string = "uses an unsupported protocol";
  public static readonly documentLinkMissingFile: string = "points to a missing file";
  public static readonly gitAttributesFile: string = ".gitattributes";
  public static readonly gitAttributesLineEndingRule: string = "* text=auto eol=lf";
  public static readonly gitAttributesMissing: string = `${Resources.gitAttributesFile}: is missing; it holds "${Resources.gitAttributesLineEndingRule}", which keeps every text file's line endings LF.`;
  public static readonly gitAttributesLacking: string = `${Resources.gitAttributesFile}: lacks the line "${Resources.gitAttributesLineEndingRule}", which keeps every text file's line endings LF.`;
  public static readonly markdownOpeningFencePattern: RegExp = /^ {0,3}(`{3,}|~{3,})/;
  public static readonly markdownClosingFencePattern: RegExp = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
  public static readonly markdownHeadingPattern: RegExp = /^ {0,3}#{1,6}(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
  public static readonly markdownCodeSpanPattern: RegExp = /(`+).*?\1/g;
  public static readonly markdownInlineLinkPattern: RegExp = /!?\[(?:[^[\]]|\[[^[\]]*\])*\]\(\s*(<[^<>]+>|[^\s<>()]+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
  public static readonly markdownHeadingLinkPattern: RegExp = /!?\[((?:[^[\]]|\[[^[\]]*\])*)\]\([^)]*\)/g;
  public static readonly markdownAngleBracketsPattern: RegExp = /^<(.*)>$/;
  public static readonly markdownDefinitionPattern: RegExp = /^ {0,3}\[[^\]]+\]:[ \t]*<?([^\s<>]+)>?/;
  public static readonly markdownRemovedAnchorCharacters: RegExp = /[^\p{L}\p{M}\p{N}\p{Pc} -]/gu;
  public static readonly markdownSpacePattern: RegExp = / /g;
  public static readonly markdownFirstGroupReplacement: string = "$1";
  public static readonly textFormatNullByte: number = 0x00;
  public static readonly textFormatLineFeedByte: number = 0x0a;
  public static readonly textFormatByteOrderMark: readonly number[] = [0xef, 0xbb, 0xbf];
  public static readonly textFormatCarriageReturn: string = "\r";
  public static readonly textFormatTrailingWhitespacePattern: RegExp = /[ \t]\r?$/;
  public static readonly licenseNoticeBlockLinePrefix: string = " *";
  public static readonly repositoryFilesListArguments: readonly string[] = ["ls-files", "-z", "--cached", "--others", "--exclude-standard"];
  public static readonly repositoryFilesEntrySeparator: string = "\0";
  public static readonly styleBlockCommentStart: string = "/*";
  public static readonly styleBlockCommentEnd: string = "*/";
  public static readonly styleLineCommentStart: string = "//";
  public static readonly styleUrlStart: string = "url(";
  public static readonly styleUrlEnd: string = ")";
  public static readonly styleEscapeCharacter: string = "\\";
  public static readonly styleQuotes: ReadonlySet<string> = new Set(["\"", "'"]);
  public static readonly sourceScriptExtensions: ReadonlySet<string> = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"]);
  public static readonly sourceStyleExtensions: ReadonlySet<string> = new Set([".css"]);
  public static readonly sourceCExtension: string = ".c";
  public static readonly jsonExtension: string = ".json";
  public static readonly sourceTestFolders: ReadonlySet<string> = new Set(["tests", "e2e", "fixtures"]);
  public static readonly sourceShellOwner: string = "desktop";
  public static readonly sourceFolderPrefix: string = `${Resources.sourceFolder}${Resources.pathSeparator}`;
  public static readonly sourceModulesFolder: string = "src/modules";
  public static readonly sourceModuleFilePattern: RegExp = /^src\/modules\/([^/]+)\/./;
  public static readonly sourceScannedExtensions: ReadonlySet<string> = new Set([
    ".ts", ".mts", ".cts", ".js", ".mjs", ".cjs", ".html", ".css", ".json"
  ]);
  public static readonly versionFile: string = "version.json";
  public static readonly versionFileVersionField: string = "version";
  public static readonly versionFileCheckTitle: string = "Version file";
  public static readonly versionFileCaseManifest: string = JSON.stringify({ name: "sample", version: "0.0.2" });
  public static readonly versionFileCases: readonly (readonly [string, string | null, boolean, string])[] = [
    ["the same version in both", JSON.stringify({ version: "0.0.2" }), true, "both hold 0.0.2"],
    ["versions that differ", JSON.stringify({ version: "0.0.1" }), false, "holds the version 0.0.1"],
    ["no version.json", null, false, `${Resources.versionFile} can't be read`],
    ["a version.json that isn't JSON", "{ version: 0.0.2", false, `${Resources.versionFile} isn't valid JSON`],
    ["a version.json without a version", JSON.stringify({ name: "sample" }), false, `${Resources.versionFile} holds no version string`],
    ["a version that isn't a string", JSON.stringify({ version: 2 }), false, `${Resources.versionFile} holds no version string`]
  ];
  public static readonly versionFileCaseFolderPrefix: string = "version-file-";
  public static readonly versionFileCasePassed: string = "passed";
  public static readonly versionFileCaseFailed: string = "failed";
  public static readonly versionFileCasePass: string = "pass";
  public static readonly versionFileCaseFail: string = "fail";
  public static readonly versionFileCaseCheckTitle: string = "Version file cases";
  public static readonly angularCorePackage: string = "@angular/core";
  public static readonly angularAppFolder: string = "app";
  public static readonly anonymousDeclarationName: string = "(anonymous)";
  public static readonly conceptScriptFile: RegExp = /^src\/.+\.[cm]?ts$/;
  public static readonly conceptFolderTitle: string = "Concept folders";
  public static readonly conceptFolderKebabCase: RegExp = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  public static readonly conceptFolderSourceTrees: ReadonlySet<string> = new Set([Resources.angularAppFolder, "testing"]);
  public static readonly conceptFolderExceptionSuffix: string = "Exception";
  public static readonly conceptFolderCategories: ReadonlySet<string> = new Set(["api", "decorators", "enums", "exceptions", "extensions", "interfaces", "intrinsics", "models", "services", "types"]);
  public static readonly conceptFolderAngularFolders: ReadonlySet<string> = new Set(["components", "directives"]);
  public static readonly conceptFolderInterfaces: readonly [folder: string, kind: string] = ["interfaces", "an interface"];
  public static readonly conceptFolderEnums: readonly [folder: string, kind: string] = ["enums", "an enum"];
  public static readonly conceptFolderExceptions: readonly [folder: string, kind: string] = ["exceptions", "an exception class"];
  public static readonly conceptFolderTypes: readonly [folder: string, kind: string] = ["types", "a type alias"];
  public static readonly conceptFolderKinds: readonly (readonly [folder: string, kind: string])[] = [Resources.conceptFolderInterfaces, Resources.conceptFolderEnums, Resources.conceptFolderExceptions, Resources.conceptFolderTypes];
  public static readonly conceptFolderRule: string = "https://github.com/noldova-com/.github/blob/main/standards/stacks/TYPESCRIPT.md, Files and folders, puts each concept in its category folder, which holds only its kind, and its Names section names folders in lowercase kebab-case.";
  public static readonly conceptFileTitle: string = "Concept files";
  public static readonly conceptFileWordStart: RegExp = /(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/g;
  public static readonly conceptFileCommandSeparator: RegExp = /\s+/;
  public static readonly conceptFileScriptsField: string = "scripts";
  public static readonly conceptFileProductNames: readonly string[] = ["GitHub", "TypeScript"];
  public static readonly conceptFileRoleWords: ReadonlySet<string> = new Set(["node", "parser", "lexer", "reader", "validator", "exception", "service", "component", "directive", "resources"]);
  public static readonly conceptFileRule: string = "https://github.com/noldova-com/.github/blob/main/standards/CODE.md, Files and classes, gives each implementation file one named concept, and documents/ARCHITECTURE.md, Code, names the file for it.";
  public static readonly conceptFileNotManifest: string = `${Resources.manifestFile}: is not a JSON object whose scripts, if any, are an object, which name the files that keep their own names; ${Resources.conceptFileRule}${Resources.lineEnd}`;
  public static readonly nameUniquenessTitle: string = "Unique names";
  public static readonly nameUniquenessSelectorSeparator: string = ",";
  public static readonly nameUniquenessElementSelector: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  public static readonly nameUniquenessSelectorPrefix: string = "nol-";
  public static readonly nameUniquenessTokenDefinition: RegExp = /--nol-[a-z0-9-]+(?=\s*:)/g;
  public static readonly nameUniquenessTokenPrefix: string = "--nol-";
  public static readonly nameUniquenessShellLabel: string = "the shell";
  public static readonly reservedNamesTitle: string = "Reserved names";
  public static readonly buildResourcesFile: string = "src/noldova.desktop.build/src/resources.ts";
  public static readonly reservedNamesRootFromChecks: readonly string[] = ["..", ".."];
  public static readonly reservedNamesCliFile: string = "src/noldova.desktop.cli/src/resources.ts";
  public static readonly reservedNamesRuntimeFile: string = "src/noldova.desktop.runtime/src/resources.ts";
  public static readonly reservedNamesCommandsField: string = "ownCommandNames";
  public static readonly reservedNamesValueOptionsField: string = "valueOptionNames";
  public static readonly reservedNamesSwitchesField: string = "switchNames";
  public static readonly reservedNamesDeviceNamesField: string = "windowsDeviceNames";
  public static readonly reservedNamesReservedCommandsField: string = "reservedCommands";
  public static readonly reservedNamesReservedOptionsField: string = "reservedOptions";
  public static readonly reservedNamesCommandsOwner: string = "the command line's own commands";
  public static readonly reservedNamesOptionsOwner: string = "the command line's own options";
  public static readonly reservedNamesDeviceNamesOwner: string = "the runtime's Windows device names";
  public static readonly reservedNamesComparedSeparator: string = ",";
  public static readonly moduleImportCheckTitle: string = "Module imports";
  public static readonly relativeImportPrefix: string = ".";
  public static readonly absoluteImportPrefix: string = "/";
  public static readonly builtInImportPrefix: string = "node:";
  public static readonly scopedPackageNameSegments: number = 2;
  public static readonly unscopedPackageNameSegments: number = 1;
  public static readonly moduleImportNotUsable: string = "is not a Noldova Desktop package a module may use";
  public static readonly moduleImportPartNames: readonly string[] = ["protocol", "runtime", "window", "cli"];
  public static readonly moduleImportSubpathPrefix: string = "./";
  public static readonly moduleImportSubpathWildcard: string = "*";
  public static readonly moduleImportSubpathRoot: string = ".";
  public static readonly moduleImportAbsolutePath: string = "is an absolute path";
  public static readonly webViewNamesCheckTitle: string = "Web view names";
  public static readonly checksToRepositoryRoot: string = "../..";
  public static readonly webViewNamesProtocolFile: string = "src/noldova.desktop.protocol/src/resources.ts";
  public static readonly webViewNamesMethodPatternField: string = "webViewMethodPattern";
  public static readonly webViewNamesNamePatternField: string = "camelCaseNamePattern";
  public static readonly webViewNamesMemberPatternField: string = "memberPattern";
  public static readonly webViewNamesRefusedMethodsField: string = "webViewRefusedMethods";
  public static readonly webViewNamesRefusedDomainsField: string = "webViewRefusedDomains";
  public static readonly webViewNamesMethodPatternOwner: string = "the protocol's method pattern";
  public static readonly webViewNamesMemberPatternOwner: string = "the protocol's member pattern";
  public static readonly webViewNamesRefusedMethodsOwner: string = "the protocol's refused methods";
  public static readonly webViewNamesRefusedDomainsOwner: string = "the protocol's refused domains";
  public static readonly nativeElementAssertionCheckTitle: string = "nativeElement assertions";
  public static readonly nativeElementCall: string = String.raw`\((?:[^()]|\([^()]*\))*\)`;
  public static readonly nativeElementStep: string = String.raw`(?:\s*(?:\??\.[\w$]+|${Resources.nativeElementCall}|\[[^\]]*\]))`;
  public static readonly nativeElementChain: string = String.raw`[\w$]+${Resources.nativeElementStep}*?\.nativeElement`;
  public static readonly nativeElementQuery: string =
    String.raw`(?:\[\.\.\.)?${Resources.nativeElementChain}${Resources.nativeElementStep}*?\.querySelector(?:All)?\s*${Resources.nativeElementCall}\]?`;
  public static readonly nativeElementType: string = String.raw`(?!unknown\b)[A-Za-z_$][\w$<>|.[\]\s]*`;
  public static readonly nativeElementEnd: string = String.raw`\s*(?:[;,)]|$)`;
  public static readonly nativeElementReads: readonly RegExp[] = [
    /\bnativeElement\b\s*\)*\s*as\s+(?!const\b)\w/,
    new RegExp(String.raw`<\s*${Resources.nativeElementType}>\s*${Resources.nativeElementChain}\b`),
    new RegExp(String.raw`:\s*${Resources.nativeElementType}=(?![=>])\s*${Resources.nativeElementChain}${Resources.nativeElementEnd}`),
    new RegExp(String.raw`\):\s*${Resources.nativeElementType}=>\s*${Resources.nativeElementChain}${Resources.nativeElementEnd}`),
    new RegExp(String.raw`\breturn\s+${Resources.nativeElementChain}\s*;`),
    new RegExp(String.raw`(?:^|[;{])\s*[\w$.]+(?:\[[^\]]*\])?\s*=(?![=>])\s*${Resources.nativeElementChain}${Resources.nativeElementEnd}`),
    new RegExp(String.raw`:\s*${Resources.nativeElementType}=(?![=>])[^;]*?\bnativeElement\??\.[\w$]`),
    new RegExp(String.raw`\.querySelector(?:All)?\s*(?:<[^>]*>)?\s*${Resources.nativeElementCall}\s*[)\]]*\s*as\s+(?!const\b)[\w$[]`),
    new RegExp(String.raw`\):\s*${Resources.nativeElementType}=>\s*${Resources.nativeElementQuery}${Resources.nativeElementEnd}`),
    new RegExp(String.raw`\breturn\s+${Resources.nativeElementQuery}\s*;`),
    new RegExp(
      String.raw`(?<![\w$)\]])<\s*${Resources.nativeElementType}>\s*[(\[.\s]*[\w$]+${Resources.nativeElementStep}*?\??\.querySelector(?:All)?\b`
    ),
    /^\s*\)*\s*as\s+(?!const\b)[A-Za-z_$]/,
    /^(?!\s*(?:\/\/|\/?\*)).*[\w$)\]]\s+as\s*$/
  ];
  public static readonly windowImportCheckTitle: string = "Window imports";
  public static readonly windowImportModulePartPatterns: readonly RegExp[] = [
    /^src\/noldova\.desktop\.electron\/tests\/e2e\/fixtures\/modules\/[^/]+\/([^/]+)\//,
    /^src\/modules\/[^/]+\/([^/]+)\//
  ];
  public static readonly windowImportWindowPart: string = "window";
  public static readonly windowImportForbiddenModuleParts: readonly string[] = ["runtime", "cli"];
  public static readonly windowImportWindowFolders: readonly string[] = ["src/noldova.desktop.window"];
  public static readonly windowImportForbiddenFolders: readonly string[] = ["src/noldova.desktop.runtime", "src/noldova.desktop.electron", "src/noldova.desktop.cli"];
  public static readonly windowImportForbiddenPlatform: RegExp = /^(?:electron(?:\/|$)|node:)/;
  public static readonly windowImportScriptsFolder: string = "scripts/";
  public static readonly declaredDependencyCheckTitle: string = "Declared dependencies";
  public static readonly declaredDependencyLocalPrefixes: readonly string[] = [Resources.relativeImportPrefix, Resources.absoluteImportPrefix];
  public static readonly packageScopeMarker: string = "@";
  public static readonly declaredDependencyFields: readonly string[] = ["dependencies", "peerDependencies", "optionalDependencies"];
  public static readonly manifestPrivateField: string = "private";
  public static readonly gitHubConfigurationCheckTitle: string = "GitHub configuration";
  public static readonly gitHubConfigurationFilePattern: RegExp = /^\.github\/.+\.ya?ml$/;
  public static readonly gitHubUsesLinePattern: RegExp = /^\s*(?:-\s+)?uses:\s*["']?([^\s"'#]+)["']?(.*)$/;
  public static readonly gitHubPinnedActionPattern: RegExp = /^[^@\s]+@[0-9a-f]{40}$/;
  public static readonly gitHubReleaseCommentPattern: RegExp = /^\s+#\s*v?\d/;
  public static readonly gitHubSharedWorkflowPattern: RegExp = /^noldova-com\/\.github\/\.github\/workflows\/[^@/]+\.ya?ml@/;
  public static readonly gitHubLocalActionPrefix: string = "./";
  public static readonly gitHubOwnRepositoryPrefix: string = "$/";
  public static readonly gitHubOwnRepositoryPathPattern: RegExp = /^\$\/\.github\/(?:workflows\/[^/@]+\.yml|actions\/(?!\.\.?$)[^/@]+)$/;
  public static readonly fieldOrderCheckTitle: string = "Field order";
  public static readonly fieldOrderFolders: readonly string[] = [Resources.sourceFolderPrefix];
  public static readonly fieldOrderClassPattern: RegExp = /^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/;
  public static readonly fieldOrderFieldPattern: RegExp = /^ {2}(?:(public|private|protected)\s+)?(?:(static)\s+)?(?:(?:readonly|override|declare)\s+)*(#?[\w$]+)[?!]?\s*[:=;]/;
  public static readonly fieldOrderMemberStartPattern: RegExp = /^(?: {0,2}[^\s\])}]|})/;
  public static readonly fieldOrderClassEnd: string = "}";
  public static readonly fieldOrderPublicModifier: string = "public";
  public static readonly fieldOrderStaticModifier: string = "static";
  public static readonly bucketNameCheckTitle: string = "Bucket names";
  public static readonly bucketNameWords: ReadonlySet<string> = new Set(["helper", "helpers", "util", "utils", "utility", "common", "shared", "misc"]);
  public static readonly bucketNameBeforeLastWord: RegExp = /^.*(?=[A-Z])/;
  public static readonly bucketNameRule: string = "https://github.com/noldova-com/.github/blob/main/standards/CODE.md, Ownership, asks for a named concept instead of a helper, util, utility, common, shared or misc bucket.";
  public static readonly moduleFolderCheckTitle: string = "Module folders";
  public static readonly moduleFolderIdPattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  public static readonly moduleFolderReservedId: string = "desktop";
  public static readonly moduleFolderDocumentName: string = "README.md";
  public static readonly releaseScriptCheckTitle: string = "Release entry";
  public static readonly releaseScriptEntry: string = "src/noldova.desktop.build/src/services/release-command-line.ts";
  public static readonly releaseScriptManifest: string = "src/noldova.desktop.build/package.json";
  public static readonly releaseScriptPeerField: string = "peerDependencies";
  public static readonly releaseScriptPeerPrefix: string = "@noldova/";
  public static readonly preloadArgumentCheckTitle: string = "Preload argument";
  public static readonly preloadArgumentPreloadFile: string = "src/noldova.desktop.electron/src/preload.cts";
  public static readonly preloadArgumentPreloadField: string = "SETTINGS_ARGUMENT";
  public static readonly preloadArgumentResourcesFile: string = "src/noldova.desktop.electron/src/resources.ts";
  public static readonly preloadArgumentResourcesField: string = "preloadArgument";
  public static readonly preloadArgumentNotText: string = `${Resources.preloadArgumentPreloadFile} and ${Resources.preloadArgumentResourcesFile}: Preload.${Resources.preloadArgumentPreloadField} and Resources.${Resources.preloadArgumentResourcesField} must each be written out as text, so they can be compared.`;
  public static readonly preloadArgumentChecked: string = `Checked the preload's settings argument against the electron package's Resources.${Resources.lineEnd}`;
  public static readonly productIdentityCheckTitle: string = "Product identity";
  public static readonly productIdentityShellPrefixes: readonly string[] = ["src/noldova.desktop."];
  public static readonly productIdentitySpecialCharacters: RegExp = /[.*+?^${}()|[\]\\]/g;
  public static readonly productIdentityEscapedMatch: string = "\\$&";
  public static readonly productIdentityPatternFlags: string = "g";
  public static readonly enumValueCheckTitle: string = "Enum values";
  public static readonly enumValueRoots: readonly string[] = [Resources.sourceFolderPrefix];
  public static readonly enumValueRule: string = "https://github.com/noldova-com/.github/blob/main/standards/CODE.md, Naming, has a string enum value match its member name, with a spelling fixed outside Noldova mapped in the package's resources; tests and fixtures follow https://github.com/noldova-com/.github/blob/main/standards/TESTING.md, Tests and production code.";
  public static readonly interfaceNameCheckTitle: string = "Interface names";
  public static readonly interfaceNamePrefixedPattern: RegExp = /^I[A-Z]/;
  public static readonly interfaceNamePrefix: string = "I";
  public static readonly interfaceNameGlobalScope: string = "global";
  public static readonly interfaceNameRule: string = "https://github.com/noldova-com/.github/blob/main/standards/stacks/TYPESCRIPT.md, Names, names an interface I plus PascalCase, as in IProviderAdapter, in production code, scripts and tests; an interface in declare global or declare module augments an existing type and keeps its name.";
  public static readonly commentCheckTitle: string = "Comments";
  public static readonly htmlExtension: string = ".html";
  public static readonly commentApiDeclarationsPattern: RegExp = /(?:^|\/)src\/api\/[^/]+\.d\.ts$/;
  public static readonly interpreterLinePattern: RegExp = /^#!.*\n/;
  public static readonly licenseHeaderCheckTitle: string = "License headers";
  public static readonly licenseHeaderYamlExtensions: readonly string[] = [".yml", ".yaml"];
  public static readonly packageLayoutCheckTitle: string = "Package layout";
  public static readonly packageLayoutRequiredFiles: readonly string[] = ["src/tsconfig.json", "src/resources.ts", "tests/tsconfig.json"];
  public static readonly packageLayoutRule: string = "https://github.com/noldova-com/.github/blob/main/standards/stacks/TYPESCRIPT.md, Files and folders, puts package.json at the package root, with src/ and tests/ beside it, each with its own tsconfig.json, and resources.ts at the root of src/.";
  public static readonly documentCheckTitle: string = "Documents";
  public static readonly apiDeclarationCheckTitle: string = "API declarations";
  public static readonly apiDeclarationPurpose: string = "api-declarations";
  public static readonly apiDeclarationNoPackages: string = `No packages under src/; there are no API declarations to compare.${Resources.lineEnd}`;
  public static readonly apiDeclarationVerdict: string = "matches its declarations";
  public static readonly packageCheckTitle: string = "Packages";
  public static readonly packageCheckNoPackages: string = `No packages under src/.${Resources.lineEnd}`;

  public static formatRunnerResultNoResult(source: string): string {
    return `The test runner wrote no result to ${source}.`;
  }

  public static formatJsonFieldsNegativeCount(source: string, at: string, name: string): string {
    return `${source} has a negative count at ${at}.${name}.`;
  }

  public static formatJsonFieldsUnreadable(source: string, error: unknown): string {
    return `${source} could not be read: ${String(error)}`;
  }

  public static formatTestOptionsUnknownOption(option: string | undefined): string {
    return `${JSON.stringify(option)} is not an option of npm test.`;
  }

  public static formatCarryDocsMissingDocumented(documented: string): string {
    return `${documented} is missing; each entry's documented declarations sit beside it.`;
  }

  public static formatCarryDocsMissingCompiled(compiled: string, documented: string): string {
    return `The Angular compiler wrote no ${compiled} for ${documented}.`;
  }

  public static formatCarryDocsCarryFailed(output: string, message: string): string {
    return `Carrying the documented declarations onto ${output} failed: ${message}`;
  }

  public static formatCarryDocsDiffering(output: string, problems: readonly string[]): string {
    return `The compiled declarations in ${output} differ from the documented ones:${Resources.lineEnd}${problems.map(t => `${Resources.indent}${t}${Resources.lineEnd}`).join("")}${Resources.carryDocsRule}`;
  }

  public static formatDocumentsChanged(changed: number, total: number): string {
    return `Put each sentence on its own line in ${changed} of ${total} documents.${Resources.lineEnd}`;
  }

  public static formatAngularTestUnnamed(workspaceFile: string): string {
    return `${workspaceFile} names no spec files for its ${Resources.angularTestTarget} target.`;
  }

  public static formatAngularTestExcluded(workspaceFile: string): string {
    return `${workspaceFile} excludes files from its ${Resources.angularTestTarget} target, and the check of the spec files run does not apply exclusions.`;
  }

  public static formatAngularTestNoProject(projectName: string): string {
    return `The Angular project has no ${projectName}.`;
  }

  public static formatAngularTestRefusedPaths(projectName: string): string {
    return `${projectName} must map its path aliases to lists of files in compilerOptions.paths.`;
  }

  public static formatAngularTestNoTestFiles(report: string): string {
    return `The Angular test report ${report} lists no test files.`;
  }

  public static formatAngularTestUnreadableJson(file: string, error: string): string {
    return `${file} could not be read as JSON: ${error}`;
  }

  public static formatAngularTestUnknownStatus(source: string, file: string, status: string): string {
    return `${source} gives ${file} an unknown test status ${JSON.stringify(status)}.`;
  }

  public static formatPackageTestGroups(groups: readonly (readonly string[])[]): string {
    return `The package tests run as ${groups.length} processes side by side; each line they print starts with its process's number, and each process's whole log is in _build/package-tests-<n>.log: ${groups.map((t, i) => `${Resources.formatPackageTestPrefix(i)}${t.join(Resources.listSeparator)}`).join(Resources.packageTestGroupSeparator)}.${Resources.lineEnd}`;
  }

  public static formatPackageTestPrefix(index: number): string {
    return `[${index + 1}] `;
  }

  public static formatPackageTestGroup(index: number, groups: readonly (readonly string[])[]): string {
    return `process ${index + 1} of ${groups.length}: ${groups[index]?.join(Resources.listSeparator) ?? ""}`;
  }

  public static formatSerialTestInterrupted(identity: string, limit: number, waiting: readonly string[]): string {
    const resources = waiting.length === 0 ? "no open resource that Node names" : waiting.join(Resources.listSeparator);
    return `The test ${identity} exceeded its time limit of ${limit} ms while waiting on ${resources}; the run ended after reporting it, and the tests not yet started did not run.\n`;
  }

  public static formatSerialTestSlowest(suite: string, limit: number, lines: readonly string[]): string {
    return lines.length === 0 ? String.empty : `${suite} suite, limit ${limit} ms:\n${lines.join(Resources.lineEnd)}\n`;
  }

  public static formatSerialTestLeftovers(leftovers: readonly string[], kept: readonly string[]): string {
    const mounted = kept.length === 0 ? String.empty
      : ` The run left unremoved, without entering them, what is on another file system, such as a volume still mounted: ${kept.join(Resources.listSeparator)}.`;
    return `Tests finished but left ${leftovers.join(Resources.listSeparator)} in the run's temporary folder; a test must remove what it creates.${mounted} Failing the run.\n`;
  }

  public static formatSerialTestUnremoved(error: string): string {
    return `Tests finished but the run's temporary folder could not be removed: ${error}. Failing the run.\n`;
  }

  public static formatSerialTestUnclosed(resources: readonly string[]): string {
    return resources.length === 0
      ? `Tests finished but the process did not exit within ${Resources.serialTestShutdownGrace} ms and Node names no open resource; a worker thread or a native handle keeps it alive. Failing the run.\n`
      : `Tests finished but resources remain open: ${resources.join(Resources.listSeparator)}. Failing the run.\n`;
  }

  public static formatSerialTestPartsEmpty(parts: readonly string[]): string {
    return `${Resources.serialTestPartsEmpty}${parts.join("; ")}.`;
  }

  public static formatJsonArrayItemPath(index: number): string {
    return `$.${index}`;
  }

  public static formatTestProcessPart(name: string, paths: readonly string[], isExcept: boolean): string {
    return `${name} (${isExcept ? Resources.testProcessPartExceptPrefix : ""}${paths.join(Resources.listSeparator)})`;
  }

  public static formatFlakyRetried(tests: readonly { readonly name: string; readonly file: string }[]): string {
    return `Flaky, passed when run again: ${tests.map(t => `${t.name} (${t.file})`).join(Resources.listSeparator)}${Resources.lineEnd}`;
  }

  public static formatFlakySummary(tests: readonly { readonly runner: string; readonly name: string; readonly file: string; readonly failure: string }[]): string {
    return `${Resources.flakyRecordSummaryHeader}${tests.map(t => `| ${t.runner} | ${t.name} | ${t.file} | ${t.failure} |${Resources.lineEnd}`).join("")}${Resources.lineEnd}`;
  }

  public static formatLoggedProcessNotStarted(command: string): string {
    return `"${command}" could not start.`;
  }

  public static formatAngularTestFieldUnreadable(message: string, reason: string): string {
    return `${message}${Resources.space}${reason}`;
  }

  public static formatAngularTestEnded(exitCode: number | null): string {
    return exitCode === null
      ? Resources.angularTestEndedBySignal
      : `The Angular tests ended with exit code ${exitCode} and wrote no report.\n`;
  }

  public static formatTestWaitPause(file: string, line: number): string {
    return `${file}:${line}: pauses for a fixed time; wait for the event or the condition instead, with the wait that README.md, Fixed pauses, names for this kind of test, or list the file there with its reason.`;
  }

  public static formatTestWaitStale(line: number, file: string): string {
    return `${Resources.testWaitContractFile}:${line}: lists ${file}, which no longer pauses for a fixed time; remove its row.`;
  }

  public static formatTestWaitChecked(testFiles: number, listed: number): string {
    return `Checked ${testFiles} test files for fixed pauses; ${listed} may pause.${Resources.lineEnd}`;
  }

  public static formatSourceLineLocation(file: string, line: number): string {
    return `${file}:${line}`;
  }

  public static formatApiEntryTitle(directory: string, subpath: string): string {
    return `${directory} (${subpath})`;
  }

  public static formatApiCatalogVerdict(title: string, verdict: string): string {
    return `${title}: ${verdict}${Resources.lineEnd}`;
  }

  public static formatApiCatalogProblems(title: string, problems: readonly string[]): string {
    return `${title}:${Resources.lineEnd}${problems.map(t => `${Resources.indent}${t}${Resources.lineEnd}`).join("")}`;
  }

  public static formatApiCatalogFailure(message: string): string {
    return `${message}${Resources.lineEnd}`;
  }

  public static formatApiCatalogNoPathAlias(projectName: string, part: string, entryName: string, shown: string): string {
    return `No path alias in ${projectName} leads to ${part}/src/api/${entryName}.ts, so the examples of ${shown} cannot be compiled against its declarations.`;
  }

  public static formatApiNoPackedDeclarations(packed: string): string {
    return `no packed declarations at ${packed}; build the packages first`;
  }

  public static formatApiDocMissing(owner: string, file: string): string {
    return `${owner}: has no JSDoc in ${file}`;
  }

  public static formatApiDocNotCarried(owner: string, location: string, file: string): string {
    return `${owner}: ${location} does not carry its docs from ${file}`;
  }

  public static formatApiDocLine(indent: string, isContinuation: boolean, line: string): string {
    return isContinuation ? `${indent} ${line}` : `${indent}${line}`;
  }

  public static formatApiDocNotCompiled(owner: string, file: string): string {
    return `${owner}: documented in ${file}, but not compiled`;
  }

  public static formatApiDocCountDiffers(owner: string, documented: number, file: string, compiled: number): string {
    return `${owner}: has ${documented} declarations in ${file}, but ${compiled} compiled ones`;
  }

  public static formatApiDocUndocumented(owner: string, file: string): string {
    return `${owner}: compiled, but not documented in ${file}`;
  }

  public static formatApiDocOutsidePackage(owner: string, file: string, folder: string): string {
    return `${owner}: compiled in ${file}, outside the package's ${folder}`;
  }

  public static formatApiDocTwoDocs(owner: string, location: string): string {
    return `${owner}: ${location} would carry two different docs`;
  }

  public static formatApiEntryUnreadable(file: string): string {
    return `${file} could not be read as JSON, so the entries whose declarations are checked are unknown.`;
  }

  public static formatApiEntryNoExports(file: string): string {
    return `${file} exports no declarations, so its API cannot be checked.`;
  }

  public static formatApiEntryUntyped(file: string, subpaths: readonly string[]): string {
    return `${file} exports ${subpaths.join(Resources.listSeparator)} with no top-level "types", so the API there cannot be checked.`;
  }

  public static formatApiEntryRelativePath(file: string): string {
    return `${Resources.apiEntryRelativePrefix}${file}`;
  }

  public static formatApiEntryNotDeclarations(file: string, subpath: string, declarations: string): string {
    return `${file} exports ${subpath} with the declarations ${declarations}, which are not an api/<entry>.d.ts file, so they cannot be checked.`;
  }

  public static formatApiEntryId(id: string, entryName: string): string {
    return `${id}-${entryName}`;
  }

  public static formatApiNoInstalledDeclarations(declarations: string): string {
    return `no installed declarations at ${declarations}; build the packages first`;
  }

  public static formatApiNoDeclarations(declarations: string): string {
    return `no declarations at ${declarations}`;
  }

  public static formatApiProgramUnreadable(projectFile: string, problems: readonly string[]): string {
    return `TypeScript could not read ${projectFile}:${Resources.lineEnd}${problems.join(Resources.lineEnd)}`;
  }

  public static formatApiDiagnostic(code: number, message: string): string {
    return `TS${code}: ${message}`;
  }

  public static formatApiNotModule(file: string): string {
    return `${file} is not an ES module of the project.`;
  }

  public static formatApiProjectJson(project: unknown): string {
    return `${JSON.stringify(project, null, Resources.jsonIndent)}${Resources.lineEnd}`;
  }

  public static formatApiExportPath(path: string, name: string): string {
    return `${path}.${name}`;
  }

  public static formatApiMemberPath(path: string, name: string): string {
    return `${path}#${name}`;
  }

  public static formatApiSurfaceMissing(path: string, implemented: string): string {
    return `${path}: missing from the declarations; the implementation has ${implemented}`;
  }

  public static formatApiSurfaceDiffers(path: string, implemented: string, declared: string): string {
    return `${path}: the implementation has ${implemented}; the declarations have ${declared}`;
  }

  public static formatApiSurfaceUnimplemented(path: string, declared: string): string {
    return `${path}: declared but not implemented; the declarations have ${declared}`;
  }

  public static formatDocumentLinkFinding(documentPath: string, line: number, target: string, problem: string): string {
    return `${documentPath}:${line}: the link "${target}" ${problem}.`;
  }

  public static formatDocumentLinkMissingHeading(anchor: string): string {
    return `points to a missing heading "${Resources.documentLinkAnchorSeparator}${anchor}"`;
  }

  public static formatMarkdownAnchorOccurrence(anchor: string, occurrence: number): string {
    return `${anchor}${Resources.dash}${occurrence}`;
  }

  public static formatTextFormatByteOrderMark(filePath: string): string {
    return `${filePath}:1: starts with a byte order mark.`;
  }

  public static formatTextFormatCarriageReturn(filePath: string, line: number): string {
    return `${filePath}:${line}: uses a carriage return; lines end with LF only.`;
  }

  public static formatTextFormatTrailingWhitespace(filePath: string, line: number): string {
    return `${filePath}:${line}: ends with whitespace.`;
  }

  public static formatTextFormatNoFinalNewline(filePath: string): string {
    return `${filePath}: does not end with a newline.`;
  }

  public static formatTextFormatBlankLastLine(filePath: string): string {
    return `${filePath}: ends with a blank line.`;
  }

  public static formatSyntaxTreeMissing(file: string): string {
    return `The TypeScript API has no syntax tree for ${file}.`;
  }

  public static formatLicenseNoticeYamlLine(line: string): string {
    return line === "" ? "#" : `# ${line}`;
  }

  public static formatSourceModuleArea(moduleId: string): string {
    return `${Resources.sourceModulesFolder}${Resources.pathSeparator}${moduleId}`;
  }

  public static formatVersionFileDiffering(released: string, built: string): string {
    return `${Resources.versionFile} holds the version ${released}, but the root ${Resources.manifestFile}, whose version the build stamps on every package, holds ${built}; the release reads ${Resources.versionFile}, so both change together.${Resources.lineEnd}`;
  }

  public static formatVersionFileMatching(version: string): string {
    return `${Resources.versionFile} and the root ${Resources.manifestFile} both hold ${version}.${Resources.lineEnd}`;
  }

  public static formatVersionFileUnreadable(file: string, message: string): string {
    return `The root ${file} can't be read: ${message}${Resources.lineEnd}`;
  }

  public static formatVersionFileInvalid(file: string, message: string): string {
    return `The root ${file} isn't valid JSON: ${message}${Resources.lineEnd}`;
  }

  public static formatVersionFileNoVersion(file: string, value: string | undefined): string {
    return `The root ${file} holds no version string in its "${Resources.versionFileVersionField}" field, but ${value}.${Resources.lineEnd}`;
  }

  public static formatVersionFileCaseWrongResult(passed: boolean, name: string, passes: boolean, output: string): string {
    return `The Version file check ${passed ? Resources.versionFileCasePassed : Resources.versionFileCaseFailed} ${name}, where it should ${passes ? Resources.versionFileCasePass : Resources.versionFileCaseFail}: ${output}`;
  }

  public static formatVersionFileCaseMissingLine(name: string, line: string, output: string): string {
    return `The Version file check's output for ${name} doesn't say "${line}": ${output}`;
  }

  public static formatVersionFileCaseThrew(name: string, message: string): string {
    return `The Version file check threw for ${name} instead of failing: ${message}`;
  }

  public static formatVersionFileCaseAllPassed(count: number): string {
    return `The Version file check gave the expected result and line for each of its ${count} cases.${Resources.lineEnd}`;
  }

  public static formatFileLineLocation(file: string, line: number): string {
    return `${file}:${line}`;
  }

  public static formatConceptFolderChecked(count: number): string {
    return `Checked the folders of ${count} production scripts.${Resources.lineEnd}`;
  }

  public static formatConceptFolderNotKebabCase(location: string): string {
    return `${location}: is not lowercase kebab-case; ${Resources.conceptFolderRule}`;
  }

  public static formatConceptFolderNotCategory(root: string, category: string): string {
    return `${root}/${category}: is not a concept category of its source tree; ${Resources.conceptFolderRule}`;
  }

  public static formatConceptFolderNoConcept(file: string, folder: string): string {
    return `${file}: is in ${folder}/ but declares no concept; ${Resources.conceptFolderRule}`;
  }

  public static formatConceptFolderOutside(location: string, name: string, kind: string, folder: string): string {
    return `${location}: ${name} is ${kind} outside ${folder}/; ${Resources.conceptFolderRule}`;
  }

  public static formatConceptFolderWrongKind(location: string, name: string, folder: string, kind: string): string {
    return `${location}: ${name} is in ${folder}/ but is not ${kind}; ${Resources.conceptFolderRule}`;
  }

  public static formatConceptFileName(name: string, extension: string): string {
    const spelled = Resources.conceptFileProductNames.reduce((t, u) => t.replaceAll(u, `${u.charAt(0)}${u.slice(1).toLowerCase()}`), name);
    const words = spelled.split(Resources.conceptFileWordStart).join(Resources.dash).toLowerCase();
    const end = words.lastIndexOf(Resources.dash);
    const role = words.slice(end + 1);
    if (end !== -1 && Resources.conceptFileRoleWords.has(role))
      return `${words.slice(0, end)}${Resources.dot}${role}${extension}`;
    return `${words}${extension}`;
  }

  public static formatConceptFileChecked(count: number): string {
    return `Checked the concepts and file names of ${count} production scripts.${Resources.lineEnd}`;
  }

  public static formatConceptFileConcepts(file: string, names: readonly string[]): string {
    return `${file}: declares ${names.length} concepts, ${names.join(Resources.listSeparator)}; ${Resources.conceptFileRule}`;
  }

  public static formatConceptFileUnnamed(location: string): string {
    return `${location}: declares a class without a name to name the file for; ${Resources.conceptFileRule}`;
  }

  public static formatConceptFileMisplaced(location: string, name: string, expected: string): string {
    return `${location}: ${name} is not in its file ${expected}; ${Resources.conceptFileRule}`;
  }

  public static formatNameUniquenessOwnedPrefix(prefix: string, owner: string): string {
    return `${prefix}${owner}${Resources.dash}`;
  }

  public static formatNameUniquenessModuleOwner(owner: string): string {
    return `module "${owner}"`;
  }

  public static formatNameUniquenessChecked(files: number, declarations: number): string {
    return `Checked the selectors, style tokens and package names of ${files} production files and the names in ${declarations} module declarations.${Resources.lineEnd}`;
  }

  public static formatNameUniquenessPlace(place: string, detail: string): string {
    return `${place} (${detail})`;
  }

  public static formatNameUniquenessSelectorPrefix(location: string, selector: string, prefix: string): string {
    return `${location}: the selector "${selector}" does not start with "${prefix}".`;
  }

  public static formatNameUniquenessTokenPrefix(location: string, token: string, prefix: string): string {
    return `${location}: the style token "${token}" does not start with "${prefix}".`;
  }

  public static formatNameUniquenessUnreadableManifest(file: string, error: string): string {
    return `${file}: the manifest is not a JSON object: ${error}`;
  }

  public static formatNameUniquenessRepeatedSelector(selector: string, places: readonly string[]): string {
    return `The selector "${selector}" is declared more than once: ${places.join(Resources.listSeparator)}.`;
  }

  public static formatNameUniquenessRepeatedToken(token: string, places: readonly string[]): string {
    return `The style token "${token}" is defined by more than one owner: ${places.join(Resources.listSeparator)}.`;
  }

  public static formatNameUniquenessRepeatedPackage(name: string, places: readonly string[]): string {
    return `The package name "${name}" is used by more than one manifest: ${places.join(Resources.listSeparator)}.`;
  }

  public static formatNameUniquenessRepeatedModule(id: string, places: readonly string[]): string {
    return `The module id "${id}" is declared more than once: ${places.join(Resources.listSeparator)}.`;
  }

  public static formatNameUniquenessRepeatedName(name: string, places: readonly string[]): string {
    return `The contributed name "${name}" is declared more than once: ${places.join(Resources.listSeparator)}.`;
  }

  public static formatReservedNamesUnreadable(file: string, name: string): string {
    return `${file}: Resources.${name} is not a list of text, written out or named through Resources' own fields, so it can't be compared with the build's copy.`;
  }

  public static formatReservedNamesMismatch(name: string, copy: readonly string[], owner: string, owned: readonly string[]): string {
    return `${Resources.buildResourcesFile}: Resources.${name} is ${copy.join(Resources.listSeparator)}, but ${owner} are ${owned.join(Resources.listSeparator)}; the build refuses a module name that shadows them, so the two lists must match.`;
  }

  public static formatReservedNamesChecked(count: number): string {
    return `Checked ${count} lists of reserved names against their owners.${Resources.lineEnd}`;
  }

  public static formatModuleImportFinding(location: string, specifier: string, problem: string): string {
    return `${location}: the import "${specifier}" ${problem}; a module uses only its own packages, context's packages, the shell's published APIs and the published APIs of the modules it declares.`;
  }

  public static formatModuleImportChecked(count: number): string {
    return `Checked the imports of ${count} production script files of modules.${Resources.lineEnd}`;
  }

  public static formatModuleImportOutsidePackage(packageRoot: string): string {
    return `comes from outside its package ${packageRoot}`;
  }

  public static formatModuleImportUndeclared(moduleId: string, owner: string): string {
    return `belongs to module "${moduleId}", but module "${owner}" declares no dependency on "${moduleId}"`;
  }

  public static formatModuleImportNotApi(packageName: string): string {
    return `is not the published API of ${packageName}; import the package itself`;
  }

  public static formatWebViewNamesUnreadable(owner: string, name: string): string {
    return `${Resources.webViewNamesProtocolFile}: ${owner} is not written out as text, a pattern or a list of text, so it can't be compared with the build's Resources.${name}.`;
  }

  public static formatWebViewNamesMismatch(name: string, copy: string, owner: string, owned: string): string {
    return `${Resources.buildResourcesFile}: Resources.${name} is ${copy}, but ${owner} is ${owned}; the build checks webViews.json with the copy and the hosts with the protocol, so the two must match.`;
  }

  public static formatWebViewNamesChecked(count: number): string {
    return `Checked ${count} web view names against the protocol.${Resources.lineEnd}`;
  }

  public static formatNativeElementLocation(file: string, line: number): string {
    return `${file}:${line}`;
  }

  public static formatNativeElementFinding(location: string): string {
    return `${location} takes a fixture's nativeElement or a query's result as a type unchecked; read it with DomFixture's host, one, oneOf, maybe or all instead, as README.md, nativeElement assertions, says.${Resources.lineEnd}`;
  }

  public static formatNativeElementChecked(count: number): string {
    return `Read ${count} test files under ${Resources.sourceFolderPrefix} for an unchecked nativeElement or query read.${Resources.lineEnd}`;
  }

  public static formatWindowImportFinding(location: string, specifier: string): string {
    return `${location}: imports "${specifier}"; ARCHITECTURE.md section 2 keeps the window and modules' window parts browser-safe, so they import no runtime, main process or command-line package, Electron or Node.js module, and reach the runtime through @noldova/desktop.protocol and the preload bridge.`;
  }

  public static formatWindowImportChecked(count: number): string {
    return `Checked the imports of ${count} script files of the window and modules' window parts.${Resources.lineEnd}`;
  }

  public static formatDeclaredDependencyFinding(location: string, specifier: string, packageName: string, packageRoot: string): string {
    return `${location}: the import "${specifier}" uses "${packageName}", which ${packageRoot}/package.json does not declare; a package imports only what its manifest declares.`;
  }

  public static formatDeclaredDependencyChecked(files: number, packages: number): string {
    return `Checked the imports of ${files} production script files of ${packages} packages.${Resources.lineEnd}`;
  }

  public static formatGitHubConfigurationFinding(file: string, line: number, problem: string): string {
    return `${file}:${line}: ${problem}`;
  }

  public static formatGitHubConfigurationChecked(count: number): string {
    return `Checked ${count} GitHub configuration files.${Resources.lineEnd}`;
  }

  public static formatGitHubUnscopedReference(action: string): string {
    return `the reference "${action}" names neither $/.github/workflows/<file>.yml nor $/.github/actions/<name>, so it could reach past the repository's own workflows and actions.`;
  }

  public static formatGitHubUnpinnedAction(action: string): string {
    return `the action "${action}" is not pinned to a full commit SHA; https://github.com/noldova-com/.github/blob/main/standards/SECURITY.md, CI workflows, requires one.`;
  }

  public static formatGitHubUnversionedAction(action: string): string {
    return `the action "${action}" does not record its release version, such as # v6.1.0, in a comment after the SHA; https://github.com/noldova-com/.github/blob/main/standards/SECURITY.md, CI workflows, requires one.`;
  }

  public static formatFieldOrderChecked(count: number): string {
    return `Checked ${count} files for the order of class fields.${Resources.lineEnd}`;
  }

  public static formatFieldOrderMisplaced(file: string, line: number, field: string | undefined, className: string): string {
    return `${file}:${line}: ${field} is a public static field after another field; declare public static fields first, unless its initializer uses ${className}, as https://github.com/noldova-com/.github/blob/main/standards/stacks/TYPESCRIPT.md, Classes, says.`;
  }

  public static formatFieldOrderMemberAccess(className: string): string {
    return `${className}.`;
  }

  public static formatFieldOrderConstruction(className: string): string {
    return `new ${className}(`;
  }

  public static formatBucketNameChecked(files: number, scripts: number): string {
    return `Checked the paths of ${files} files and the types of ${scripts} scripts for bucket names.${Resources.lineEnd}`;
  }

  public static formatBucketNamePath(file: string, segment: string): string {
    return `${file}: the name "${segment}" ends in a bucket word; ${Resources.bucketNameRule}`;
  }

  public static formatBucketNameType(file: string, line: number, name: string): string {
    return `${file}:${line}: the name ${name} ends in a bucket word; ${Resources.bucketNameRule}`;
  }

  public static formatModuleFolderNotFolder(location: string): string {
    return `${location} is not a module folder.`;
  }

  public static formatModuleFolderBadId(location: string, name: string): string {
    return `${location}: "${name}" is not a module id; an id is lowercase kebab-case and not "${Resources.moduleFolderReservedId}".`;
  }

  public static formatModuleFolderNoDocument(location: string): string {
    return `${location} has no ${Resources.moduleFolderDocumentName}.`;
  }

  public static formatModuleFolderUndeclared(location: string, parts: readonly string[]): string {
    return `${location} has the parts ${parts.join(Resources.listSeparator)} but no module.json.`;
  }

  public static formatModuleFolderChecked(count: number): string {
    return `Checked ${count} module folders.${Resources.lineEnd}`;
  }

  public static formatReleaseScriptFinding(file: string, specifier: string, peers: readonly string[]): string {
    return `${file}: imports ${specifier}, but ${Resources.releaseScriptEntry} runs from desktop.build's archive without npm ci, in .github/workflows/release-app.yml and module-range.yml, which unpack beside it only the @noldova peers ${Resources.releaseScriptManifest} declares (${peers.join(Resources.listSeparator)}), so its imports reach only node: modules, those peers and relative files.`;
  }

  public static formatReleaseScriptChecked(count: number): string {
    return `Checked the imports of ${count} files desktop.build's release entry loads.${Resources.lineEnd}`;
  }

  public static formatPreloadArgumentDiffering(preload: string, owned: string): string {
    return `${Resources.preloadArgumentPreloadFile}: Preload.${Resources.preloadArgumentPreloadField} is ${preload}, but Resources.${Resources.preloadArgumentResourcesField} is ${owned}; the sandboxed preload can't import Resources, so it finds its settings by its own copy, and the two must match.`;
  }

  public static formatProductIdentityPattern(value: string): string {
    return `(?<![@\\w-])${value.replace(Resources.productIdentitySpecialCharacters, Resources.productIdentityEscapedMatch)}(?![\\w-])`;
  }

  public static formatProductIdentityChecked(count: number): string {
    return `Checked ${count} production files of the shell for the product's identity.${Resources.lineEnd}`;
  }

  public static formatProductIdentityFinding(location: string, value: string): string {
    return `${location}: spells "${value}"; the shell takes the product's identity from the build's product file through ProductInfo.`;
  }

  public static formatEnumValueChecked(count: number): string {
    return `Checked the enum values of ${count} production scripts.${Resources.lineEnd}`;
  }

  public static formatEnumValueFinding(file: string, line: number, enumName: string, member: string, value: string): string {
    return `${file}:${line}: ${enumName}.${member} has the value "${value}" instead of its name; ${Resources.enumValueRule}`;
  }

  public static formatInterfaceNameChecked(count: number): string {
    return `Checked the interface names of ${count} scripts.${Resources.lineEnd}`;
  }

  public static formatInterfaceNameFinding(file: string, line: number, name: string): string {
    return `${file}:${line}: the interface ${name} does not start with ${Resources.interfaceNamePrefix} and a capital letter; name it ${Resources.interfaceNamePrefix}${name}; ${Resources.interfaceNameRule}`;
  }

  public static formatCommentFinding(file: string, line: number): string {
    return `${file}:${line}: holds a comment; documents/ARCHITECTURE.md, Code, allows only the license header in source, tests, scripts, styles and templates.${Resources.lineEnd}`;
  }

  public static formatCommentChecked(count: number): string {
    return `Checked ${count} files for comments other than the license header.${Resources.lineEnd}`;
  }

  public static formatLicenseHeaderMissing(file: string): string {
    return `${file}: does not start, after any #! line, with the license header that documents/ARCHITECTURE.md, Code, gives for its format.${Resources.lineEnd}`;
  }

  public static formatLicenseHeaderChecked(count: number): string {
    return `Checked the license headers of ${count} files.${Resources.lineEnd}`;
  }

  public static formatPackageLayoutMissing(directory: string, file: string): string {
    return `${directory}: has no ${file}; ${Resources.packageLayoutRule}`;
  }

  public static formatPackageLayoutChecked(count: number): string {
    return `Checked the layout of ${count} packages.${Resources.lineEnd}`;
  }

  public static formatDocumentCrowded(file: string, line: number): string {
    return `${file}:${line}: holds more than one sentence; put each sentence on its own line, as npm run format:documents does.`;
  }

  public static formatDocumentChecked(files: number, documents: number): string {
    return `Checked ${files} files and the links of ${documents} Markdown documents.${Resources.lineEnd}`;
  }

  public static formatApiDeclarationPacked(difference: string): string {
    return `packed ${difference}`;
  }

  public static formatPackageCheckBuilt(count: number): string {
    return `Packages built and installed: ${count}.${Resources.lineEnd}`;
  }

  public static npmCiDropped(requests: readonly string[]): string {
    return `npm ci stopped on a read that stalled or a connection that was reset, which npm doesn't retry, so it runs once more in ${Resources.npmCiRetryPause / 1000} seconds. Its last requests:${Resources.lineEnd}${requests.join(Resources.lineEnd)}${Resources.lineEnd}`;
  }
}
