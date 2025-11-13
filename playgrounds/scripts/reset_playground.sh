#!/usr/bin/env bash
# scripts/reset_playground.sh
# 仅清理/重置 当前仓库根目录下的 ./playground 试验场。
# 模式：
#   --setup  : 创建 playground/，git init，并可选执行 ai-tools init
#   --soft   : 仅删除 playground/.ai-tools-chain/ 和 .vscode/
#   --hard   : 在 --soft 基础上执行 git reset --hard && git clean -fdx（仅对 playground 仓库）
#   --nuke   : 清空 playground/（默认保留 .git；可加 --rm-git 删除 .git）
#   --reinit : 在 playground 中执行 ai-tools init -y（需要已 npm link 的 ai-tools）
# 额外：
#   --rm-git : 配合 --nuke 使用，连 .git 一起删
#   --force  : 跳过交互确认（仍然有路径护栏）

set -euo pipefail

# 计算仓库根目录（脚本所在目录的上一级）
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$REPO_DIR/playground"

MODE="soft"      # 默认 soft
DO_SETUP=false
DO_REINIT=false
REMOVE_GIT=false
FORCE=false

# 解析参数
for arg in "$@"; do
  case "$arg" in
    --setup) DO_SETUP=true ;;
    --soft) MODE="soft" ;;
    --hard) MODE="hard" ;;
    --nuke) MODE="nuke" ;;
    --reinit) DO_REINIT=true ;;
    --rm-git) REMOVE_GIT=true ;;
    --force) FORCE=true ;;
    *) echo "未知参数: $arg" >&2; exit 1 ;;
  esac
done

# 护栏：必须是仓库内的 playground 路径
if [[ "$(basename "$TARGET")" != "playground" ]]; then
  echo "安全拦截：目标不是仓库内的 playground 目录。" >&2
  exit 1
fi
if [[ "$TARGET" == "/" || "$TARGET" == "$HOME" || "$TARGET" == "$REPO_DIR" ]]; then
  echo "安全拦截：拒绝在 $TARGET 执行。" >&2
  exit 1
fi

echo "Repo   : $REPO_DIR"
echo "Target : $TARGET"
echo "Mode   : $MODE"

confirm() {
  local prompt="$1"
  if $FORCE; then return 0; fi
  read -r -p "$prompt (输入 YES 确认) > " ans
  [[ "$ans" == "YES" ]]
}

rm_if_exists() { [[ -e "$1" ]] && rm -rf "$1"; }

setup_playground() {
  mkdir -p "$TARGET"
  cd "$TARGET"
  if [[ ! -d .git ]]; then
    git init >/dev/null
    echo "# playground (local test only)" > README.md
    echo "已创建 playground 并 git init。"
  else
    echo "playground 已存在 .git。"
  fi
}

soft_clean() {
  cd "$TARGET"
  echo "[soft] 移除 .ai-tools-chain/ 与 .vscode/"
  rm_if_exists ".ai-tools-chain"
  rm_if_exists ".vscode"
  echo "[soft] 完成。"
}

hard_clean() {
  soft_clean
  cd "$TARGET"
  if [[ -d .git ]]; then
    echo "[hard] 将执行：git reset --hard && git clean -fdx（仅作用于 playground）"
    git status --porcelain || true
    confirm "[hard] 确认重置 playground 的 Git 工作区并删除未跟踪文件？" || { echo "取消。"; exit 1; }
    git reset --hard >/dev/null
    git clean -fdx >/dev/null
  else
    echo "[hard] 未检测到 .git，仅执行 soft 清理。"
  fi
  echo "[hard] 完成。"
}

nuke_clean() {
  cd "$TARGET/.."
  if $REMOVE_GIT; then
    echo "[nuke] 将删除 playground 中的所有内容（包含 .git）"
    confirm "[nuke] 确认删除 playground/ *全部内容*？此操作不可恢复。" || { echo "取消。"; exit 1; }
    rm -rf "playground"
    mkdir -p "playground"
  else
    echo "[nuke] 将删除 playground 中除 .git 以外的所有内容"
    confirm "[nuke] 确认删除 playground/ 中 .git 之外的所有内容？" || { echo "取消。"; exit 1; }
    find "playground" -mindepth 1 -maxdepth 1 ! -name ".git" -exec rm -rf {} +
  fi
  echo "[nuke] 完成。"
}

reinit_ai_tools() {
  cd "$TARGET"
  if command -v ai-tools >/dev/null 2>&1; then
    echo "[reinit] 运行 ai-tools init -y"
    ai-tools init -y || true
  else
    echo "[reinit] 未找到 ai-tools 命令（你是否已 npm link / 全局安装？）"
  fi
}

# 主流程
$DO_SETUP && setup_playground

case "$MODE" in
  soft) soft_clean ;;
  hard) hard_clean ;;
  nuke) nuke_clean ;;
  *) echo "未知模式: $MODE" >&2; exit 1 ;;
esac

$DO_REINIT && reinit_ai_tools

echo "✅ Done. ($MODE)"