# Docker 部署

本页记录 Sirius Pulse 在 Linux 服务器上的单容器 Docker 部署流程。主容器同时运行 WebUI、活跃人格和内部 Embedding 子进程；不需要单独启动 Embedding 容器。

## 运行结构

`docker-compose.yml` 只定义 `sirius-pulse` 服务，使用主机网络：

| 路径或端口 | 用途 |
|---|---|
| `./data:/app/data` | 人格、Provider、认证、记忆、日志和运行状态的持久化数据。 |
| `/root/.cache/huggingface:/home/sirius/.cache/huggingface` | Embedding 模型缓存，更新镜像时不重复下载。 |
| `8080` | WebUI。 |
| `127.0.0.1:18900` | 容器内 Embedding HTTP 服务，仅供主进程使用。 |

不要执行 `docker compose down -v`，它会删除 Docker 卷；日常更新使用下面的脚本即可。

## 前置条件

- 已安装 Docker Engine 和 Docker Compose 插件。
- 已安装 Git，服务器能够拉取项目仓库。
- 运行目录为 `/root/SiriusPulse`，其中包含 `docker-compose.yml`、`Dockerfile` 和 `scripts/update-container.sh`。
- 使用主机网络时，`8080` 与 `18900` 不能被其他非项目进程占用；NapCat 仍可通过宿主机地址访问。

## Hyper-V 磁盘扩容

先在 Hyper-V 中扩展虚拟磁盘，再在 Linux 客体内扩展分区、LVM 和文件系统。以下命令适用于已验证的 `/dev/sda3`、卷组 `cs_192`、根卷 `root` 和 XFS 根文件系统；名称不同必须先按检查结果调整，不能直接照抄。

```bash
lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINTS
pvs
vgs
lvs -o lv_name,vg_name,lv_size,lv_path
df -hT /
```

确认虚拟磁盘已变大、但第三分区和根卷尚未扩展后，执行：

```bash
sudo parted -s -f /dev/sda resizepart 3 100%
sudo partprobe /dev/sda
sudo pvresize /dev/sda3
sudo lvextend -l +100%FREE /dev/cs_192/root
sudo xfs_growfs /
df -hT /
```

`parted -f` 会修正扩容后仍位于旧磁盘末尾的 GPT 备用分区表。上述操作在线扩展根卷，不会格式化 `data` 或 `/home`。

## 首次迁移

首次改用 Compose 前，先确认现有容器内的数据才是最新状态。下面流程会保留宿主机旧数据备份，并把旧主容器的 `/app/data` 复制到新的持久化目录：

```bash
cd /root/SiriusPulse
docker stop -t 120 sirius-pulse-v2-test
mv data "data.pre-docker-$(date +%Y%m%dT%H%M%S)"
mkdir data
docker cp sirius-pulse-v2-test:/app/data/. ./data/
chown -R 10001:10001 data
docker compose up -d --build --force-recreate --remove-orphans
```

仅在旧容器确实存在且其数据比宿主机目录更新时执行迁移。迁移完成后保留 `data.pre-docker-*`，确认服务稳定和数据完整后再按自己的备份策略处理。

## 日常更新

服务器上只需执行一条命令：

```bash
cd /root/SiriusPulse
bash scripts/update-container.sh
```

脚本会快进拉取 `master`、更新 Git 子模块、构建镜像、强制重建主容器、清理已从 Compose 移除的孤立容器，并等待 WebUI 与内部 Embedding 健康。`data` 和 Hugging Face 模型缓存不会被删除。

## 健康检查

更新完成后应只看到一个 Sirius 容器：

```bash
cd /root/SiriusPulse
docker compose ps
curl -fsS http://127.0.0.1:8080/ >/dev/null
curl -fsS http://127.0.0.1:18900/health
docker logs --tail 100 sirius-pulse-v2-test
```

日志应包含 Embedding 服务就绪、人格已就绪和 `SKILL runtime 已挂载`。确认数据挂载时可检查：

```bash
docker inspect --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}' sirius-pulse-v2-test
```

## WebUI 认证与数据安全

WebUI 管理员用户名为 `admin`。首次启动会生成随机密码并只在首次启动日志中显示；之后 `data/auth_secret.json` 仅保存密码哈希与 JWT 密钥，无法从文件还原明文密码。

`data/` 还包含 Provider 密钥、人格配置和记忆数据。它已被 `.dockerignore` 排除，不能提交到 Git，也不应在排障时删除。遗失管理员密码时应通过受控的认证重置流程生成新密码，而不是修改或提交哈希文件。

## 常见问题

| 现象 | 处理方式 |
|---|---|
| 更新后仍有旧 Embedding 容器 | 使用 `bash scripts/update-container.sh`，脚本会执行 `--remove-orphans`。 |
| `18900` 被其他进程占用 | 用 `ss -ltnp | grep 18900` 确认来源，停止无关进程后重新运行更新脚本。 |
| WebUI 未响应 | 检查 `docker compose ps`、`docker logs --tail 100 sirius-pulse-v2-test`，再分别检查 `8080` 和 `18900`。 |
| 构建提示空间不足 | 先检查 `df -h /` 和 `docker system df`；若已扩展 Hyper-V 磁盘，按本页的 LVM 扩容流程扩展根文件系统。 |
