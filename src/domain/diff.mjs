import { readFileSync } from "fs";
import { resolve } from "path";
import { execa } from "execa";

/**
 * 使用 git diff --numstat 统计一组已被 git 跟踪文件的增删行。
 * 返回 Map<path, { added, deleted }>。
 */
export async function summarizeModifiedWithGit(cwd, paths) {
    if (!paths || !paths.length) return new Map();
    const args = ["--no-pager", "diff", "--numstat", "--", ...paths];
    const diffByPath = new Map();
    try {
        const { stdout } = await execa("git", args, { cwd });
        const lines = stdout.trim() ? stdout.trim().split("\n") : [];
        for (const ln of lines) {
            const m = ln.match(/^(\d+|\-)\s+(\d+|\-)\s+(.+)$/);
            if (!m) continue;
            const a = m[1] === "-" ? 0 : parseInt(m[1], 10);
            const d = m[2] === "-" ? 0 : parseInt(m[2], 10);
            const p = m[3];
            diffByPath.set(p, { added: a, deleted: d });
        }
    } catch {
        // best-effort，调用方可在缺失时降级为 0 行
    }
    return diffByPath;
}

/**
 * 对新增文件按当前内容统计行数。
 * entries: 数组，元素包含 { path }。
 * 返回 { files: [{path, added, deleted:0}], totalAdded }。
 */
export function summarizeCreatedFiles(cwd, entries) {
    const files = [];
    let totalAdded = 0;
    if (!entries) return { files, totalAdded };
    for (const it of entries) {
        if (!it?.path) continue;
        const abs = resolve(cwd, it.path);
        let text = "";
        try {
            text = readFileSync(abs, "utf-8");
        } catch {
            text = "";
        }
        const lineCount = text ? text.split(/\r?\n/).length : 0;
        totalAdded += lineCount;
        files.push({ path: it.path, added: lineCount, deleted: 0 });
    }
    return { files, totalAdded };
}

