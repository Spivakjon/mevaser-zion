/**
 * agent-team-he.js
 *
 * Usage:
 * node agent-team-he.js "work as a team on the orders tab"
 *
 * What it does:
 * - If the message includes "work as a team" or "team work":
 *   1) Asks you for a short team name (or auto-generates if empty)
 *   2) Tries to understand the task and scope
 *   3) If it can't figure out which folders to work on, asks you
 *   4) Creates a LOCK for the team
 *   5) Runs:
 *      Claude PLAN -> Codex IMPLEMENT -> Claude REVIEW -> Codex FIX -> Claude FINAL
 *
 * - If there's no team work trigger:
 *   Sends the request to Claude only
 *
 * Place this file in the project root.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const MAX_REVIEW_LOOPS = 2;
const LOCK_DIR = ".team-locks";
const LOG_DIR = ".team-logs";
const TEAM_TRIGGERS = ["work as a team", "team work"];

if (!fs.existsSync(LOCK_DIR)) fs.mkdirSync(LOCK_DIR, { recursive: true });
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const rawTask = process.argv.slice(2).join(" ").trim();

if (!rawTask) {
  console.log('Usage: node agent-team-he.js "work as a team on the orders tab"');
  process.exit(1);
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve((answer || "").trim());
    });
  });
}

function slugify(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40) || ("team-" + Date.now());
}

function runTool(command, prompt, outFile) {
  console.log("\n==================================================");
  console.log("RUN:", command);
  console.log("==================================================\n");

  const result = spawnSync(command, {
    input: prompt,
    encoding: "utf8",
    shell: true,
    maxBuffer: 30 * 1024 * 1024
  });

  const stdout = (result.stdout || "").trim();
  const stderr = (result.stderr || "").trim();
  const combined = [stdout, stderr ? "\n[stderr]\n" + stderr : ""].filter(Boolean).join("\n");

  fs.writeFileSync(outFile, combined || "(no output)", "utf8");

  if (result.error) throw result.error;
  if (result.status !== 0 && !combined) {
    throw new Error(`${command} failed with code ${result.status}`);
  }

  return combined;
}

function hasTeamTrigger(text) {
  return TEAM_TRIGGERS.some(t => text.includes(t));
}

function stripTeamTrigger(text) {
  let t = text;
  for (const trig of TEAM_TRIGGERS) {
    t = t.replace(trig, "");
  }
  return t.replace(/^[\s:,-]+/, "").trim();
}

function listProjectDirs(rootDir, maxDepth = 3, currentDepth = 0, base = "") {
  let results = [];
  if (currentDepth > maxDepth) return results;

  let entries = [];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".git") || entry.name === "node_modules" || entry.name === ".team-locks" || entry.name === ".team-logs") continue;

    const rel = path.join(base, entry.name).replace(/\\/g, "/");
    results.push(rel);
    results = results.concat(listProjectDirs(path.join(rootDir, entry.name), maxDepth, currentDepth + 1, rel));
  }
  return results;
}

function inferScopeFromTask(task, allDirs) {
  const lowerTask = task.toLowerCase();
  const matched = [];

  for (const dir of allDirs) {
    const parts = dir.toLowerCase().split("/");
    if (parts.some(p => p && lowerTask.includes(p))) {
      matched.push(dir);
    }
  }

  const tabMatch = task.match(/tab\s+["']?([^"'\n,]+)["']?/i);
  if (tabMatch) {
    const key = tabMatch[1].trim().toLowerCase();
    for (const dir of allDirs) {
      const d = dir.toLowerCase();
      if (d.includes(key)) matched.push(dir);
    }
  }

  return [...new Set(matched)].slice(0, 12);
}

function readActiveLocks() {
  const locks = [];
  const files = fs.readdirSync(LOCK_DIR).filter(f => f.endsWith(".json"));
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(LOCK_DIR, file), "utf8"));
      locks.push(data);
    } catch {}
  }
  return locks;
}

function overlappingLocks(scope, locks, currentTeam) {
  const hits = [];
  for (const lock of locks) {
    if (lock.team === currentTeam) continue;
    const overlap = (lock.folders || []).filter(f => scope.includes(f));
    if (overlap.length) {
      hits.push({ team: lock.team, overlap });
    }
  }
  return hits;
}

function saveLock(team, folders, task) {
  const lock = {
    team,
    folders,
    task,
    started: new Date().toISOString(),
    cwd: process.cwd()
  };
  fs.writeFileSync(path.join(LOCK_DIR, `${team}.json`), JSON.stringify(lock, null, 2), "utf8");
}

function removeLock(team) {
  const file = path.join(LOCK_DIR, `${team}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function isAcceptable(reviewText) {
  const t = (reviewText || "").toLowerCase();
  if (t.includes("needs rework")) return false;
  if (t.includes("acceptable with fixes")) return false;
  return t.includes("acceptable");
}

function mkLogFile(team, name) {
  return path.join(LOG_DIR, `${team}-${name}.txt`);
}

function planPrompt(task, scope, conflicts) {
  return `
You are a senior planner and code reviewer.

Task:
${task}

Allowed folders only:
${scope.join(", ")}

${conflicts.length ? `Conflict warning with other teams:
${conflicts.map(c => `- Team ${c.team} also works on: ${c.overlap.join(", ")}`).join("\n")}` : "No known conflicts at this time."}

Rules:
- Do not write code
- Work only within the allowed folders
- If a shared file outside scope must be modified, mention it explicitly
- Keep changes minimal

Return exactly:
1. Goal
2. Relevant files/folders
3. Architecture decisions
4. Step-by-step implementation plan
5. Risks / shared-file warnings
`.trim();
}

function implementPrompt(task, scope, planText, conflicts) {
  return `
You are the implementation engineer.

Task:
${task}

Allowed folders only:
${scope.join(", ")}

${conflicts.length ? `Conflict warning with other teams:
${conflicts.map(c => `- Team ${c.team} also uses: ${c.overlap.join(", ")}`).join("\n")}` : "No known active folder conflicts."}

Implementation plan:
${planText}

Rules:
- Implement only what is needed
- Stay inside the allowed folders as much as possible
- If a shared file outside scope must be modified, keep the change minimal and mention it explicitly
- Avoid unrelated refactors

At the end return:
1. Modified files
2. Summary of changes
3. Manual tests still needed
`.trim();
}

function reviewPrompt(task, scope, planText, latestText, iteration) {
  return `
You are the reviewer.

Task:
${task}

Allowed folders:
${scope.join(", ")}

Original plan:
${planText}

Latest implementation summary/output:
${latestText}

Inspect the changed files directly.

Check:
- correctness
- plan compliance
- scope compliance
- bugs
- regressions
- shared file risks
- maintainability

Return exactly:
1. Review summary
2. Concrete issues
3. Ordered action list
4. Final verdict: acceptable / acceptable with fixes / needs rework

Review iteration #${iteration}
`.trim();
}

function fixPrompt(task, scope, reviewText) {
  return `
You are the implementation engineer.

Task:
${task}

Allowed folders:
${scope.join(", ")}

Apply the following review fixes exactly:
${reviewText}

Rules:
- Fix required issues first
- Stay inside scope as much as possible
- Avoid unrelated changes

At the end return:
1. Modified files
2. Fix summary
3. Manual tests still needed
`.trim();
}

async function resolveTeamName(task) {
  const suggested = slugify(task.replace(/work as a team|team work/g, "").trim());
  const answer = await ask(`Short team name? Press Enter to use auto-generated [${suggested}]: `);
  return slugify(answer || suggested);
}

async function resolveScope(task, allDirs) {
  const inferred = inferScopeFromTask(task, allDirs);
  if (inferred.length) {
    console.log("\nGuessed working folders:");
    inferred.forEach((d, i) => console.log(`${i + 1}. ${d}`));
    const ok = await ask("\nIs this correct? [Enter=Yes / n=No]: ");
    if (!ok || ok.toLowerCase() !== "n") {
      return inferred;
    }
  }

  console.log("\nCouldn't automatically determine which folders to work on.");
  console.log("Examples:");
  console.log("public/js/pages/orders, services/orders");
  console.log("public/js/pages/whatsapp, services/whatsapp\n");

  const answer = await ask("Which folders is the team allowed to work on? (comma-separated): ");
  const scope = answer.split(",").map(s => s.trim().replace(/\\/g, "/")).filter(Boolean);
  if (!scope.length) {
    throw new Error("No working folders were defined.");
  }
  return scope;
}

async function runClaudeOnly(task) {
  const out = runTool("claude", task, mkLogFile("single", "claude"));
  console.log("\n===== CLAUDE RESPONSE =====\n");
  console.log(out);
}

async function runTeamMode(rawTask) {
  const task = stripTeamTrigger(rawTask) || rawTask;
  const allDirs = listProjectDirs(process.cwd(), 3);
  const team = await resolveTeamName(task);
  const scope = await resolveScope(task, allDirs);
  const locks = readActiveLocks();
  const conflicts = overlappingLocks(scope, locks, team);

  if (conflicts.length) {
    console.log("\nWarning: there is overlap with other teams:");
    for (const c of conflicts) {
      console.log(`- Team ${c.team}: ${c.overlap.join(", ")}`);
    }
    const cont = await ask("\nContinue anyway? [y/N]: ");
    if (cont.toLowerCase() !== "y") {
      console.log("Cancelled.");
      return;
    }
  }

  saveLock(team, scope, task);

  try {
    fs.writeFileSync(mkLogFile(team, "task"), task, "utf8");

    const plan = runTool("claude", planPrompt(task, scope, conflicts), mkLogFile(team, "01-plan"));
    fs.writeFileSync(`${team}-PLAN.md`, plan, "utf8");

    let latest = runTool("codex", implementPrompt(task, scope, plan, conflicts), mkLogFile(team, "02-implement"));
    fs.writeFileSync(`${team}-IMPLEMENTATION.md`, latest, "utf8");

    let finalReview = "";
    for (let i = 1; i <= MAX_REVIEW_LOOPS; i++) {
      finalReview = runTool("claude", reviewPrompt(task, scope, plan, latest, i), mkLogFile(team, `03-review-${i}`));
      fs.writeFileSync(`${team}-REVIEW.md`, finalReview, "utf8");

      if (isAcceptable(finalReview)) {
        fs.writeFileSync(`${team}-FINAL_REVIEW.md`, finalReview, "utf8");
        console.log(`\nTeam ${team} finished successfully.`);
        return;
      }

      latest = runTool("codex", fixPrompt(task, scope, finalReview), mkLogFile(team, `04-fix-${i}`));
      fs.writeFileSync(`${team}-FIXES.md`, latest, "utf8");
    }

    finalReview = runTool("claude", reviewPrompt(task, scope, plan, latest, MAX_REVIEW_LOOPS + 1), mkLogFile(team, "05-final-review"));
    fs.writeFileSync(`${team}-FINAL_REVIEW.md`, finalReview, "utf8");
    console.log(`\nTeam ${team} reached maximum rounds. Check ${team}-FINAL_REVIEW.md`);
  } finally {
    const keep = await ask("\nDelete the team LOCK? [Enter=Yes / n=No]: ");
    if (!keep || keep.toLowerCase() != "n") {
      removeLock(team);
      console.log("LOCK deleted.");
    } else {
      console.log("LOCK kept.");
    }
  }
}

(async () => {
  try {
    if (hasTeamTrigger(rawTask)) {
      await runTeamMode(rawTask);
    } else {
      await runClaudeOnly(rawTask);
    }
  } catch (err) {
    console.error("\nERROR:", err.message);
    process.exit(1);
  }
})();
