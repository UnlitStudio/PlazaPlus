import * as _ from 'lodash';
import {Dict} from '../helpers/types';

export type SendMsgFunc = (type: string, ...data: any[]) => void;
export type Message = {type: string; data: any[]};

export function sendMsgFactory(port: chrome.runtime.Port): SendMsgFunc {
	return function(type: string, ...data: any[]) {
		port.postMessage({type, data});
	};
};

export type MsgListener = (...data: any[]) => void;
export type MsgListenReg = Dict<MsgListener>;

export function listenForMsgs(port: chrome.runtime.Port, listeners: MsgListenReg) {
	port.onMessage.addListener(function(msg: Message, sender: chrome.runtime.Port) {
		_.spread(listeners[msg.type] || _.noop)(msg.data);
	});
};
