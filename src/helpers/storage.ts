import * as _ from 'lodash';
import * as tinycolor from 'tinycolor2';
import Enums from '../enums';
import {Dict} from '../helpers/types';

export type StorListener = (newValue: any, oldValue?: any) => void;
export type StorListenReg = Dict<StorListener>;

function listen(listeners: StorListenReg, space: string) {
	chrome.storage.onChanged.addListener(function(changes, space) {
		if (space != space) return;
		_.each(changes, function(v, k) { (listeners[k] || _.noop)(v.newValue, v.oldValue); });
	});
}

export function storageListen(localListeners: StorListenReg, syncListeners: StorListenReg) {
	localListen(localListeners); syncListen(syncListeners);
}
export function localListen(listeners: StorListenReg) {
	listen(listeners, 'local');
	chrome.storage.local.get(Enums.localDef, function(items) {
		if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError);
		_.each(items, function(v, k) { (listeners[k] || _.noop)(v); });
	});
}
export function syncListen(listeners: StorListenReg) {
	listen(listeners, 'sync');
	chrome.storage.sync.get(Enums.syncDef, function(items) {
		if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError);
		_.each(items, function(v, k) { (listeners[k] || _.noop)(v); });
	});
}
