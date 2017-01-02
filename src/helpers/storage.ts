import * as _ from 'lodash';
import * as tinycolor from 'tinycolor2';
import * as Enums from '../enums';
import {Dict, Alias} from '../helpers/types';
export interface IconCache { [user: string]: string | number; }

export interface Storage {
	iconCache: IconCache, hideTabs: boolean, onlineSort: boolean, displayIcons: boolean,
	colorNormal: string, colorNoob: string, colorMod: string, colorBanned: string, colorIgnored: string,
	notifyWhispers: boolean, notifyNames: string, notifyIgnore: string,
	notifySound: string, notifyVolume: number, aliases: Dict<Alias>
}

export type StorListener<P extends keyof Storage> = (newValue: Storage[P], oldValue?: Storage[P]) => void;
export type StorListenReg = { [P in keyof Storage]?: StorListener<P> };

export async function listen(listeners: StorListenReg) {
	chrome.storage.onChanged.addListener(function(changes, space) {
		if (space != 'local') return;
		for (let key in changes) {
			const listener: StorListener<keyof Storage> = listeners[key as keyof Storage];
			const change = changes[key];
			if (!listener) continue;
			listener(change.newValue, change.oldValue);
		}
	});
	try {
		const items = await get();
		for (let key in items) {
			const listener: StorListener<keyof Storage> = listeners[key as keyof Storage];
			if (!listener) continue;
			listener(items[key as keyof Storage]);
		}
	} catch (e) {
		console.error("Error first running listener.", e);
	}
}

export function get(): Promise<Storage>;
export function get<T extends keyof Storage>(key: T): Promise<Pick<Storage, T>>;
export function get<T extends keyof Storage>(keys: T[]): Promise<Pick<Storage, T>>;
export function get(keys?: any) {
	return new Promise((ok, err) => {
		chrome.storage.local.get(keys, function(items) {
			const error = chrome.runtime.lastError;
			if (error) err(error.message);
			else ok(items);
		});
	});
}

export function set(items: Partial<Storage>) {
	return new Promise<void>((ok, err) => {
		chrome.storage.local.set(items, function() {
			const error = chrome.runtime.lastError;
			if (error) err(error.message);
			else ok();
		});
	});
}
