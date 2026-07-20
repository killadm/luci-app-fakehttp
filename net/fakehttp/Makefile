include $(TOPDIR)/rules.mk

PKG_NAME:=fakehttp
PKG_VERSION:=0.9.18_git20250627
PKG_RELEASE:=8

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
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/etc/uci-defaults/90-fakehttp-migrate $(1)/etc/uci-defaults/90-fakehttp-migrate
	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_BIN) ./files/usr/libexec/fakehttp-scheduled-restart $(1)/usr/libexec/fakehttp-scheduled-restart
	$(INSTALL_BIN) ./files/usr/libexec/fakehttp-logread $(1)/usr/libexec/fakehttp-logread
	$(INSTALL_DIR) $(1)/usr/share/fakehttp
	$(INSTALL_DATA) ./files/usr/share/fakehttp/functions.sh $(1)/usr/share/fakehttp/functions.sh
endef

define Package/fakehttp/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || {
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

define Package/fakehttp/postrm
#!/bin/sh
rm -rf /var/log/fakehttp /var/run/fakehttp 2>/dev/null || true
exit 0
endef

$(eval $(call BuildPackage,fakehttp))
