#!/usr/bin/env bash
# 把本目录的 PKGBUILD 发布到 AUR：写入 pkgver/pkgrel/sha256sums，生成 .SRCINFO 后提交推送。
# 用法：publish.sh <tag> [pkgrel]（例如 publish.sh v0.5.2，同版本重打包用 publish.sh v0.5.2 2）
# 环境变量：AUR_REPO（默认 ssh://aur@aur.archlinux.org/omp-ctl.git）、AUR_KEY_FILE（默认 ~/.ssh/aur）
set -euo pipefail

tag=${1:?用法: publish.sh <tag> [pkgrel]}
pkgrel=${2:-1}
version=${tag#v}
src_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo_url=${AUR_REPO:-ssh://aur@aur.archlinux.org/omp-ctl.git}
key_file=${AUR_KEY_FILE:-$HOME/.ssh/aur}

# makepkg 拒绝以 root 运行（生成 .SRCINFO 同样被拦）
if [ "$(id -u)" = 0 ]; then
    echo "publish.sh 不能以 root 运行：makepkg 会拒绝执行" >&2
    exit 1
fi

for cmd in git makepkg curl sha256sum; do
    command -v "$cmd" >/dev/null || { echo "缺少命令: $cmd" >&2; exit 1; }
done

workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT
cd "$workdir"

# 不用 clone：空仓库的 clone 会留下没有工作区的仓库，远端 HEAD 也可能不在 master。
# init + fetch + reset 对有/无 AUR 仓库都一样，且首次 push 会自动创建该包。
git init --quiet -b master aur
cd aur
git remote add origin "$repo_url"
if git fetch --quiet origin master 2>/dev/null; then
    git reset --quiet origin/master   # 以远端为准：保留他人文件，后续 diff 也对比它
fi

cp "$src_dir/PKGBUILD" PKGBUILD
url=$(sed -n 's/^url=//p' PKGBUILD | tr -d "'\"")
sum=$(curl -sL "$url/archive/refs/tags/v$version.tar.gz" | sha256sum | cut -d' ' -f1)

sed -i -e "s/^pkgver=.*/pkgver=$version/" -e "s/^pkgrel=.*/pkgrel=$pkgrel/" PKGBUILD
grep -q '^sha256sums=' PKGBUILD || { echo "PKGBUILD 没有 sha256sums 行" >&2; exit 1; }
sed -i "s/^sha256sums=.*/sha256sums=('$sum')/" PKGBUILD

makepkg --printsrcinfo > .SRCINFO
grep -qE "^[[:space:]]*pkgver = $version\$" .SRCINFO || { echo ".SRCINFO 校验失败" >&2; exit 1; }

git add PKGBUILD .SRCINFO
if git diff --cached --quiet; then
    echo "AUR 已是 $version-$pkgrel，无需推送"
    exit 0
fi

git -c user.name="${AUR_GIT_NAME:-omp-ctl}" \
    -c user.email="${AUR_GIT_EMAIL:-omp-ctl@users.noreply.github.com}" \
    commit --quiet -m "upgpkg: $version-$pkgrel"
export GIT_SSH_COMMAND=${GIT_SSH_COMMAND:-"ssh -i $key_file -o IdentitiesOnly=yes"}
git push --quiet origin HEAD:master
echo "已发布 omp-ctl $version-$pkgrel 到 AUR"
