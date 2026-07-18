# luci-app-fakehttp

用于 OpenWrt/ImmortalWrt 的 FakeHTTP 软件包与 LuCI 管理界面。

本仓库提供一个完整 feed，包含：

- `fakehttp`：从上游 [MikeWang000000/FakeHTTP](https://github.com/MikeWang000000/FakeHTTP) 构建二进制程序。
- `luci-app-fakehttp`：中文 LuCI 管理界面。
- procd 服务脚本、UCI 默认配置、定时重启任务和 GitHub Actions 自动构建。

## 功能

- 支持 HTTP Host、HTTPS SNI、自定义二进制 payload 三种混淆载荷。
- 支持指定接口或全部接口。
- 支持入站、出站、双向处理。
- 支持 IPv4、IPv6、双栈模式。
- 默认使用 nftables，适配 OpenWrt/ImmortalWrt 24.10 的 firewall4。
- 提供 iptables 兼容模式。
- 支持 NFQUEUE 编号、fwmark、TTL、重复包、跳数估计等高级参数。
- 支持每天、每周、按小时间隔定时重启。
- LuCI 页面提供状态查看、启动、停止、重启、更新定时任务、清理残留规则和最近日志查看。

## 目标环境

主要面向：

- ImmortalWrt 24.10
- mt798x / `mediatek/filogic`
- firewall4 / nftables

包本身没有写死架构，其他 OpenWrt/ImmortalWrt 目标也可以用对应 SDK 自行构建。

## 自动构建 IPK

仓库内置 GitHub Actions：

- workflow 文件：`.github/workflows/build-ipk.yml`
- 触发方式：push、pull request、手动运行
- 默认 SDK：ImmortalWrt `24.10.6` `mediatek/filogic`

构建完成后，在 GitHub Actions 的 Artifacts 中下载：

- `fakehttp_*.ipk`
- `luci-app-fakehttp_*.ipk`
- `sha256sums.txt`

Artifact 名称类似：

```text
fakehttp-ipk-immortalwrt-24.10.6-mediatek-filogic
```

## 手动作为 feed 构建

在 ImmortalWrt SDK 或源码树中添加本仓库：

```sh
echo "src-git fakehttp https://github.com/<your-name>/luci-app-fakehttp.git" >> feeds.conf.default
./scripts/feeds update fakehttp
./scripts/feeds install fakehttp luci-app-fakehttp
```

选择包：

```text
Network -> Firewall -> fakehttp
LuCI -> Applications -> luci-app-fakehttp
```

或直接写入 `.config`：

```sh
cat >> .config <<'EOF'
CONFIG_PACKAGE_fakehttp=m
CONFIG_PACKAGE_luci-app-fakehttp=m
EOF
make defconfig
```

编译：

```sh
make package/fakehttp/compile V=s
make package/luci-app-fakehttp/compile V=s
```

生成的 IPK 通常位于：

```text
bin/packages/<arch>/fakehttp/
```

## 安装

把 GitHub Actions 或本地 SDK 生成的 IPK 上传到路由器：

```sh
opkg install fakehttp_*.ipk luci-app-fakehttp_*.ipk
```

如果依赖未安装，请先确保系统软件源可用，或在固件中预集成依赖：

- `libnetfilter-queue`
- `libnfnetlink`
- `libmnl`
- `nftables`
- `kmod-nfnetlink-queue`
- `kmod-nft-queue`

安装后进入：

```text
LuCI -> 服务 -> FakeHTTP
```

默认服务不会立即运行，需要填写主机名和接口后手动启用。

## 配置说明

默认配置文件：

```text
/etc/config/fakehttp
```

常用字段：

- `enabled`：是否启用服务。
- `interface_mode`：`custom` 指定接口，`all` 全部接口。
- `interfaces`：指定接口列表，默认 `wan`。
- `payload_mode`：`http`、`https`、`custom`。
- `hostname`：HTTP/HTTPS 混淆主机名，默认 `www.speedtest.cn`。
- `log_file`：FakeHTTP 文件日志，默认 `/var/log/fakehttp/fakehttp.log`。
- `payload_file`：自定义 payload 文件路径。
- `direction`：`both`、`inbound`、`outbound`。
- `ip_family`：`both`、`ipv4`、`ipv6`。
- `queue_num`：NFQUEUE 编号，默认 `100`。
- `scheduled_restart`：是否启用定时重启。
- `restart_mode`：`daily`、`weekly`、`interval`。

服务管理：

```sh
/etc/init.d/fakehttp start
/etc/init.d/fakehttp stop
/etc/init.d/fakehttp restart
/etc/init.d/fakehttp update_cron
/etc/init.d/fakehttp cleanup_rules
```

## 定时重启

定时重启使用 OpenWrt 默认 cron 机制，任务写入：

```text
/etc/crontabs/root
```

支持三种模式：

- `daily`：每天固定时间重启。
- `weekly`：每周指定星期和时间重启。
- `interval`：按小时数间隔重启，范围 `1-168`。

关闭服务或关闭定时重启后，会自动清理 FakeHTTP 的 cron 任务块。

## 注意事项

- FakeHTTP 使用 NFQUEUE，需要内核模块支持。
- 默认使用 nftables；只有在兼容需求明确时才建议开启 iptables 模式。
- 如果修改了 NFQUEUE 编号、fwmark 或防火墙相关设置，建议重启服务后检查规则是否生效。
- `cleanup_rules` 只清理 FakeHTTP 自己创建的 nftables/iptables 规则。
- 升级安装时如果看到 `resolve_conffiles` 提示，表示 opkg 发现本机已有 `/etc/config/fakehttp`，因此保护用户配置。安装脚本会保留现有配置、补齐缺失默认项，并清理 `/etc/config/fakehttp-opkg`。

## 许可证

本仓库的软件包与 LuCI 集成遵循 GPL-3.0-or-later。

FakeHTTP 上游项目遵循 GPL-3.0-or-later，见：

https://github.com/MikeWang000000/FakeHTTP
