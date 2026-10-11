import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { mkdtemp, writeFile, rm } from "fs/promises";
import os from "os";
import path from "path";

/* ponytail: local spawn + timeout instead of a sandbox service;
   upgrade path: containerized executor if this ever faces untrusted users */
const RUNTIMES = {
  javascript: { ext: "js", runner: (file) => ["node", [file]] },
  python: { ext: "py", runner: (file) => ["python3", [file]] },
  cpp: { ext: "cpp" },
  java: { ext: "java" },
};

/* ponytail: local spawn first, Wandbox fallback when binary missing;
   remote keeps Render native working with zero Dashboard change.
   Piston public API went whitelist-only, Wandbox needs no key. */
const WANDBOX = "https://wandbox.org/api/compile.json";
const WANDBOX_LIST = "https://wandbox.org/api/list.json";

let compilerCache = null;
const resolveCompiler = async (language) => {
  if (!compilerCache) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(WANDBOX_LIST, { signal: ctrl.signal });
      compilerCache = await res.json();
    } catch {
      compilerCache = [];
    } finally {
      clearTimeout(t);
    }
  }
  if (language === "java") {
    /* First Java entry; entry file is prog.java so caller must send
       non-public class prog (see javaForWandbox below). */
    return compilerCache.find((c) => c.language === "Java")?.name;
  }
  return (
    compilerCache.find((c) => c.name === "gcc-head")?.name ||
    compilerCache.find((c) => c.language === "C++")?.name
  );
};

/* Wandbox compiles Java as prog.java — public class Main fails, so
   rewrite any public class X to plain class prog. */
const javaForWandbox = (src) => {
  let s = src;
  if (!/class\s+[A-Za-z_$][\w$]*/.test(s)) s = `public class Main {\n${s}\n}`;
  if (/public\s+(?:(?:abstract|final)\s+)*class\s+[A-Za-z_$][\w$]*/.test(s)) {
    return s.replace(
      /public\s+(?:(?:abstract|final)\s+)*class\s+[A-Za-z_$][\w$]*/,
      "class prog",
    );
  }
  return s.replace(/(^|\n)\s*class\s+[A-Za-z_$][\w$]*/, "$1class prog");
};

const runViaWandbox = async (language, code) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const compiler = await resolveCompiler(language);
    if (!compiler) throw new Error("no compiler listed");
    const body =
      language === "java"
        ? { compiler, code: javaForWandbox(code), save: false }
        : { compiler, code, save: false };
    const res = await fetch(WANDBOX, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    const ok = data.status === "0";
    return {
      stdout: data.program_output || data.program_message || "",
      stderr:
        data.compiler_error || data.compiler_message || data.program_error || (ok ? "" : "Remote run failed."),
      code: ok ? 0 : 1,
    };
  } catch (e) {
    return {
      stdout: "",
      stderr: `Remote runner unavailable (${e.name === "AbortError" ? "timeout" : e.message}). Try again.`,
      code: 1,
    };
  } finally {
    clearTimeout(timer);
  }
};

/* Local ENOENT (127) = binary absent on host. Fall back to remote. */
const missingLocal = (r) => r && r.code === 127;

const exec = (cmd, args, cwd) =>
  new Promise((resolve) => {
    let p;
    try {
      p = spawn(cmd, args, { cwd });
    } catch (e) {
      resolve({ stdout: "", stderr: e.message, code: 127 });
      return;
    }
    let stdout = "";
    let stderr = "";
    const cap = (s) =>
      s.length > 65536 ? s.slice(0, 65536) + "\n…output truncated" : s;
    p.stdout?.on("data", (d) => (stdout = cap(stdout + d)));
    p.stderr?.on("data", (d) => (stderr = cap(stderr + d)));
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      resolve({
        stdout,
        stderr: cap(stderr + "\nTime limit exceeded (5s)"),
        code: 124,
        timedOut: true,
      });
    }, 5000);
    p.on("error", (e) => {
      clearTimeout(timer);
      const hint =
        e?.code === "ENOENT"
          ? `Command "${cmd}" not found on server.`
          : e.message;
      resolve({ stdout, stderr: cap(stderr + hint), code: 127 });
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });

export async function POST(request) {
  const { language, code } = (await request.json().catch(() => ({}))) ?? {};
  const rt = RUNTIMES[language];
  if (!rt || typeof code !== "string" || !code.trim()) {
    return NextResponse.json(
      { error: "Unsupported language or empty code." },
      { status: 400 },
    );
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "rtc-run-"));
  try {
    const file = path.join(dir, `main.${rt.ext}`);
    let runCmd;
    let runArgs;

    if (language === "cpp") {
      await writeFile(file, code);
      const build = await exec(
        "g++",
        [file, "-o", path.join(dir, "prog")],
        dir,
      );
      if (build.code !== 0) {
        if (missingLocal(build))
          return NextResponse.json(await runViaWandbox("cpp", code));
        return NextResponse.json(build);
      }
      runCmd = path.join(dir, "prog");
      runArgs = [];
    } else if (language === "java") {
      /* Bare "public static void main..." snippet with no class (what the
         editor autocomplete inserts) would otherwise produce an empty
         Main.java on older JDKs. Wrap it so it compiles everywhere. */
      let src = code;
      if (!/class\s+[A-Za-z_$][\w$]*/.test(src)) {
        src = `public class Main {\n${src}\n}`;
      }
      const cls =
        src.match(
          /public\s+(?:(?:abstract|final)\s+)*class\s+([A-Za-z_$][\w$]*)/,
        )?.[1] || "Main";
      await writeFile(path.join(dir, `${cls}.java`), src);
      const build = await exec("javac", [`${cls}.java`], dir);
      if (build.code !== 0) {
        if (missingLocal(build))
          return NextResponse.json(await runViaWandbox("java", code));
        return NextResponse.json(build);
      }
      runCmd = "java";
      runArgs = ["-cp", dir, cls];
    } else {
      await writeFile(file, code);
      [runCmd, runArgs] = rt.runner(file);
    }

    const out = await exec(runCmd, runArgs, dir);
    if (missingLocal(out)) {
      /* Local binary absent (Render native) — rerun remotely.
         ponytail: remote covers compiled langs only; python/node
         exist on Render native, so no fallback needed there. */
      if (language === "java")
        return NextResponse.json(await runViaWandbox("java", code));
      if (language === "cpp")
        return NextResponse.json(await runViaWandbox("cpp", code));
    }
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    rm(dir, { recursive: true, force: true });
  }
}
