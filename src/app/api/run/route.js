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

/* Friendly name when the binary is not on PATH (e.g. Render native
   image without a JDK). Surfaces "Java is not installed..." instead of
   raw "spawn javac ENOENT". */
const MISSING = {
  javac: "Java compiler (javac) is not installed on the server.",
  java: "Java runtime (java) is not installed on the server.",
  "g++": "C++ compiler (g++) is not installed on the server.",
  python3: "Python (python3) is not installed on the server.",
};

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
          ? `${MISSING[cmd] || `Command "${cmd}" not found on the server.`} ` +
            "Render native images ship no JDK — deploy via Docker (Dockerfile in repo root)."
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
      if (build.code !== 0) return NextResponse.json(build);
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
      if (build.code !== 0) return NextResponse.json(build);
      runCmd = "java";
      runArgs = ["-cp", dir, cls];
    } else {
      await writeFile(file, code);
      [runCmd, runArgs] = rt.runner(file);
    }

    return NextResponse.json(await exec(runCmd, runArgs, dir));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    rm(dir, { recursive: true, force: true });
  }
}
