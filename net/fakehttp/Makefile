include $(TOPDIR)/rules.mk

PKG_NAME:=fakehttp
PKG_VERSION:=0.9.18_git20250627
PKG_RELEASE:=5

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL:=https://github.com/MikeWang000000/FakeHTTP.git
PKG_SOURCE_DATE:=2025-06-27
PKG_SOURCE_VERSION:=84c3b1529cf809cd8913fd767039f5e977928eb5
PKG_MIRROR_HASH:=skip

PKG_MAINTAINER:=FakeHTTP LuCI feed
PKG_LICENSE:=GPL-3.0-or-later
PKG_LICENSE_FILES:=LICENSE

include $(INCLUDE_DIR)/package.mk

define Package/fakehttp
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=Firewall
  TITLE:=Obfuscate TCP connections into HTTP with NFQUEUE
  URL:=https://github.com/MikeWang000000/FakeHTTP
  DEPENDS:=+libnetfilter-queue +libnfnetlink +libmnl +nftables +kmod-nfnetlink-queue +kmod-nft-queue
endef

define Package/fakehttp/description
FakeHTTP obfuscates TCP connections into HTTP-like traffic by handling
packets through Netfilter Queue.
endef

define Package/fakehttp/conffiles
/etc/config/fakehttp
endef

define Build/Compile
	$(MAKE) -C $(PKG_BUILD_DIR) \
		CC="$(TARGET_CC)" \
		STRIP="$(TARGET_CROSS)strip" \
		CFLAGS="$(TARGET_CFLAGS) $(TARGET_CPPFLAGS)" \
		LDFLAGS="$(TARGET_LDFLAGS)" \
		PREFIX="/usr" \
		VERSION="$(PKG_VERSION)"
endef

define Package/fakehttp/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/build/fakehttp $(1)/usr/bin/fakehttp
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/fakehttp $(1)/etc/config/fakehttp
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/fakehttp $(1)/etc/init.d/fakehttp
	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_BIN) ./files/usr/libexec/fakehttp-scheduled-restart $(1)/usr/libexec/fakehttp-scheduled-restart
	$(INSTALL_BIN) ./files/usr/libexec/fakehttp-logread $(1)/usr/libexec/fakehttp-logread
	$(INSTALL_DIR) $(1)/usr/share/fakehttp
	$(INSTALL_DATA) ./files/usr/share/fakehttp/functions.sh $(1)/usr/share/fakehttp/functions.sh
endef

define Package/fakehttp/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || {
	migrate_fakehttp_config() {
		local payload_section log_file

		[ -f /etc/config/fakehttp ] || {
			[ -f /etc/config/fakehttp-opkg ] && mv /etc/config/fakehttp-opkg /etc/config/fakehttp
		}

		uci -q get fakehttp.main >/dev/null || uci -q set fakehttp.main=fakehttp

		[ -n "$$(uci -q get fakehttp.main.enabled)" ] || uci -q set fakehttp.main.enabled='0'
		[ -n "$$(uci -q get fakehttp.main.interface_mode)" ] || uci -q set fakehttp.main.interface_mode='custom'
		[ -n "$$(uci -q get fakehttp.main.interfaces)" ] || uci -q add_list fakehttp.main.interfaces='wan'

		uci -q delete fakehttp.main.payload_mode
		uci -q delete fakehttp.main.hostname
		uci -q delete fakehttp.main.payload_file

		payload_section="$$(uci -q show fakehttp | sed -n 's/^fakehttp\.\([^=]*\)=payload$$/\1/p' | head -n 1)"
		[ -n "$$payload_section" ] || {
			payload_section="$$(uci -q add fakehttp payload)"
			uci -q set fakehttp.$$payload_section.type='http'
			uci -q set fakehttp.$$payload_section.value='www.speedtest.cn'
		}

		[ -n "$$(uci -q get fakehttp.main.direction)" ] || uci -q set fakehttp.main.direction='both'
		[ -n "$$(uci -q get fakehttp.main.ip_family)" ] || uci -q set fakehttp.main.ip_family='both'
		[ -n "$$(uci -q get fakehttp.main.queue_num)" ] || uci -q set fakehttp.main.queue_num='100'
		[ -n "$$(uci -q get fakehttp.main.fwmark)" ] || uci -q set fakehttp.main.fwmark='0x8000'
		[ -n "$$(uci -q get fakehttp.main.fwmask)" ] || uci -q set fakehttp.main.fwmask=''
		[ -n "$$(uci -q get fakehttp.main.repeat)" ] || uci -q set fakehttp.main.repeat='2'
		[ -n "$$(uci -q get fakehttp.main.ttl)" ] || uci -q set fakehttp.main.ttl='3'
		[ -n "$$(uci -q get fakehttp.main.dynamic_pct)" ] || uci -q set fakehttp.main.dynamic_pct=''
		[ -n "$$(uci -q get fakehttp.main.disable_hop_estimation)" ] || uci -q set fakehttp.main.disable_hop_estimation='0'
		[ -n "$$(uci -q get fakehttp.main.skip_firewall)" ] || uci -q set fakehttp.main.skip_firewall='0'
		[ -n "$$(uci -q get fakehttp.main.use_iptables)" ] || uci -q set fakehttp.main.use_iptables='0'
		[ -n "$$(uci -q get fakehttp.main.silent)" ] || uci -q set fakehttp.main.silent='0'

		log_file="$$(uci -q get fakehttp.main.log_file)"
		case "$$log_file" in
			''|'/var/log/fakehttp.log')
				uci -q set fakehttp.main.log_file='/var/log/fakehttp/fakehttp.log'
				;;
		esac
		[ -n "$$(uci -q get fakehttp.main.log_max_size_kb)" ] || uci -q set fakehttp.main.log_max_size_kb='512'
		[ -n "$$(uci -q get fakehttp.main.log_rotate_count)" ] || uci -q set fakehttp.main.log_rotate_count='3'

		[ -n "$$(uci -q get fakehttp.main.scheduled_restart)" ] || uci -q set fakehttp.main.scheduled_restart='0'
		[ -n "$$(uci -q get fakehttp.main.restart_mode)" ] || uci -q set fakehttp.main.restart_mode='daily'
		[ -n "$$(uci -q get fakehttp.main.restart_time)" ] || uci -q set fakehttp.main.restart_time='04:00'
		[ -n "$$(uci -q get fakehttp.main.restart_weekday)" ] || uci -q set fakehttp.main.restart_weekday='0'
		[ -n "$$(uci -q get fakehttp.main.restart_interval_hours)" ] || uci -q set fakehttp.main.restart_interval_hours='24'

		uci -q commit fakehttp
		rm -f /etc/config/fakehttp-opkg
	}

	migrate_fakehttp_config
	/etc/init.d/fakehttp enable >/dev/null 2>&1 || true
	/etc/init.d/fakehttp update_cron >/dev/null 2>&1 || true
}
exit 0
endef

define Package/fakehttp/prerm
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || {
	/etc/init.d/fakehttp stop_now >/dev/null 2>&1 || true
	/etc/init.d/fakehttp clear_cron >/dev/null 2>&1 || true
	/etc/init.d/fakehttp disable >/dev/null 2>&1 || true
}
exit 0
endef

$(eval $(call BuildPackage,fakehttp))
