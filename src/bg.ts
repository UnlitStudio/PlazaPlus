import * as _ from 'lodash';
import * as $ from 'jquery';
import Enums from './enums';
import getChat from './func/getChatName';
import {sendMsgFactory, listenForMsgs, SendMsgFunc, MsgListenReg} from './func/portHelpers';
import {Dict} from './helpers/types';

type ChatList = {[room: string]: (() => void)[]};
type MainList = {[room: string]: SendMsgFunc};
var chatTabs = {list: <ChatList>{}, main: <MainList>{}};

if (!chrome.storage.sync) chrome.storage.sync = chrome.storage.local;

chrome.runtime.onConnect.addListener(function(port) {
	if (!_.startsWith(port.name, "chat:")) return;
	var chatroom = port.name.substr(5);
	var main = false;
	
	var sendMessage = sendMsgFactory(port);
	var setMain = function() {
		main = true; chatTabs.main[chatroom] = sendMessage; sendMessage('newMain');
	};
	
	if (!chatTabs.list[chatroom]) chatTabs.list[chatroom] = [];
	if (chatTabs.main[chatroom]) chatTabs.list[chatroom].push(setMain); else setMain();
	
	// message listeners
	var listeners: MsgListenReg = {};
	listeners['openOptions'] = function() { chrome.runtime.openOptionsPage(); };
	listeners['notify'] = function(type: string, notif: {user: string; msg: string; warn: boolean}) {
		var user = notif.user, chat = getChat(chatroom);
		if (user) {} // Don't modify the name
		else if (notif.warn) user = '[Warning]';
		else user = '[Unknown]';
		chrome.storage.sync.get(['notifyIgnore', 'notifySound', 'notifyVolume'], function(items) {
			if (_.includes(_.map(_.split(items['notifyIgnore'], ' '), _.toLower), _.toLower(user))) return;
			new Promise(function(ok, err) {
				if (user == '[Warning]' || user == '[Unknown]') return ok();
				$.ajax('http://3dsplaza.com/chat3/nav.php', {
					data: {loc: 'user', who: user}, success: function(d) {
						var id = d.match(/'\/INTERNAL-ignore (?:\+|-) (\d+)';/);
						if (id) ok(id[1]); else ok();
					}, timeout: 3000, dataType: 'text',
					error: function() { ok(); }
				});
			}).then(function(id) {
				var url = 'http://3dsplaza.com/profile_pics/default.png';
				if (id) url = `http://3dsplaza.com/profile_pics/${id}.jpg`;
				chrome.notifications.create({
					type: 'basic', iconUrl: url,
					title: (function() {
						switch (type) {
							case 'whisper': return user+' whispered to you in Chatroom '+chat;
							default: return user+' mentioned you in Chatroom '+chat;
						}
					})(), message: notif.msg, isClickable: false
				});
				var a = new Audio(); a.src = chrome.extension.getURL('res/'+items['notifySound']);
				a.volume = items['notifyVolume'] / 100; a.play();
			});
		});
	};
	
	listenForMsgs(port, listeners);
	
	port.onDisconnect.addListener(function() {
		if (main) {
			delete chatTabs.main[chatroom];
			if (chatTabs.list[chatroom].length) chatTabs.list[chatroom].shift()();
		} else chatTabs.list[chatroom] = _.without(chatTabs.list[chatroom], setMain);
	});
});

chrome.alarms.onAlarm.addListener(function(alarm) {
	if (alarm.name != 'icons') return;
	chrome.storage.local.get(['iconCache'], function(items) {
		var rev = items['iconCache'].Revision;
		$.ajax('https://erman.rocks/services/plaza+/rev.php', {
			success: function(data) {
				if (data != rev) $.ajax('https://erman.rocks/services/plaza+/icons.json', {
					success: function(icons) {
						if (icons.Revision) chrome.storage.local.set({iconCache: icons});
					}, timeout: 10000, dataType: 'json', cache: false
				});
			}, timeout: 10000, dataType: 'text', cache: false
		});
	});
});
chrome.alarms.create('icons', {delayInMinutes: 1, periodInMinutes: 3});

type Storage = Dict<any>;
type Updater = (storage: Storage) => Storage;
interface Version {
	id: string; local?: Updater; sync?: Updater;
}
var updates: Version[] = [
	{id: '4.7'}
];

function checkNewer(older: string, newer: string): boolean {
	var oldVer = _.map(_.split(older+'.0.0.0', '.', 4), _.toInteger);
	var newVer = _.map(_.split(newer+'.0.0.0', '.', 4), _.toInteger);
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

// This is done so we don't need to provide defaults every time we get from storage.
chrome.storage.local.get(Enums.localDef, function(items) {
	chrome.storage.local.set(items);
});
chrome.storage.sync.get(Enums.syncDef, function(items) {
	chrome.storage.sync.set(items);
});

chrome.runtime.onInstalled.addListener(function(details) {
	if (details.reason != 'update') return;
	var localUpdates: Updater[] = [], syncUpdates: Updater[] = [];
	_.each(updates, function(version) {
		if (!checkNewer(details.previousVersion, version.id)) return;
		if (version.local) localUpdates.push(version.local);
		if (version.sync) syncUpdates.push(version.sync);
	});
	chrome.storage.local.get(function(items) {
		chrome.storage.local.set(_.defaults(_.reduce(localUpdates, function(storage, updater) {
			return updater(storage);
		}, items), Enums.localDef));
	});
	chrome.storage.sync.get(function(items) {
		chrome.storage.sync.set(_.defaults(_.reduce(syncUpdates, function(storage, updater) {
			return updater(storage);
		}, items), Enums.syncDef));
	});
});
