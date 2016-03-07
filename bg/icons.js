/* globals _, chrome, Enums */

chrome.alarms.onAlarm.addListener(function(alarm) {
	if (alarm.name != 'icons') return;
	chrome.permissions.contains({origins: ['http://188.166.72.241/']}, function(result) {
		if (!result) return;
		chrome.storage.local.get({iconCache: Enums.localDef.iconCache}, function(items) {
			var rev = items.iconCache.Revision;
			$.ajax('http://188.166.72.241/services/plaza+/rev.php', {
				success: function(data) {
					if (data != rev) $.ajax('http://188.166.72.241/services/plaza+/icons.json', {
						success: function(icons) {
							if (icons.Revision) chrome.storage.local.set({iconCache: icons});
						}, timeout: 10000, dataType: 'json', cache: false
					});
				}, timeout: 10000, dataType: 'text', cache: false
			});
		});
	});
});
// Instantly executes if unpacked. Otherwise, executes after 1 minute.
chrome.alarms.create('icons', {when: Date.now(), periodInMinutes: 3});
