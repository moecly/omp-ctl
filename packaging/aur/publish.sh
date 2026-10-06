#!/usr/bin/env bash
# 把一个或多个 PKGBUILD 发布到 AUR：按 tag 写入 pkgver/pkgrel/sha256sums，生成 .SRCINFO 后提交推送，
# 成功后把解析结果写回仓库里的 PKGBUILD，使仓库始终等于已发布状态。
# 用法：publish.sh <tag> [pkgrel] [包名...]（包名是本目录下含 PKGBUILD 的子目录，默认全部）
# 环境变量：AUR_KEY_FILE（默认 ~/.ssh/aur）、AUR_REPO_BASE（默认 ssh://aur@aur.archlinux.org）、
#           AUR_REPO（整包 URL 覆盖，测试用）
# 例：publish.sh v0.6.0              # 全部包，pkgrel=1
#     publish.sh v0.6.0 2 omp-ctl    # 只发 omp-ctl，pkgrel=2
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# makepkg 拒绝以 root 运行（生成 .SRCINFO 同样被拦）
if [ "$(id -u)" = 0 ]; then
    echo "publish.sh 不能以 root 运行：makepkg 会拒绝执行" >&2
    exit 1
fi

for cmd in git makepkg curl sha256sum ssh-keygen; do
    command -v "$cmd" >/dev/null || { echo "缺少命令: $cmd" >&2; exit 1; }
done

# 单个包的发布流程。由 main 以子进程方式调用：函数若在 `||` 里被调用，errexit 会被禁用，
# 中途失败就不再中断，所以每个包必须跑在自己的 bash 进程里。
publish_one() {
    local pkg=$1 tag=$2 pkgrel=$3
    local version=${tag#v}
    local src_dir="$script_dir/$pkg"
    local repo_url=${AUR_REPO:-${AUR_REPO_BASE:-ssh://aur@aur.archlinux.org}/$pkg.git}
    local key_file=${AUR_KEY_FILE:-$HOME/.ssh/aur}

    [ -f "$src_dir/PKGBUILD" ] || { echo "缺少 $src_dir/PKGBUILD" >&2; return 1; }

    # 密钥预检：密钥本身有问题时远端只回一句 Permission denied，这里提前给出确切原因
    if [ -f "$key_file" ]; then
        local pub
        pub=$(ssh-keygen -y -f "$key_file" -P '' 2>&1) || {
            echo "AUR 私钥无法使用：$key_file" >&2
            printf '%s\n' "$pub" | sed 's/^/  /' >&2
            echo "  常见原因：放的是 .pub 公钥、私钥带口令（CI 无法交互输入）、内容被截断" >&2
            return 1
        }
        echo "AUR 私钥 $key_file 指纹：$(printf '%s\n' "$pub" | ssh-keygen -lf - 2>/dev/null)"
    elif [ -n "${AUR_KEY_FILE:-}" ]; then
        echo "AUR_KEY_FILE=$key_file 不存在" >&2
        return 1
    fi

    # 身份必须在任何远端操作之前定下来：fetch 也要用它。否则本地默认身份
    # （~/.ssh/id_*）与 ~/.ssh/aur 不同时，fetch 会失败得莫名其妙，
    # 症状是 push 阶段才以「非快进」的形式暴露。CI 已在环境里设好，保持原样。
    if [ -z "${GIT_SSH_COMMAND:-}" ]; then
        if [ -f "$key_file" ]; then
            export GIT_SSH_COMMAND="ssh -i $key_file -o IdentitiesOnly=yes"
        else
            echo "未找到 $key_file，改用 ssh 默认身份（agent / ssh_config）" >&2
        fi
    fi

    local workdir
    workdir=$(mktemp -d)
    # 用字面量拼进 trap：EXIT 触发时函数的 local 变量已经失效，再引用会命中 set -u
    trap "rm -rf '$workdir'" EXIT
    cd "$workdir"

    # 不用 clone：空仓库的 clone 会留下没有工作区的仓库，远端 HEAD 也可能不在 master。
    # init + fetch + reset 对有/无 AUR 仓库都一样，且首次 push 会自动创建该包。
    git init --quiet -b master aur
    cd aur
    git remote add origin "$repo_url"
    local fetch_err
    if fetch_err=$(git fetch --quiet origin master 2>&1); then
        git reset --quiet origin/master   # 以远端为准：保留他人文件，后续 diff 也对比它
    elif printf '%s' "$fetch_err" | grep -qE 'Permission denied|publickey'; then
        printf '%s\n' "$fetch_err" | sed 's/^/  /' >&2
        echo "拉取 $repo_url 失败：远端拒绝了这次认证（见上面的原始报错）" >&2
        return 1
    else
        # AUR 上还没有这个包时就是「无法找到远程引用 master」/ remote end hung up，属新建场景
        echo "AUR 上尚无 $pkg 仓库，将新建（${fetch_err%%$'\n'*}）"
    fi

    cp "$src_dir/PKGBUILD" PKGBUILD

    # source[0] 就是要发布的产物：源码包是 tag tarball，-bin 是 release 资产（.deb）。
    # 在子 shell 里 source PKGBUILD，让 URL 里的 $pkgver 按 makepkg 的规则展开；
    # `文件名::URL` 形式要把前缀去掉。
    local src_url
    src_url=$(bash -c 'source ./PKGBUILD >/dev/null 2>&1; printf %s "${source[0]}"') || true
    src_url=${src_url##*::}
    case $src_url in
        http*://*) ;;
        *) echo "PKGBUILD 的 source[0] 不是 HTTP(S) URL：${src_url:-（空）}" >&2; return 1 ;;
    esac

    local sum
    sum=$(curl -fsSL "$src_url" | sha256sum | cut -d' ' -f1) || { echo "下载 $src_url 失败" >&2; return 1; }

    sed -i -e "s/^pkgver=.*/pkgver=$version/" -e "s/^pkgrel=.*/pkgrel=$pkgrel/" PKGBUILD
    grep -q '^sha256sums=' PKGBUILD || { echo "PKGBUILD 没有 sha256sums 行" >&2; return 1; }
    sed -i "s/^sha256sums=.*/sha256sums=('$sum')/" PKGBUILD

    makepkg --printsrcinfo > .SRCINFO
    grep -qE "^[[:space:]]*pkgver = $version\$" .SRCINFO || { echo ".SRCINFO 校验失败" >&2; return 1; }

    git add PKGBUILD .SRCINFO
    if git diff --cached --quiet; then
        echo "AUR 已是 $version-$pkgrel，无需推送"
    else
        git -c user.name="${AUR_GIT_NAME:-omp-ctl}" \
            -c user.email="${AUR_GIT_EMAIL:-omp-ctl@users.noreply.github.com}" \
            commit --quiet -m "upgpkg: $version-$pkgrel"

        if ! push_err=$(git push --quiet origin HEAD:master 2>&1); then
            printf '%s\n' "$push_err" >&2
            echo "推送 $repo_url 失败" >&2
            if printf '%s' "$push_err" | grep -q 'Permission denied'; then
                echo "连接与主机密钥都正常，AUR 在认证阶段拒绝了该密钥：" >&2
                echo "  1. 账户已注册且邮箱已确认：https://aur.archlinux.org/register/" >&2
                echo "  2. My Account → SSH Public Key 登记的公钥与本机私钥配对" >&2
                echo "     （与本次运行开始时打印的指纹核对）" >&2
                echo "  3. secret AUR_SSH_KEY 存的是私钥全文（含 BEGIN/END 行），不是 .pub" >&2
            fi
            return 1
        fi
        echo "已发布 $pkg $version-$pkgrel 到 AUR"
    fi

    # 写回仓库：仓库里的 PKGBUILD 始终等于已发布状态，本地 makepkg 不会因此打到旧版本。
    # CI 里工作区归 root、脚本以 builder 运行，写不进去是正常的（推送已经成功，不必报错）。
    if [ -w "$src_dir/PKGBUILD" ]; then
        cp PKGBUILD "$src_dir/PKGBUILD"
    else
        echo "跳过写回仓库：$src_dir/PKGBUILD 不可写" >&2
    fi
}

if [ "${1:-}" = --publish-one ]; then
    publish_one "${2:?缺少包名}" "${3:?缺少 tag}" "${4:?缺少 pkgrel}"
    exit 0
fi

tag=${1:-}
if [ -z "$tag" ]; then
    echo "用法: publish.sh <tag> [pkgrel] [包名...]" >&2
    echo "  包名取 $script_dir 下的子目录，默认全部" >&2
    exit 2
fi
pkgrel=${2:-1}
if [ $# -gt 1 ]; then shift 2; else shift; fi
pkgs=("$@")
if [ ${#pkgs[@]} -eq 0 ]; then
    mapfile -t pkgs < <(cd "$script_dir" && printf '%s\n' */PKGBUILD | sed 's|/PKGBUILD||')
fi

failed=()
for pkg in "${pkgs[@]}"; do
    echo "===== $pkg ====="
    if bash "$0" --publish-one "$pkg" "$tag" "$pkgrel"; then
        echo "===== $pkg 完成 ====="
    else
        echo "===== $pkg 失败（继续处理其余包）=====" >&2
        failed+=("$pkg")
    fi
done

if [ ${#failed[@]} -gt 0 ]; then
    echo "发布失败：${failed[*]}" >&2
    exit 1
fi
echo "已处理：${pkgs[*]}"
