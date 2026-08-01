import { readFile, writeFile, readdir } from "fs/promises";
import { extname, resolve as resolvePath } from "path";
import { createHash } from "crypto";

import { rollup } from "rollup";
import alias from "@rollup/plugin-alias";
import url from "@rollup/plugin-url";
import esbuild from "rollup-plugin-esbuild";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import swc from "@swc/core";

const extensions = [".js", ".jsx", ".mjs", ".ts", ".tsx", ".cts", ".mts"];

// Plugins are each built into an independent, self-contained bundle (users install them one at a time),
// so they can't import from each other at runtime - but they CAN share source at build time. This alias
// lets any plugin `import { x } from "@shared/..."` and have it inlined straight into its own bundle.
/** @type import("rollup").InputPluginOption */
const plugins = [
    alias({
        entries: [
            { find: "@shared", replacement: resolvePath("./shared") },
            // FPTE's own internal aliases, namespaced to avoid colliding with any other plugin
            // that might want a generic "@lib"/"@ui" of its own.
            { find: "@fpte/lib", replacement: resolvePath("./plugins/fake-profile-themes-and-effects/src/lib") },
            { find: "@fpte/ui", replacement: resolvePath("./plugins/fake-profile-themes-and-effects/src/ui") },
            { find: "@fpte/patches", replacement: resolvePath("./plugins/fake-profile-themes-and-effects/src/patches") },
        ],
    }),
    nodeResolve({ extensions: [".mjs", ".js", ".json", ".node", ".ts", ".tsx"] }),
    commonjs(),
    url({
        include: ["**/*.svg", "**/*.png", "**/*.jpg", "**/*.gif"],
        limit: 0,
    }),
    {
        name: "swc",
        async transform(code, id) {
            const ext = extname(id);
            if (!extensions.includes(ext)) return null;

            const ts = ext.includes("ts");
            const tsx = ts ? ext.endsWith("x") : undefined;
            const jsx = !ts ? ext.endsWith("x") : undefined;

            const result = await swc.transform(code, {
                filename: id,
                jsc: {
                    externalHelpers: true,
                    parser: {
                        syntax: ts ? "typescript" : "ecmascript",
                        tsx,
                        jsx,
                    },
                },
                env: {
                    targets: "defaults",
                    include: [
                        "transform-classes",
                        "transform-arrow-functions",
                    ],
                },
            });
            return result.code;
        },
    },
    esbuild({ minify: true }),
];

// Each plugin's actual install target (manifest.json + index.js) lives at /<id>/install/, so that
// /<id>/ itself is free to be a real, bookmarkable HTML page describing the plugin (see generate-site.mjs).
for (const plug of await readdir("./plugins")) {
    const manifest = JSON.parse(await readFile(`./plugins/${plug}/manifest.json`));
    const outPath = `./dist/${plug}/install/index.js`;

    try {
        const bundle = await rollup({
            input: `./plugins/${plug}/${manifest.main}`,
            onwarn: () => {},
            // Most plugins only ever import React/ReactNative via @vendetta/metro/common, which
            // resolves to nothing on disk and so is treated as external automatically - but a
            // couple of ported plugins import the bare "react"/"react-native" packages directly
            // (like their own original build configs expected), and those DO exist in
            // node_modules, so without this they'd actually get bundled - including react-native's
            // real source, which contains Flow syntax this toolchain can't parse.
            external: ["react", "react-native"],
            plugins,
        });

        await bundle.write({
            file: outPath,
            globals(id) {
                if (id.startsWith("@vendetta")) return id.substring(1).replace(/\//g, ".");
                const map = {
                    react: "window.React",
                    "react-native": "vendetta.metro.common.ReactNative",
                };

                return map[id] || null;
            },
            format: "iife",
            compact: true,
            exports: "named",
        });
        await bundle.close();

        const toHash = await readFile(outPath);
        manifest.hash = createHash("sha256").update(toHash).digest("hex");
        manifest.main = "index.js";
        await writeFile(`./dist/${plug}/install/manifest.json`, JSON.stringify(manifest));

        console.log(`Successfully built ${manifest.name}!`);
    } catch (e) {
        console.error(`Failed to build ${plug}...`, e);
        process.exit(1);
    }
}
