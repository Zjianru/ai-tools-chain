import chalk from "chalk";
import fs from "fs-extra";
import { resolve } from "path";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { execa } from "execa";

export class RevertAgent {
    constructor() {
        this.name = "revert";
    }

    async step(ctx) {
        const { cwd, tasksDir, taskId, metaPath } = ctx;
        const logs = [];
        try {
            const patchPath = resolve(tasksDir, taskId, "patch.json");
            let items = [];
            if (existsSync(patchPath)) {
                try {
                    const parsed = JSON.parse(readFileSync(patchPath, "utf-8"));
                    items = parsed.items || [];
                } catch {
                    items = [];
                }
            }

            for (const it of items.filter((i) => i.op === "create")) {
                const abs = resolve(cwd, it.path);
                if (existsSync(abs)) {
                    fs.removeSync(abs);
                    logs.push(chalk.gray(`已删除新建文件：${it.path}`));
                }
            }

            try {
                await execa("git", ["restore", "--worktree", "."], { cwd }).catch(async () => {
                    await execa("git", ["checkout", "--", "."], { cwd });
                });
                await execa("git", ["clean", "-fd"], { cwd });
                logs.push(chalk.green("已通过 git restore/clean 回滚工作区。"));
            } catch (e) {
                logs.push(chalk.red("回滚时出现问题："), e.message || String(e));
            }

            try {
                const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
                meta.status = "redo";
                writeFileSync(metaPath, JSON.stringify(meta, null, 2));
                logs.push(chalk.gray("已将 meta.status 标记为 redo。"));
            } catch {
                // ignore meta failures
            }

            const statePatch = {
                phase: "planning",
                actors: {
                    revert: { status: "completed" },
                    codegen: { status: "redo" }
                }
            };

            logs.push(chalk.green("↩ 已回滚到 pre-commit 快照。"));
            return { logs, statePatch };
        } catch (e) {
            logs.push(chalk.red("RevertAgent 执行失败："), e.message || String(e));
            return { logs, statePatch: null, error: e.message || String(e) };
        }
    }
}

