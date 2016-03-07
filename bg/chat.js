/* globals _, chrome, Enums */

var chatTabs = {list: {}, main: {}};

chrome.runtime.onConnect.addListener(function(port) {
	if (!_.startsWith(port.name, "chat:")) return;
	var chatroom = port.name.substr(5);
	var main = false;
	
	var sendMessage = _.rest(function(type, data) { port.postMessage(_.concat([type], data)); });
	var setMain = function() {
		main = true; chatTabs.main[chatroom] = sendMessage; sendMessage('newMain');
	};
	
	if (!chatTabs.list[chatroom]) chatTabs.list[chatroom] = [];
	if (chatTabs.main.chatroom) chatTabs.list[chatroom].push(setMain); else setMain();
	
	// message listeners
	var listeners = {};
	listeners.openOptions = function() { chrome.runtime.openOptionsPage(); };
	listeners.openHelp = function(page) {
		window.open(chrome.extension.getURL('util/help.html'+(page?'#'+page:'')));
	};
	listeners.notify = function(type, notif) {
		var user = notif.user, chat = getChat(chatroom);
		if (user) {} // Don't modify the name
		else if (notif.warn) user = '[Warning]';
		else user = '[Unknown]';
		chrome.storage.sync.get({
			notifyIgnore: Enums.syncDef.notifyIgnore, notifySound: Enums.syncDef.notifySound,
			notifyVolume: Enums.syncDef.notifyVolume
		}, function(items) {
			if (_.includes(_.map(_.split(items.notifyIgnore, ' '), _.toLower), _.toLower(user))) return;
			chrome.notifications.create({
				type: 'basic', iconUrl: 'http://3dsplaza.com/profile_pics/default.png',
				title: (function() {
					switch (type) {
						case 'whisper': return user+' whispered to you in Chatroom '+chat;
						case 'mention': return user+' mentioned you in Chatroom '+chat;
					}
				})(), message: notif.msg, isClickable: false
			}, function(notifId) {
				if (user == '[Warning]' || user == '[Unknown]') return;
				$.ajax('http://3dsplaza.com/members/view_profile.php?user='+user, {
					success: function(data) {
						var id = data.match(/black;' src='http:\/\/3dsplaza\.com\/profile_pics\/(\d+).jpg'>/);
						if (id)
							chrome.notifications.update(notifId, {
								iconUrl: 'http://3dsplaza.com/profile_pics/'+id[1]+'.jpg'
							});
					}, timeout: 5000, dataType: 'text', cache: false
				});
			});
			var a = new Audio(); a.src = chrome.extension.getURL('sounds/'+items.notifySound);
			a.volume = items.notifyVolume / 100; a.play();
		});
	};
	
	port.onMessage.addListener(function(msg, sender) {
		var type = _.head(msg), data = _.tail(msg);
		if (type in listeners) _.spread(listeners[type])(data);
	});
	
	port.onDisconnect.addListener(function() {
		if (main) {
			delete chatTabs.main[chatroom];
			if (chatTabs.list[chatroom].length) chatTabs.list.shift()();
		} else chatTabs.list[chatroom] = _.without(chatTabs.list[chatroom], setMain);
	});
});

function getChat(v) {
	switch (_.toLower(v)) {
		case 'v3original': return 'Original';
		case 'v3game': return 'Game';
		case 'v3red': return 'Red';
		case 'v3yellow': return 'Yellow';
		case 'v3green': return 'Green';
		case 'v3rp': return 'Roleplay';
		case 'v3rpaux': return 'Aux Roleplay';
		case 'r9k': return 'ROBOT9000';
		default: return '[Unknown]';
	}
}
