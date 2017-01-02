import * as $ from 'jquery';
import * as Enums from './enums';
import getChat from './func/getChatName';
import * as storage from './helpers/storage';
import {sendMsgFactory, listenForMsgs, SendMsgFunc, MsgListenReg} from './func/portHelpers';

type ChatList = {[room: string]: (() => void)[]};
type MainList = {[room: string]: SendMsgFunc};
var chatTabs = {list: <ChatList>{}, main: <MainList>{}};

chrome.runtime.onConnect.addListener(port => {
	if (!port.name.startsWith("chat:")) return;
	var chatroom = port.name.substr(5);
	var main = false;
	
	var sendMessage = sendMsgFactory(port);
	var setMain = () => {
		main = true; chatTabs.main[chatroom] = sendMessage; sendMessage('newMain');
	};
	
	if (!chatTabs.list[chatroom]) chatTabs.list[chatroom] = [];
	if (chatTabs.main[chatroom]) chatTabs.list[chatroom].push(setMain); else setMain();
	
	// message listeners
	var listeners: MsgListenReg = {};
	listeners['openOptions'] = () => { chrome.runtime.openOptionsPage(); };
	listeners['notify'] = async (type: Enums.NotifyType, notif: {user: string; msg: string; warn: boolean}) => {
		var user = notif.user, chat = getChat(chatroom);
		if (user) {} // Don't modify the name
		else if (notif.warn) user = '[Warning]';
		else user = '[Unknown]';
		const items = await storage.get(['notifyIgnore', 'notifySound', 'notifyVolume']);
		if (items['notifyIgnore'].split(' ').map(''.toLowerCase).indexOf(user.toLowerCase())>=0) return;
		new Promise((ok, err) => {
			if (user == '[Warning]' || user == '[Unknown]') return ok();
			$.ajax('http://3dsplaza.com/chat3/nav.php', {
				data: {loc: 'user', who: user}, success: d => {
					var id = d.match(/'\/INTERNAL-ignore (?:\+|-) (\d+)';/);
					if (id) ok(id[1]); else ok();
				}, timeout: 3000, dataType: 'text',
				error: () => { ok(); }
			});
		}).then(id => {
			var url = 'http://3dsplaza.com/profile_pics/default.png';
			if (id) url = `http://3dsplaza.com/profile_pics/${id}.jpg`;
			chrome.notifications.create({
				type: 'basic', iconUrl: url,
				title: (() => {
					switch (type) {
						case Enums.NotifyType.WHISPER:
							return user+' whispered to you in Chatroom '+chat;
						case Enums.NotifyType.MENTION:
							return user+' mentioned you in Chatroom '+chat;
					}
				})(), message: notif.msg, isClickable: false
			});
			var a = new Audio(); a.src = chrome.extension.getURL('res/'+items['notifySound']);
			a.volume = items['notifyVolume'] / 100; a.play();
		});
	};
	listenForMsgs(port, listeners);
	
	port.onDisconnect.addListener(() => {
		if (main) {
			delete chatTabs.main[chatroom];
			if (chatTabs.list[chatroom].length) chatTabs.list[chatroom].shift()();
		} else {
			let index = chatTabs.list[chatroom].indexOf(setMain);
			if (index > -1) chatTabs.list[chatroom].splice(index, 1);
		}
	});
});

chrome.alarms.onAlarm.addListener(async alarm => {
	if (alarm.name != 'icons') return;
	const items = await storage.get('iconCache');
	var rev = items['iconCache']["Revision"];
	$.ajax('https://erman.rocks/services/plaza+/rev.php', {
		success: data => {
			if (data != rev) $.ajax('https://erman.rocks/services/plaza+/icons.json', {
				success: icons => {
					if (icons.Revision) storage.set({iconCache: icons});
				}, timeout: 10000, dataType: 'json', cache: false
			});
		}, timeout: 10000, dataType: 'text', cache: false
	});
});
chrome.alarms.create('icons', {delayInMinutes: 1, periodInMinutes: 3});

// This is done so we don't need to provide defaults every time we get from storage.
chrome.storage.local.get(Enums.storageDef, items => {
	const error = chrome.runtime.lastError;
	if (error) console.error("Error loading for storage initialization.", error.message);
	else
		storage.set(items).catch(e => {
			console.error("Error saving for storage initialization.", e);
		});
});

function checkNewer(older: string, newer: string): boolean {
	var oldVer = (older+'.0.0.0').split('.', 4).map(Number);
	var newVer = (newer+'.0.0.0').split('.', 4).map(Number);
	if (newVer[0] < oldVer[0]) return false;
	if (newVer[0] > oldVer[0]) return true;
	if (newVer[1] < oldVer[1]) return false;
	if (newVer[1] > oldVer[1]) return true;
	if (newVer[2] < oldVer[2]) return false;
	if (newVer[2] > oldVer[2]) return true;
	if (newVer[3] < oldVer[3]) return false;
	if (newVer[3] > oldVer[3]) return true;
	return false;
}

chrome.runtime.onInstalled.addListener(details => {
	if (details.reason != 'update') return;
	if (!chrome.storage.sync) return;
	if (checkNewer(details.previousVersion, '4.9')) return;
	
	chrome.storage.sync.get(items => {
		const error = chrome.runtime.lastError;
		if (error) {
			console.error('Error loading sync storage for migration.', error.message);
			return;
		}
		storage.set(items).then(() => {
			chrome.storage.sync.clear(() => {
				const error = chrome.runtime.lastError;
				if (error) console.error("Error clearing sync storage after migration.", error.message);
			});
		}).catch(e => {
			console.error('Error migrating sync storage to local storage.', e);
		});
	});
});
