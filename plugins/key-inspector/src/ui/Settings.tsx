import { React, ReactNative, clipboard } from "@vendetta/metro/common";
import { findByProps, findByName, findByPropsAll, findByNameAll } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { Forms } from "@vendetta/ui/components";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import PrimaryButton from "@shared/ui/PrimaryButton";
import { rawFindByProps, rawFindByName, rawFindByTypeName, rawFindByStoreName } from "@shared/lib/rawFind";
import { resolveSemanticColorSafe } from "@shared/lib/color";
import { runAllChecks, formatReport } from "../lib/checks";
import { dumpVendettaApiTree } from "../lib/apiTree";
import { runEval } from "../lib/evalTool";
import { captureFluxEvents } from "../lib/fluxLogger";
import { captureComponentRenders } from "../lib/renderLogger";

const { View, Text } = ReactNative;
const { FormSection, FormInput } = Forms;

// Every raw Text below used to have no explicit color at all - illegible black-on-black on
// Discord's dark theme, since RN's Text defaults to black with no theming of its own.
const textColor = () => resolveSemanticColorSafe(["TEXT_NORMAL", "TEXT_DEFAULT"], "#dbdee1");

function FullScanSection() {
    const [summary, setSummary] = React.useState<string | null>(null);

    return (
        <FormSection title="Full diagnostic scan">
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <PrimaryButton
                    label="Run scan & copy full report"
                    onPress={() => {
                        const results = runAllChecks();
                        const missing = results.filter((r) => !r.found).length;
                        clipboard.setString(formatReport(results));
                        setSummary(`${results.length} checked, ${missing} missing - full report copied`);
                        showToast(`${missing} missing out of ${results.length} - report copied`, undefined);
                    }}
                />
                {summary && (
                    <Text style={{ marginTop: 8, fontSize: 12.5, opacity: 0.7, color: textColor() }}>{summary}</Text>
                )}
            </View>
        </FormSection>
    );
}

function EvalSection() {
    const [code, setCode] = React.useState("");
    const [result, setResult] = React.useState<string | null>(null);
    const [running, setRunning] = React.useState(false);

    const run = async () => {
        if (!code.trim() || running) return;
        setRunning(true);
        try {
            const output = await runEval(code);
            setResult(output);
            clipboard.setString(output);
            showToast("Result copied", undefined);
        } finally {
            setRunning(false);
        }
    };

    return (
        <FormSection title="Eval">
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <FormInput
                    title="Code"
                    placeholder={'e.g. return findByProps("getRootNavigationRef")'}
                    value={code}
                    onChange={setCode}
                    multiline
                    autoCorrect={false}
                    autoCapitalize="none"
                    spellCheck={false}
                />
                <PrimaryButton
                    label={running ? "Running..." : "Run & copy result"}
                    style={{ marginTop: 8 }}
                    disabled={running}
                    onPress={run}
                />
                {result != null && (
                    <Text style={{ marginTop: 8, fontSize: 12.5, opacity: 0.85, color: textColor() }} selectable>
                        {result.length > 2000 ? `${result.slice(0, 2000)}\n... (truncated, full result copied)` : result}
                    </Text>
                )}
                <Text style={{ marginTop: 8, fontSize: 12.5, opacity: 0.7, color: textColor() }}>
                    Runs as a plain (non-async) function body - a bare expression or `return ...`
                    works, but not the async/await keywords (Hermes doesn't support those in
                    dynamically-eval'd code). For timed/async checks, return a Promise built with a
                    plain function instead of an arrow/async function - it gets awaited for you
                    outside the sandbox. In scope: findByProps/findByName/
                    findByTypeName/findByStoreName/findByPropsAll/findByNameAll/find, the raw*
                    passive variants (rawFind/rawFindByTypeName/rawFindByProps/rawFindByName/
                    rawFindByStoreName), instead/before/after, getAssetIDByName, showToast, React, ReactNative,
                    FluxDispatcher, and window. Nothing runs until you tap the button.
                </Text>
            </View>
        </FormSection>
    );
}

function FluxLoggerSection() {
    const [filter, setFilter] = React.useState("");
    const [seconds, setSeconds] = React.useState("10");
    const [result, setResult] = React.useState<string | null>(null);
    const [capturing, setCapturing] = React.useState(false);

    const capture = async () => {
        if (capturing) return;
        const durationMs = Math.max(1, Number(seconds) || 10) * 1000;
        setCapturing(true);
        setResult(null);
        showToast(`Capturing Flux events for ${durationMs / 1000}s - go do the thing...`, undefined);
        try {
            const report = await captureFluxEvents(durationMs, filter);
            setResult(report);
            clipboard.setString(report);
            showToast("Capture done - report copied", undefined);
        } finally {
            setCapturing(false);
        }
    };

    return (
        <FormSection title="Flux event logger">
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <FormInput
                    title="Filter (optional substring, e.g. GUILD)"
                    placeholder="Leave blank to capture everything"
                    value={filter}
                    onChange={setFilter}
                />
                <FormInput
                    title="Capture duration (seconds)"
                    placeholder="10"
                    value={seconds}
                    onChange={setSeconds}
                    keyboardType="numeric"
                />
                <PrimaryButton
                    label={capturing ? "Capturing..." : "Start capture"}
                    style={{ marginTop: 8 }}
                    disabled={capturing}
                    onPress={capture}
                />
                {result != null && (
                    <Text style={{ marginTop: 8, fontSize: 12.5, opacity: 0.85, color: textColor() }} selectable>
                        {result.length > 2000 ? `${result.slice(0, 2000)}\n... (truncated, full report copied)` : result}
                    </Text>
                )}
                <Text style={{ marginTop: 8, fontSize: 12.5, opacity: 0.7, color: textColor() }}>
                    Tap start, then go do the thing you're trying to understand (open a screen, send a
                    message, tap a button) before the window closes. Reports every action type that
                    dispatched, sorted by count - the fastest way to find which event to hook into
                    instead of guessing from decompiled source.
                </Text>
            </View>
        </FormSection>
    );
}

function RenderLoggerSection() {
    const [componentName, setComponentName] = React.useState("");
    const [maxCalls, setMaxCalls] = React.useState("3");
    const [seconds, setSeconds] = React.useState("15");
    const [result, setResult] = React.useState<string | null>(null);
    const [capturing, setCapturing] = React.useState(false);

    const capture = async () => {
        const name = componentName.trim();
        if (!name || capturing) return;
        const durationMs = Math.max(1, Number(seconds) || 15) * 1000;
        setCapturing(true);
        setResult(null);
        try {
            const report = await captureComponentRenders(name, Math.max(1, Number(maxCalls) || 3), durationMs);
            setResult(report);
            clipboard.setString(report);
            showToast("Capture done - result copied", undefined);
        } finally {
            setCapturing(false);
        }
    };

    return (
        <FormSection title="Component render/props logger">
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <FormInput
                    title="Component name (findByTypeName / findByName)"
                    placeholder="e.g. YouBarNotificationsButton"
                    value={componentName}
                    onChange={setComponentName}
                />
                <FormInput title="Max renders to capture" placeholder="3" value={maxCalls} onChange={setMaxCalls} keyboardType="numeric" />
                <FormInput title="Give up after (seconds)" placeholder="15" value={seconds} onChange={setSeconds} keyboardType="numeric" />
                <PrimaryButton
                    label={capturing ? "Waiting for renders..." : "Start capture"}
                    style={{ marginTop: 8 }}
                    disabled={capturing}
                    onPress={capture}
                />
                {result != null && (
                    <Text style={{ marginTop: 8, fontSize: 12.5, opacity: 0.85, color: textColor() }} selectable>
                        {result.length > 2000 ? `${result.slice(0, 2000)}\n... (truncated, full result copied)` : result}
                    </Text>
                )}
                <Text style={{ marginTop: 8, fontSize: 12.5, opacity: 0.7, color: textColor() }}>
                    Patches the component to log its actual props on every render, up to the call cap
                    or the time limit. Only works for React.memo/forwardRef-wrapped components (most
                    of what findByTypeName/findByName return) - a bare function component has no
                    property to intercept its own calls through.
                </Text>
            </View>
        </FormSection>
    );
}

function RawSearchSection() {
    const [propQuery, setPropQuery] = React.useState("");
    const [nameQuery, setNameQuery] = React.useState("");
    const [typeQuery, setTypeQuery] = React.useState("");
    const [storeQuery, setStoreQuery] = React.useState("");

    const run = (label: string, fn: () => any) => {
        try {
            const mod = fn();
            if (!mod) {
                clipboard.setString(`${label} -> not found`);
                showToast("Not found - copied that result", undefined);
                return;
            }
            const keys = Object.keys(mod).sort();
            clipboard.setString(`${label} -> found, keys:\n${keys.join("\n")}`);
            showToast(`Found it - copied ${keys.length} key(s)`, undefined);
        } catch (e) {
            clipboard.setString(`Error running ${label}: ${e}`);
            showToast("Search failed - copied the error instead", undefined);
        }
    };

    return (
        <FormSection title="Raw search (bypasses the negative-result cache)">
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <FormInput
                    title="rawFindByProps - comma-separated prop names"
                    placeholder="e.g. getRootNavigationRef"
                    value={propQuery}
                    onChange={setPropQuery}
                />
                <PrimaryButton
                    label="Search & copy result"
                    style={{ marginTop: 8, marginBottom: 16 }}
                    onPress={() => {
                        const props = propQuery.split(",").map((p) => p.trim()).filter(Boolean);
                        if (props.length) run(`rawFindByProps(${props.join(", ")})`, () => rawFindByProps(...props));
                    }}
                />

                <FormInput title="rawFindByName" placeholder="e.g. YouBarNotificationsButton" value={nameQuery} onChange={setNameQuery} />
                <PrimaryButton
                    label="Search & copy result"
                    style={{ marginTop: 8, marginBottom: 16 }}
                    onPress={() => nameQuery.trim() && run(`rawFindByName("${nameQuery.trim()}")`, () => rawFindByName(nameQuery.trim()))}
                />

                <FormInput title="rawFindByTypeName" placeholder="e.g. YouBarNotificationsButton" value={typeQuery} onChange={setTypeQuery} />
                <PrimaryButton
                    label="Search & copy result"
                    style={{ marginTop: 8, marginBottom: 16 }}
                    onPress={() => typeQuery.trim() && run(`rawFindByTypeName("${typeQuery.trim()}")`, () => rawFindByTypeName(typeQuery.trim()))}
                />

                <FormInput title="rawFindByStoreName" placeholder="e.g. GuildStore" value={storeQuery} onChange={setStoreQuery} />
                <PrimaryButton
                    label="Search & copy result"
                    style={{ marginTop: 8 }}
                    onPress={() => storeQuery.trim() && run(`rawFindByStoreName("${storeQuery.trim()}")`, () => rawFindByStoreName(storeQuery.trim()))}
                />

                <Text style={{ marginTop: 8, fontSize: 12.5, opacity: 0.7, color: textColor() }}>
                    Revenge's own findByProps/findByName/findByTypeName/findByStoreName cache a
                    negative result forever the first time a search comes up empty, and never rescan
                    - so if a module hasn't been required yet when you search, it can look "missing"
                    permanently for the rest of the session even after it registers. These raw*
                    variants only ever read modules Metro's own isInitialized flag says are already
                    loaded (never force-requiring anything), so re-running one after doing the thing
                    that loads your target module will actually find it.
                </Text>
            </View>
        </FormSection>
    );
}

function FiberCaptureSection() {
    const [status, setStatus] = React.useState(
        "Not captured yet - scroll this section into view (or reopen this screen) to trigger the ref."
    );

    const captureRef = (instance: any) => {
        if (!instance) return;
        try {
            let fiber: any = null;
            let method = "";

            if (instance._internalFiberInstanceHandleDEV) {
                fiber = instance._internalFiberInstanceHandleDEV;
                method = "_internalFiberInstanceHandleDEV";
            } else if (instance._internalInstanceHandle) {
                fiber = instance._internalInstanceHandle;
                method = "_internalInstanceHandle";
            } else if (instance.__internalInstanceHandle) {
                // Fabric (RN's new architecture) - confirmed present on-device via the diagnostic
                // status text (single-underscore variants above don't exist on this build at all).
                fiber = instance.__internalInstanceHandle;
                method = "__internalInstanceHandle";
            } else {
                const fiberKey = Object.keys(instance).find(
                    (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")
                );
                if (fiberKey) {
                    fiber = instance[fiberKey];
                    method = fiberKey;
                }
            }

            if (!fiber) {
                setStatus(`No fiber pointer found on the instance. Instance keys: ${Object.keys(instance).join(", ") || "(none)"}`);
                return;
            }

            // Fabric's __internalInstanceHandle isn't always the bare fiber itself in every RN
            // version - some ship it as a wrapper one level up. If it doesn't already look
            // fiber-shaped (no .return/.child at all), try the couple of commonly-nested spots
            // before giving up, so a shape difference doesn't just silently produce a useless tree.
            if (fiber.return === undefined && fiber.child === undefined) {
                const nested = fiber.stateNode ?? fiber.fiber ?? fiber._debugOwner;
                if (nested && (nested.return !== undefined || nested.child !== undefined)) {
                    fiber = nested;
                    method += " (via nested property)";
                } else {
                    setStatus(`Found "${method}" but it doesn't look fiber-shaped (no .return/.child). Its keys: ${Object.keys(fiber).join(", ") || "(none)"}`);
                    return;
                }
            }

            let root = fiber;
            let guard = 0;
            while (root.return && guard < 5000) {
                root = root.return;
                guard++;
            }

            (window as any).__keyInspectorFiberRoot = root;
            (window as any).__keyInspectorFiberSelf = fiber;
            setStatus(`Captured via "${method}" (walked up ${guard} level(s) to the root). window.__keyInspectorFiberRoot and window.__keyInspectorFiberSelf are now set - use Eval to walk them.`);
        } catch (e) {
            setStatus(`Error: ${e}`);
        }
    };

    return (
        <FormSection title="Fiber capture (for Eval)">
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <View ref={captureRef} style={{ width: 1, height: 1 }} />
                <Text style={{ fontSize: 12.5, opacity: 0.85, color: textColor() }} selectable>{status}</Text>
                <Text style={{ marginTop: 8, fontSize: 12.5, opacity: 0.7, color: textColor() }}>
                    Reads React's own internal fiber pointer directly off a native view instance -
                    works without React DevTools (confirmed absent on this build), since it's the
                    same internal linkage React itself relies on to route touch events, not an
                    inspector-only feature. Walks up to the root fiber automatically so Eval can
                    search the whole live tree (whatever's actually mounted right now, not
                    module-registry guessing) from window.__keyInspectorFiberRoot afterward.
                </Text>
            </View>
        </FormSection>
    );
}

function ApiTreeSection() {
    return (
        <FormSection title="Full Vendetta API tree">
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <PrimaryButton
                    label="Copy the entire plugin API tree"
                    onPress={() => {
                        const tree = dumpVendettaApiTree(3);
                        const lineCount = tree.split("\n").length;
                        clipboard.setString(tree);
                        showToast(`Copied ${lineCount} lines - every key path under window.vendetta`, undefined);
                    }}
                />
                <Text style={{ marginTop: 8, fontSize: 12.5, opacity: 0.7, color: textColor() }}>
                    Every key path under the stable plugin API (window.vendetta), 3 levels deep - this
                    is everything Revenge itself exposes to plugins, not Discord's raw internals (those
                    are searchable individually below, since dumping all of them would be enormous).
                </Text>
            </View>
        </FormSection>
    );
}

function ManualSearchSection() {
    const [propQuery, setPropQuery] = React.useState("");
    const [nameQuery, setNameQuery] = React.useState("");

    const searchProps = () => {
        const props = propQuery.split(",").map((p) => p.trim()).filter(Boolean);
        if (!props.length) return;

        try {
            const mod = findByProps(...props);
            if (!mod) {
                clipboard.setString(`findByProps(${props.join(", ")}) -> not found`);
                showToast("No module found - copied that result", undefined);
                return;
            }
            const keys = Object.keys(mod).sort();
            clipboard.setString(`findByProps(${props.join(", ")}) -> found, keys:\n${keys.join("\n")}`);
            showToast(`Found it - copied ${keys.length} key(s)`, undefined);
        } catch (e) {
            clipboard.setString(`Error searching for ${props.join(", ")}: ${e}`);
            showToast("Search failed - copied the error instead", undefined);
        }
    };

    const searchName = () => {
        const name = nameQuery.trim();
        if (!name) return;

        try {
            const mod = findByName(name, false);
            if (!mod) {
                clipboard.setString(`findByName("${name}") -> not found`);
                showToast("No component found - copied that result", undefined);
                return;
            }
            const keys = Object.keys(mod).sort();
            clipboard.setString(`findByName("${name}") -> found, keys:\n${keys.join("\n")}`);
            showToast(`Found it - copied ${keys.length} key(s)`, undefined);
        } catch (e) {
            clipboard.setString(`Error searching for "${name}": ${e}`);
            showToast("Search failed - copied the error instead", undefined);
        }
    };

    const searchPropsAll = () => {
        const props = propQuery.split(",").map((p) => p.trim()).filter(Boolean);
        if (!props.length) return;

        try {
            const mods: any[] = findByPropsAll(...props) ?? [];
            const summary = mods.map((m, i) => `[${i}] keys: ${Object.keys(m).sort().join(", ")}`).join("\n\n");
            clipboard.setString(`findByPropsAll(${props.join(", ")}) -> ${mods.length} match(es)\n\n${summary}`);
            showToast(`${mods.length} match(es) - report copied`, undefined);
        } catch (e) {
            clipboard.setString(`Error searching for ${props.join(", ")}: ${e}`);
            showToast("Search failed - copied the error instead", undefined);
        }
    };

    const searchNameAll = () => {
        const name = nameQuery.trim();
        if (!name) return;

        try {
            const mods: any[] = findByNameAll(name, false) ?? [];
            const summary = mods.map((m, i) => `[${i}] keys: ${Object.keys(m).sort().join(", ")}`).join("\n\n");
            clipboard.setString(`findByNameAll("${name}") -> ${mods.length} match(es)\n\n${summary}`);
            showToast(`${mods.length} match(es) - report copied`, undefined);
        } catch (e) {
            clipboard.setString(`Error searching for "${name}": ${e}`);
            showToast("Search failed - copied the error instead", undefined);
        }
    };

    return (
        <FormSection title="One-off search">
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <FormInput
                    title="findByProps - comma-separated prop names"
                    placeholder="e.g. sendMessage, sendBotMessage"
                    value={propQuery}
                    onChange={setPropQuery}
                />
                <PrimaryButton label="Search first match & copy" style={{ marginTop: 8 }} onPress={searchProps} />
                <PrimaryButton label="Search ALL matches & copy" style={{ marginTop: 8, marginBottom: 16 }} onPress={searchPropsAll} />

                <FormInput
                    title="findByName - component name"
                    placeholder="e.g. ThemedRolePill"
                    value={nameQuery}
                    onChange={setNameQuery}
                />
                <PrimaryButton label="Search first match & copy" style={{ marginTop: 8 }} onPress={searchName} />
                <PrimaryButton label="Search ALL matches & copy" style={{ marginTop: 8 }} onPress={searchNameAll} />

                <Text style={{ marginTop: 8, fontSize: 12.5, opacity: 0.7, color: textColor() }}>
                    "ALL matches" is worth checking even when the first-match search succeeds - more
                    than one module matching the same name/props is a common source of "found the
                    wrong one" bugs (patching a re-export or an unrelated duplicate instead of the
                    component actually on screen).
                </Text>
            </View>
        </FormSection>
    );
}

export default function Settings() {
    return (
        <SettingsScaffold>
            <FullScanSection />
            <FiberCaptureSection />
            <RawSearchSection />
            <ManualSearchSection />
            <FluxLoggerSection />
            <RenderLoggerSection />
            <EvalSection />
            <ApiTreeSection />
            <NoteBox>
                The full scan checks every internal lookup this repo's plugins depend on (plus a few
                for plugins currently being fixed) in one pass, and includes the complete list of
                semanticColors/rawColors keys at the end. Paste the report back into chat when
                reporting a bug - it tells us exactly what's missing on your Discord version.
            </NoteBox>
        </SettingsScaffold>
    );
}
