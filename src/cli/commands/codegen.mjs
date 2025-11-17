import chalk from "chalk";
import { applyStatePatch } from "../../core/state.mjs";
import { CodegenAgent } from "../../agents/codegenAgent.mjs";

export async function handleCodegenCommand({
    line,
    cfg,
    cwd,
    aiDir,
    tasksDir,
    taskId,
    metaPath,
    ask
}) {
    const cfgTask = cfg?.task || {};
    const ans = await ask(
        chalk.yellow("将要生成代码并写入工作区。请输入中文强确认短语“确认生成”继续，或回车取消 > ")
    );
    if (ans !== "确认生成") {
        console.log(chalk.yellow("已取消 codegen。"));
        return;
    }

    let branchName = null;
    const perTask = String(cfgTask.per_task_branch || "false") === "true";
    if (perTask) {
        const defType = "feat";
        const defSlug = "task";
        const type = (await ask(chalk.cyan(`分支类型（默认 ${defType}）> `))) || defType;
        const slug = (await ask(chalk.cyan(`分支 slug（默认 ${defSlug}）> `))) || defSlug;
        branchName = (cfgTask.branch_pattern || "{type}/{slug}-task-{id}")
            .replaceAll("{type}", type)
            .replaceAll("{slug}", slug)
            .replaceAll("{id}", taskId);
        console.log(chalk.gray(`创建分支：${branchName}`));
    }

    try {
        const agent = new CodegenAgent();
        const result = await agent.step({
            cwd,
            aiDir,
            tasksDir,
            taskId,
            metaPath,
            cfg,
            branchName,
            repoSummaryOverride: "(可选) 这里可以用 git ls-files + 目录树生成概览"
        });
        (result.logs || []).forEach((ln) => console.log(ln));
        if (result.statePatch) {
            applyStatePatch(tasksDir, taskId, result.statePatch);
        }
    } catch (e) {
        const msg = e.message || String(e);
        console.log(chalk.red("codegen 失败："), msg);
        if (
            msg.includes("codegen_json_parse_failed") ||
            msg.includes("codegen_json_missing_files_array") ||
            msg.includes("codegen_json_no_valid_file_entries") ||
            msg.includes("codegen IR 中存在缺少 path 的条目") ||
            msg.includes("内容看起来仍是 JSON")
        ) {
            console.log(
                chalk.yellow("提示：模型返回的 JSON/IR 协议不合法，未写入任何业务文件。")
            );
            console.log(
                chalk.gray(
                    `- 查看详情：.ai-tools-chain/tasks/${taskId}/logs/models/codegen.invoke.json`
                )
            );
            console.log(
                chalk.gray(
                    "- 建议：调整规划或 codegen prompt / provider 后重试；如需紧急使用，可手动拷贝模型输出中的代码片段。"
                )
            );
        }
    }
}

