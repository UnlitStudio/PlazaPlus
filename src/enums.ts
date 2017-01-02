import {Dict} from './helpers/types';
import {Storage} from './helpers/storage';

export const storageDef: Storage = {
	iconCache: { Revision: 0 },
	hideTabs: false, onlineSort: true, displayIcons: true,
	colorNormal: '#0000ff', colorNoob: '#00ffff', colorMod: '#00ff00', colorBanned: '#ff0000',
	colorIgnored: '#000000',
	notifyWhispers: true, notifyNames: '', notifyIgnore: 'Robdebot SomeLuigiBot',
	notifySound: 'communication-channel.ogg', notifyVolume: 80,
	aliases: {
		fayne: {tag: 'Fayne', user: 'Fayne_Aldan'}, rob: {tag: 'Rob', user: 'Robdeprop'}
	}
};
export const enum NotifyType {
	WHISPER, MENTION
};
