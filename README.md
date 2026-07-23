# luci-app-fakehttp

用于 OpenWrt/ImmortalWrt 的 FakeHTTP 软件包与 LuCI 管理界面。

本仓库提供一个完整 feed，包含：

- `fakehttp`：基于 [killadm/FakeHTTP](https://github.com/killadm/FakeHTTP) 的构建包。
- `luci-app-fakehttp`：中文 LuCI 管理界面。
- procd 服务脚本、UCI 默认配置、定时重启任务和 GitHub Actions 自动构建。

## 功能

- 支持 HTTP Host、HTTPS SNI、自定义二进制 payload 三种混淆载荷，可配置多条并轮换使用。
- 支持指定接口或全部接口。
- 支持入站、出站、双向处理。
- 支持 IPv4、IPv6、双栈模式。
- 支持 IP/CIDR 与端口范围黑白名单过滤规则。
- 默认使用 nftables，适配 OpenWrt/ImmortalWrt 24.10 的 firewall4。
- 提供 iptables 兼容模式。
- 支持 NFQUEUE 编号、fwmark、TTL、重复包、跳数估计等高级参数。
- 支持每天、每周、按小时间隔定时重启。
- 支持 FakeHTTP 内置异步文件日志线程与按大小自动轮转，LuCI 只读取最近日志片段，避免大日志拖慢页面。
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
- `libpthread`
- `nftables`
- `kmod-nfnetlink-queue`
- `kmod-nft-queue`

安装后进入：

```text
LuCI -> 服务 -> FakeHTTP
```

默认服务不会立即运行，确认接口与负载选项后手动启用。

## 配置说明

默认配置文件：

```text
/etc/config/fakehttp
```

常用字段：

- `enabled`：是否启用服务。
- `interface_mode`：`custom` 指定接口，`all` 全部接口。
- `interfaces`：指定接口列表，默认 `wan`。
- `log_file`：FakeHTTP 文件日志，必须是 `/var/log`、`/mnt` 或 `/opt` 下的绝对文件路径，不能包含 `..` 或指向符号链接，默认 `/var/log/fakehttp/fakehttp.log`；留空时不传递 `-w`，日志输出到 stderr。
- `log_max_size`：对应 `--log-max-size`，支持纯数字字节数或 `K`、`M`、`G` 后缀，默认 `1M`；设置为 `0` 表示关闭内置轮转。
- `log_rotate_count`：对应 `--log-rotate`，保留的轮转日志份数，默认 `3`；设置为 `0` 表示超过大小后不保留历史日志。
- `silent`：静默模式，默认开启；关闭会逐包输出日志，除排查问题时外，日常使用建议开启。
- `skip_firewall`：跳过自动维护防火墙规则；慎选，除非必须自己维护外部防火墙规则。
- `use_iptables`：使用 iptables 兼容模式；慎选，建议优先使用 nftables。
- `direction`：`both`、`inbound`、`outbound`。
- `ip_family`：`both`、`ipv4`、`ipv6`。
- `queue_num`：NFQUEUE 编号，默认 `100`。
- `scheduled_restart`：是否启用定时重启。
- `restart_mode`：`daily`、`weekly`、`interval`。

负载选项使用独立的 `config payload` 段：

```text
config payload
	option type 'http'
	option value 'www.speedtest.cn'
```

`type` 与 FakeHTTP 参数对应关系：

- `http`：对应 `-h <hostname>`，生成 HTTP GET payload，Host 为指定主机名。
- `https`：对应 `-e <hostname>`，生成 HTTPS Client Hello payload，SNI 为指定主机名。
- `custom`：对应 `-b <file>`，使用指定二进制文件作为 TCP payload，文件路径必须是绝对路径。

可以配置多条负载，服务启动时会按配置顺序传给 FakeHTTP：

```text
config payload
	option type 'http'
	option value 'www01.example.com'

config payload
	option type 'https'
	option value 'tls01.example.com'

config payload
	option type 'custom'
	option value '/root/payload01.bin'
```

FakeHTTP 会轮换使用这些 payload。重复项会原样保留，可通过重复添加同一主机名或文件调整出现比例。

过滤规则使用独立的 `config filter` 节：

```text
config filter
	option action 'allow'
	option type 'ip'
	option value '1.2.3.0/24'

config filter
	option action 'deny'
	option type 'port'
	option value '12345'
```

- `action`：`allow` 为白名单规则，`deny` 为黑名单规则。
- `type`：`ip` 支持 IPv4、IPv6 和 CIDR；`port` 支持单端口或 `5000-6000` 范围。
- `value`：匹配源或目标 IP/端口；黑名单优先于白名单。
- 过滤规则不会阻断真实流量，只限制哪些连接生成 FakeHTTP 混淆包。

黑白名单匹配顺序：

- 只有黑名单：默认都处理，命中 `deny` 的不处理。
- 只有 IP 白名单：只处理源 IP 或目的 IP 命中的流量。
- 只有端口白名单：只处理源端口或目的端口命中的流量。
- 同时有 IP 白名单和端口白名单：必须 IP 命中且端口命中才处理。
- 同时命中 `allow` 和 `deny`：按 `deny` 处理，不生成 FakeHTTP 混淆包。

服务管理：

```sh
/etc/init.d/fakehttp start
/etc/init.d/fakehttp stop
/etc/init.d/fakehttp restart
/etc/init.d/fakehttp update_cron
/etc/init.d/fakehttp cleanup_rules
```

## 日志写入与轮转

配置 `log_file` 后，init 脚本会向 FakeHTTP 传递 `-w <file>`，FakeHTTP 会启用异步文件日志线程。主处理线程只负责格式化日志并写入队列，实际文件写入、flush、大小检查和轮转由日志线程完成。

默认单个日志文件达到 `1M` 后轮转，保留 `3` 份历史日志。轮转文件名格式为 `<logpath>.YYYYmmdd-HHMMSS`，同一秒内多次轮转时会追加数字后缀。`log_max_size=0` 会关闭内置轮转，`log_rotate_count=0` 表示超过大小后不保留历史日志。

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

## 许可证

本仓库的软件包与 LuCI 集成遵循 GPL-3.0-or-later。

FakeHTTP 上游项目遵循 GPL-3.0-or-later，见：

https://github.com/killadm/FakeHTTP
