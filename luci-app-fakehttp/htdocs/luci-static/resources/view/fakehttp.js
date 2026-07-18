'use strict';
'require view';
'require form';
'require fs';
'require rpc';
'require uci';
'require ui';
'require tools.widgets as widgets';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} }
});

var CRON_BEGIN = '# BEGIN fakehttp scheduled restart';

function escapeHTML(value) {
	return String(value == null ? '' : value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function getServiceStatus(data) {
	var service = data && data.fakehttp;
	var instances = service && service.instances ? service.instances : {};
	var names = Object.keys(instances);
	var pids = [];
	var running = false;

	for (var i = 0; i < names.length; i++) {
		var inst = instances[names[i]];
		if (inst && inst.running) {
			running = true;
			if (inst.pid)
				pids.push(inst.pid);
		}
	}

	return {
		running: running,
		pids: pids
	};
}

function getWeekdayText(value) {
	return ({
		'0': '周日',
		'1': '周一',
		'2': '周二',
		'3': '周三',
		'4': '周四',
		'5': '周五',
		'6': '周六'
	})[value] || '周日';
}

function getScheduleText(crontab) {
	var enabled = uci.get('fakehttp', 'main', 'scheduled_restart') === '1';
	var serviceEnabled = uci.get('fakehttp', 'main', 'enabled') === '1';
	var mode = uci.get('fakehttp', 'main', 'restart_mode') || 'daily';
	var time = uci.get('fakehttp', 'main', 'restart_time') || '04:00';
	var weekday = uci.get('fakehttp', 'main', 'restart_weekday') || '0';
	var interval = uci.get('fakehttp', 'main', 'restart_interval_hours') || '24';
	var active = crontab && crontab.indexOf(CRON_BEGIN) >= 0;
	var text;

	if (!enabled)
		return '未启用';

	if (!serviceEnabled)
		return '服务未启用，计划任务不会生效';

	if (mode === 'weekly')
		text = '每' + getWeekdayText(weekday) + ' ' + time;
	else if (mode === 'interval')
		text = '每 ' + interval + ' 小时';
	else
		text = '每天 ' + time;

	return text + (active ? '（已写入 cron）' : '（等待保存并应用）');
}

function renderRuntimeStatus(services, crontab) {
	var status = getServiceStatus(services);
	var queue = uci.get('fakehttp', 'main', 'queue_num') || '100';
	var ifaceMode = uci.get('fakehttp', 'main', 'interface_mode') || 'custom';
	var ifaces = uci.get('fakehttp', 'main', 'interfaces') || [];
	var ifaceText = ifaceMode === 'all' ? '全部接口' : (Array.isArray(ifaces) ? ifaces.join(', ') : ifaces);
	var label = status.running ? '运行中' : '已停止';
	var labelClass = status.running ? 'label success' : 'label';
	var pidText = status.pids.length ? 'PID：' + status.pids.join(', ') : 'PID：-';

	return '' +
		'<div class="cbi-value-field">' +
			'<span class="' + labelClass + '">' + label + '</span>' +
			'<span style="margin-left:1em">' + escapeHTML(pidText) + '</span>' +
			'<span style="margin-left:1em">队列：' + escapeHTML(queue) + '</span>' +
			'<span style="margin-left:1em">接口：' + escapeHTML(ifaceText || '-') + '</span>' +
			'<div style="margin-top:.5em">定时重启：' + escapeHTML(getScheduleText(crontab)) + '</div>' +
		'</div>';
}

function tailText(text, count) {
	var lines = String(text || '').trim().split(/\r?\n/);
	if (lines.length > count)
		lines = lines.slice(lines.length - count);
	return lines.join('\n') || '暂无 FakeHTTP 日志';
}

function renderLogBlock(title, text, count) {
	return '<h3>' + escapeHTML(title) + '</h3>' +
		'<pre style="max-height:32em;overflow:auto;white-space:pre-wrap">' +
			escapeHTML(tailText(text, count)) +
		'</pre>';
}

function validateRange(min, max, message, allowEmpty) {
	return function(sectionId, value) {
		var n;

		if ((value == null || value === '') && allowEmpty)
			return true;

		if (!/^[0-9]+$/.test(value || ''))
			return message;

		n = Number(value);
		if (n < min || n > max)
			return message;

		return true;
	};
}

function validateTime(sectionId, value) {
	if (/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value || ''))
		return true;

	return '请输入 24 小时制时间，例如 04:00';
}

function validateMark(sectionId, value) {
	var n;

	if (value == null || value === '')
		return true;

	if (!/^(0x[0-9a-fA-F]+|[1-9][0-9]*)$/.test(value))
		return '请输入非零十进制数或十六进制数，例如 0x8000';

	n = Number(value);
	if (!Number.isFinite(n) || n < 1 || n > 0xffffffff)
		return '标记值范围为 1 到 4294967295';

	return true;
}

function runInitAction(action, successText) {
	return fs.exec('/etc/init.d/fakehttp', [ action ]).then(function(res) {
		if (res.code !== 0) {
			ui.addNotification('操作失败', E('pre', { 'style': 'white-space:pre-wrap' },
				(res.stderr || res.stdout || '命令执行失败').trim()), 'danger');
			return;
		}

		ui.addNotification(null, E('p', successText), 'info');

		return new Promise(function(resolve) {
			window.setTimeout(function() {
				window.location.reload();
				resolve();
			}, 900);
		});
	});
}

function saveApplyAndRun(map, action, successText) {
	return map.save(null, false)
		.then(function() {
			return uci.apply(10);
		})
		.then(function() {
			return runInitAction(action, successText);
		});
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('fakehttp'),
			L.resolveDefault(callServiceList('fakehttp'), {}),
			L.resolveDefault(fs.read('/etc/crontabs/root'), ''),
			L.resolveDefault(fs.exec('/sbin/logread', [ '-e', 'fakehttp' ]), { stdout: '' }),
			L.resolveDefault(fs.read('/var/log/fakehttp.log'), '')
		]);
	},

	render: function(data) {
		var services = data[1];
		var crontab = data[2] || '';
		var logOutput = data[3] && data[3].stdout ? data[3].stdout : '';
		var fileLog = data[4] || '';
		var m, s, o, enabledOpt, ifaceModeOpt, payloadModeOpt, noHop;

		m = new form.Map('fakehttp', 'FakeHTTP');

		s = m.section(form.NamedSection, 'main', 'fakehttp');
		s.anonymous = true;
		s.addremove = false;

		s.tab('status', '状态与操作');
		s.tab('basic', '基础设置');
		s.tab('advanced', '高级设置');
		s.tab('schedule', '定时重启');
		s.tab('logs', '日志');

		o = s.taboption('status', form.DummyValue, '_runtime', '当前状态');
		o.rawhtml = true;
		o.cfgvalue = function() {
			return renderRuntimeStatus(services, crontab);
		};

		o = s.taboption('status', form.Button, '_start', '启动服务');
		o.inputtitle = '启动';
		o.inputstyle = 'apply';
		o.onclick = function() {
			return saveApplyAndRun(m, 'restart_now', 'FakeHTTP 已启动');
		};

		o = s.taboption('status', form.Button, '_stop', '停止服务');
		o.inputtitle = '停止';
		o.inputstyle = 'reset';
		o.onclick = function() {
			return runInitAction('stop', 'FakeHTTP 已停止');
		};

		o = s.taboption('status', form.Button, '_restart', '重启服务');
		o.inputtitle = '重启';
		o.inputstyle = 'reload';
		o.onclick = function() {
			return saveApplyAndRun(m, 'restart_now', 'FakeHTTP 已重启');
		};

		o = s.taboption('status', form.Button, '_update_cron', '更新定时任务');
		o.inputtitle = '立即更新';
		o.inputstyle = 'apply';
		o.onclick = function() {
			return saveApplyAndRun(m, 'update_cron', '定时任务已更新');
		};

		o = s.taboption('status', form.Button, '_cleanup', '清理残留规则');
		o.inputtitle = '清理';
		o.inputstyle = 'remove';
		o.onclick = function() {
			return runInitAction('cleanup_rules', '残留规则清理完成');
		};

		enabledOpt = s.taboption('basic', form.Flag, 'enabled', '启用');
		enabledOpt.rmempty = false;

		ifaceModeOpt = s.taboption('basic', form.ListValue, 'interface_mode', '接口范围');
		ifaceModeOpt.value('custom', '指定接口');
		ifaceModeOpt.value('all', '全部接口');
		ifaceModeOpt.default = 'custom';
		ifaceModeOpt.rmempty = false;

		o = s.taboption('basic', widgets.NetworkSelect, 'interfaces', '绑定接口');
		o.multiple = true;
		o.rmempty = true;
		o.depends('interface_mode', 'custom');
		o.validate = function(sectionId, value) {
			var selected = Array.isArray(value) ? value.length : String(value || '').trim().length;

			if (enabledOpt.formvalue(sectionId) === '1' &&
			    ifaceModeOpt.formvalue(sectionId) === 'custom' &&
			    !selected)
				return '启用服务时至少选择一个接口';

			return true;
		};

		payloadModeOpt = s.taboption('basic', form.ListValue, 'payload_mode', '混淆载荷');
		payloadModeOpt.value('http', 'HTTP Host');
		payloadModeOpt.value('https', 'HTTPS SNI');
		payloadModeOpt.value('custom', '自定义二进制文件');
		payloadModeOpt.default = 'http';
		payloadModeOpt.rmempty = false;

		o = s.taboption('basic', form.Value, 'hostname', '主机名');
		o.default = 'www.speedtest.cn';
		o.placeholder = 'www.speedtest.cn';
		o.rmempty = true;
		o.depends('payload_mode', 'http');
		o.depends('payload_mode', 'https');
		o.validate = function(sectionId, value) {
			var mode = payloadModeOpt.formvalue(sectionId);

			if ((mode === 'http' || mode === 'https') &&
			    enabledOpt.formvalue(sectionId) === '1' &&
			    !value)
				return '启用服务时必须填写主机名';

			if (value && !/^([A-Za-z0-9][A-Za-z0-9-]*\.)*[A-Za-z0-9][A-Za-z0-9-]*\.?$/.test(value))
				return '请输入有效主机名，例如 www.example.com';

			return true;
		};

		o = s.taboption('basic', form.Value, 'payload_file', '载荷文件');
		o.placeholder = '/etc/fakehttp/payload.bin';
		o.rmempty = true;
		o.depends('payload_mode', 'custom');
		o.validate = function(sectionId, value) {
			if (payloadModeOpt.formvalue(sectionId) === 'custom' &&
			    enabledOpt.formvalue(sectionId) === '1' &&
			    !value)
				return '启用服务时必须填写载荷文件';
			if (value && value.charAt(0) !== '/')
				return '请输入绝对路径';
			return true;
		};

		o = s.taboption('basic', form.ListValue, 'direction', '处理方向');
		o.value('both', '双向');
		o.value('inbound', '入站');
		o.value('outbound', '出站');
		o.default = 'both';
		o.rmempty = false;

		o = s.taboption('basic', form.ListValue, 'ip_family', 'IP 协议');
		o.value('both', 'IPv4 + IPv6');
		o.value('ipv4', '仅 IPv4');
		o.value('ipv6', '仅 IPv6');
		o.default = 'both';
		o.rmempty = false;

		o = s.taboption('advanced', form.Value, 'queue_num', 'NFQUEUE 编号');
		o.default = '100';
		o.rmempty = false;
		o.validate = validateRange(1, 4294967295, '请输入 1 到 4294967295 之间的队列编号', false);

		o = s.taboption('advanced', form.Value, 'fwmark', '绕过标记');
		o.default = '0x8000';
		o.rmempty = false;
		o.validate = validateMark;

		o = s.taboption('advanced', form.Value, 'fwmask', '标记掩码');
		o.placeholder = '留空时使用绕过标记';
		o.rmempty = true;
		o.validate = validateMark;

		o = s.taboption('advanced', form.Value, 'repeat', '重复包数量');
		o.default = '2';
		o.rmempty = false;
		o.validate = validateRange(1, 10, '重复包数量范围为 1 到 10', false);

		o = s.taboption('advanced', form.Value, 'ttl', '固定 TTL');
		o.default = '3';
		o.rmempty = false;
		o.validate = validateRange(1, 255, 'TTL 范围为 1 到 255', false);

		noHop = s.taboption('advanced', form.Flag, 'disable_hop_estimation', '禁用跳数估计');
		noHop.rmempty = false;

		o = s.taboption('advanced', form.Value, 'dynamic_pct', '动态 TTL 百分比');
		o.placeholder = '留空表示关闭';
		o.rmempty = true;
		o.validate = function(sectionId, value) {
			var valid = validateRange(1, 99, '动态 TTL 百分比范围为 1 到 99', true)(sectionId, value);
			if (valid !== true)
				return valid;
			if (value && noHop.formvalue(sectionId) === '1')
				return '动态 TTL 不能与禁用跳数估计同时启用';
			return true;
		};

		o = s.taboption('advanced', form.Flag, 'skip_firewall', '跳过防火墙规则');
		o.rmempty = false;

		o = s.taboption('advanced', form.Flag, 'use_iptables', '使用 iptables 兼容模式');
		o.rmempty = false;

		o = s.taboption('advanced', form.Flag, 'silent', '静默模式');
		o.rmempty = false;

		o = s.taboption('advanced', form.Value, 'log_file', '日志文件');
		o.placeholder = '/var/log/fakehttp.log';
		o.rmempty = true;
		o.validate = function(sectionId, value) {
			if (!value)
				return true;
			if (value.charAt(0) !== '/')
				return '请输入绝对路径';
			return true;
		};

		o = s.taboption('schedule', form.Flag, 'scheduled_restart', '启用定时重启');
		o.rmempty = false;

		o = s.taboption('schedule', form.ListValue, 'restart_mode', '重启模式');
		o.value('daily', '每天');
		o.value('weekly', '每周');
		o.value('interval', '按小时间隔');
		o.default = 'daily';
		o.rmempty = false;
		o.depends('scheduled_restart', '1');

		o = s.taboption('schedule', form.Value, 'restart_time', '重启时间');
		o.default = '04:00';
		o.rmempty = false;
		o.depends({ scheduled_restart: '1', restart_mode: 'daily' });
		o.depends({ scheduled_restart: '1', restart_mode: 'weekly' });
		o.validate = validateTime;

		o = s.taboption('schedule', form.ListValue, 'restart_weekday', '星期');
		o.value('0', '周日');
		o.value('1', '周一');
		o.value('2', '周二');
		o.value('3', '周三');
		o.value('4', '周四');
		o.value('5', '周五');
		o.value('6', '周六');
		o.default = '0';
		o.rmempty = false;
		o.depends({ scheduled_restart: '1', restart_mode: 'weekly' });

		o = s.taboption('schedule', form.Value, 'restart_interval_hours', '间隔小时');
		o.default = '24';
		o.rmempty = false;
		o.depends({ scheduled_restart: '1', restart_mode: 'interval' });
		o.validate = validateRange(1, 168, '间隔小时范围为 1 到 168', false);

		o = s.taboption('schedule', form.DummyValue, '_schedule_state', '当前计划');
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<div class="cbi-value-field">' + escapeHTML(getScheduleText(crontab)) + '</div>';
		};

		o = s.taboption('logs', form.DummyValue, '_logs', '近期日志');
		o.rawhtml = true;
		o.cfgvalue = function() {
			return renderLogBlock('系统日志', logOutput, 200) +
				renderLogBlock('文件日志 /var/log/fakehttp.log', fileLog, 200);
		};

		return m.render();
	}
});
