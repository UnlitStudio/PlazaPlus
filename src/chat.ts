import * as $ from 'jquery';
import * as tinycolor from 'tinycolor2';
import * as linkifyJq from 'linkifyjs/jquery';
import * as Enums from './enums';
import {sendMsgFactory, listenForMsgs, MsgListenReg} from './func/portHelpers';
import * as storage from './helpers/storage';
import {Dict, Alias} from './helpers/types';
linkifyJq($);

function chatIns(...objs: any[]) {
	objs.push('<!--d-->');
	$('#demo').prepend(objs);
}

{
	// Make sure Plaza+ has all it needs to function.
	let canRun =
		$('#demo').length === 0 ? false :
		$('#online').length === 0 ? 'The chat did not load correctly. Please refresh.' :
		$('#bericht').length === 0 ? 'You must be logged in and not banned to use Plaza+.' :
		$('.plazaPlusRunning').length > 0 ? 'Plaza+ is somehow already running in this tab.' :
		true;
	// Is throwing an error the best way to terminate a content script?
	// I don't want to have to wrap the whole script in a function.
	if (canRun === false) throw new Error('The chat did not load correctly. Please refresh.');
	else if (typeof canRun == 'string') {
		chatErr(canRun);
		throw new Error(canRun);
	}
}

import './chat.less';

function chatMsg(msg: string) {
	chatIns($('<div/>', {text: ': '+msg, css: {color: 'gray'}}));
}
function chatErr(msg: string) {
	chatIns($('<div/>', {text: ': '+msg, css: {color: 'red'}}));
}
function microtime() {
	var now = $.now() / 1e3, s = now | 0;
	return (Math.round((now - s) * 1e3) / 1e3) + ' ' + s;
}

var chatroom = (/\?room=(.*)/.exec($('.contain_inside form').attr('action')) || ['','v3original'])[1];
var port = chrome.runtime.connect({name: 'chat:'+chatroom}), mainTab = false;
var active = 0, boxes: TextBox[] = [], icons: storage.IconCache = {}, aliases: Dict<Alias> = {};
var focusList: string[] = [], focusMode = 'blur', isFocus = false, asyncLock = 0, notifyNames = '';
var notifyWhispers = false, lastWhisp: string = null, onlineSort = false;
var colorNormal = '#0000ff', colorNoob = '#00ffff', colorMod = '#00ff00';
var colorBanned = '#ff0000', colorIgnored = '#000000';

// Chrome doesn't allow unsafeWindow. D:<
// Instead, we have to inject an event listener into the page.
var oldsp: () => void;
{
	let s = document.createElement('script');
	s.src = chrome.extension.getURL('res/chatInject.js');
	s.onload = function() { $(this).remove(); };
	document.body.appendChild(s);
	let evt = document.createEvent('Event');
	evt.initEvent('plusSendChat', true, false);
	oldsp = function() { document.dispatchEvent(evt); };
}

// message helpers
var sendMessage = sendMsgFactory(port);
listenForMsgs(port, {
	newMain() { mainTab = true; }
});

port.onDisconnect.addListener(function() {
	$('html').html('<body>Plaza+ unloaded. Refresh required.</body>');
	// Recreate #demo and #online because scripts are still running.
	$('body').append(
		$('<div/>', {id: 'demo', css: {display: 'none'}}),
		$('<div/>', {id: 'online', css: {display: 'none'}})
	);
	setTimeout(function() { location.reload(); }, 1000);
});

storage.listen({
	iconCache(v) {
		icons = v; $('.plusicon').attr('src', null);
		for (let user in icons) $('.chatline[user="'+user+'"] .plusicon').attr('src', icons[user]);
	},
	hideTabs(v) {
		$('#pluscss1').text(v ? '#plusbtn0,#plusbtn1,#plusbtn2,#plusbtn3,#plusbtn4{width:0px !important}' : '');
	},
	displayIcons(v) {
		$('#pluscss0').text(v ? '' : '.plusicon{display:none}');
	},
	aliases(v) { aliases = v; },
	notifyNames(v) { notifyNames = v; },
	notifyWhispers(v) { notifyWhispers = v; },
	onlineSort(v) { onlineSort = v; },
	colorNormal(v) { colorNormal = v; },
	colorNoob(v) { colorNoob = v; },
	colorMod(v) { colorMod = v; },
	colorBanned(v) { colorBanned = v; },
	colorIgnored(v) { colorIgnored = v; }
});

$('body').addClass('plazaplus');
for (let i = 0; i < 3; i++)
	$('<style/>', {id: 'pluscss'+i}).appendTo('head');
$('<span/>', {id: 'plazaPlusRunning'}).appendTo('body');
$('#bericht, #send').addClass('plusbox plusbox0');
$('form:first').html('Change your name color:<br>').append(
	$('<input>', {name: 'color', type: 'text'}).change(function() {
		var col = parseColor($(this).val()); if (col) $(this).val(col.toHexString());
	}),
	$('<input>', {name: 'color_change', type: 'submit', val: '>'}),
	'<br>'
); $('<div/>', {id: 'plusbar'}).appendTo('body');

type BoxSel = [number, number, string];
class TextBox {
	constructor(public dest: Dest) {
		this.text = ''; this.sel = [0, 0, 'forward'];
	}
	public text: string; public sel: BoxSel;
}

interface Dest {
	info(): string;
	test(preSend?: boolean): Promise<void | string>;
	send(txt: string): Promise<void | string>;
}

class DestChat implements Dest {
	constructor() {}
	info() { return 'Chat'; }
	test() { return Promise.resolve(); }
	send(txt: string) { sendChat(txt, true); return Promise.resolve(); }
}
class DestWhisp implements Dest {
	constructor(public user: string) {}
	info() { return 'Whisper '+this.user; }
	test() { var user = this.user; return new Promise<string>(function(ok, err) {
		$.ajax('../chat3/nav.php', {
			data: {loc: 'user', who: user}, success: function(d: string) {
				if (d.includes('This user does not seem to exist.'))
					err('The user '+user+" doesn't exist.");
				else if (d.includes('You cannot whisper'))
					err("You can't whisper "+user+" because you aren't friends with them.");
				else ok();
			}, timeout: 3000, dataType: 'text', error: function() { ok(); }
		});
	}); }
	send(txt: string) { sendChat(`/whisperto ${this.user} ${txt}`, true); return Promise.resolve(); }
}

class DestEcho implements Dest {
	info() { return 'Echo'; }
	test() { return Promise.resolve(); }
	send(txt: string) { chatMsg(txt); return Promise.resolve(); }
}
class DestNull implements Dest {
	info() { return 'Null'; }
	test() { return Promise.resolve(); }
	send() { return Promise.resolve(); }
};
class DestPM implements Dest {
	constructor(public user: string, public subj: string) {}
	info() { return 'PM '+this.user+' - Subject: '+this.subj; }
	test(pretest: boolean): Promise<void | string> {
		if (pretest) return Promise.resolve();
		var user = this.user;
		return new Promise<string>(function(ok, err) {
			this.exec('','').then(function() {
				ok('Type the PM message for '+user+' into the textbox.');
			}, function(msg: string) { err(msg); });
		});
	}
	send(txt: string) {
		var t = this;
		return new Promise<string>(function(ok, err) {
			t.exec(t.subj, txt.replace(/\\\\/g, '\n')).then(function(stat: string) {
				if (stat == 'unknown')
					return err(`An unknown error occurred while sending the PM to ${t.user}.`);
				if (stat == 'error')
					return err(`Plaza+ can't confirm if your PM was sent to ${t.user}.`);
				ok(`Your PM has been sent to ${t.user}.`);
			}, function(msg: string) { err(msg); });
		});
	}
	private exec(subj: string, msg: string) {
		var user = this.user;
		return new Promise(function(ok, err) {
			$.ajax('../members/send_pm.php', {
				type: 'POST', data: {
					to: user, subject: subj, message: msg, checktime: microtime(), send: 'Send'
				}, success: function(d) {
					if (d.includes('Your message has been sent succesfully!'))
						ok('sent');
					else if (d.includes('You are currently banned'))
						err("You can't send PMs while banned.");
					else if (d.includes(" doesn't exist!")) err('The user '+user+" doesn't exist.");
					else if (d.includes('friends can send PMs to'))
						err("You can't PM "+user+" because you aren't friends with them.");
					else ok('unknown');
				}, timeout: 3000, dataType: 'text',
				error: function() { ok('error'); }
			});
		}); 
	}
}

$('<div/>', {class: 'plusbtn', id: 'plusopt'}).click(function() { sendMessage('openOptions'); })
	.append($('<div/>')).attr('title', 'Plaza+ Options').appendTo('#plusbar');
for (let i = 0; i < 5; i++) {
	var box = new TextBox(new DestChat()), title = box.dest.info();
	boxes.push(box);
	$('<div/>', {class: 'plusbtn', id: 'plusbtn'+i}).click(function() { setActive(i); })
		.append('<div/>').attr('title', 'Chat').appendTo('#plusbar');
}
setActive(0);

/*function aliasCmd(txt, noparam) { return function(cb, param, dest) {
	parsePost(txt + (noparam ? '' : param.join(' ')), dest, cb);
}; }*/

type Command = (param: string[], dest: Dest) => Promise<ChatMsg>;

// Commands
var commands: Dict<Command> = {};
commands['raw'] = (param) => Promise.resolve(param.join(' '));
commands['query'] = (param) => new Promise(function(ok) {
	getUser(param.shift()).then((user) => ok('/query '+user));
});
commands['ignore'] = (param) => new Promise(function(ok, err) {
	getUser(param.shift()).then(function(user) {
		if (!user) return err('Please specify a user.');
		$.ajax('../chat3/nav.php', {
			data: {loc: 'user', who: user}, success: function(d) {
				var id = d.match(/'\/INTERNAL-ignore (?:\+|-) (\d+)';/);
				if (d.includes('This user does not seem to exist.'))
					err('The user '+user+" doesn't exist.");
				else if (id) sendChat('/INTERNAL-ignore + ' + id[1]);
				else err('Failed to retrieve '+user+"'s member ID.");
				ok();
			}, timeout: 3000, dataType: 'text',
			error: function() { err('Failed to retrieve '+user+"'s member ID."); }
		});
	});
});
commands['unignore'] = (param) => new Promise(function(ok, err) {
	getUser(param.shift()).then(function(user) {
		if (!user) return err('Please specify a user.');
		$.ajax('../chat3/nav.php', {
			data: {loc: 'user', who: user}, success: function(d) {
				var id = d.match(/'\/INTERNAL-ignore (?:\+|-) (\d+)';/);
				if (d.includes('This user does not seem to exist.'))
					err('The user '+user+" doesn't exist.");
				else if (id) sendChat('/INTERNAL-ignore - ' + id[1]);
				else err('Failed to retrieve '+user+"'s member ID.");
				ok();
			}, timeout: 3000, dataType: 'text',
			error: function() { err('Failed to retrieve '+user+"'s member ID."); }
		});
	});
});
commands['overraeg'] = (param) => Promise.resolve('/raeg ' + ':)'.repeat(10));
commands['+ver'] = function() {
	var ver = chrome.runtime.getManifest().version_name;
	chatMsg('You are using Plaza+ '+ver);
	return Promise.resolve();
};
commands['chat'] = function(param) {
	var dest = new DestChat(), msg = param.join(' ');
	if (msg) return parsePost(msg, dest);
	setDest(dest); return Promise.resolve();
};
commands['echo'] = function(param) {
	var dest = new DestEcho(), msg = param.join(' ');
	if (msg) return parsePost(msg, dest);
	setDest(dest); return Promise.resolve();
};
commands['whisper'] = (param) => new Promise<ChatMsg>(function(ok, err) {
	getUser(param.shift()).then(function(user) {
		if (!user) return err('Please specify a user.');
		var dest = new DestWhisp(user), msg = param.join(' ');
		if (msg) return parsePost(msg, dest).then(function(msg) { ok(msg); }, function(msg) { err(msg); });
		setDest(dest); return ok();
	});
});
commands['whisperto'] = commands['whisper'];
commands['pm'] = (param) => new Promise<ChatMsg>(function(ok, err) {
	getUser(param.shift()).then(function(user) {
		if (!user) return err('Please specify a user.');
		var subj = param.join(' ');
		if (!subj) return err('Please specify a subject.');
		var dest = new DestPM(user, emotify(subj).substr(0, 50));
		setDest(dest); return ok();
	});
});
commands['alias'] = function(param) {
	var tag = param.shift(), user = param.shift(), name = (tag || '').toLowerCase();
	if (!tag) {
		let list: string[] = [];
		for (let key in aliases) {
			let alias = aliases[key];
			list.push(alias.tag+' is '+alias.user);
		}
		chatMsg(list.length ? 'Aliases: ' + oxford(list) : 'No aliases are set.');
		return Promise.resolve();
	} else if (user) {
		aliases[name] = {tag: tag, user: user};
		chatMsg('Alias '+tag+' has been set to '+user+'.');
	} else if (aliases[name]) {
		delete aliases[name];
		chatMsg('Alias '+tag+' has been deleted.');
	} else {
		chatMsg('Alias '+tag+' is not set.');
		return Promise.resolve();
	}
	return new Promise(async function(ok, err) {
		try {
			await storage.set({aliases: aliases});
			ok();
		} catch (e) {
			err('Failed to save aliases: ' + chrome.runtime.lastError);
		}
	});
};
commands['room'] = function(param) {
	var room = param.shift();
	if (!room) return Promise.reject('Please specify a chatroom.');
	var chat = getChat(room);
	if (!chat) return Promise.reject(room+' is not a valid chatroom.');
	window.open('chat.php?room='+chat, '_top');
	chatMsg('Attempting to switch chatrooms...');
	return Promise.resolve();
};
commands['transfer'] = function(param) {
	var amt = param.shift();
	if (!amt) return Promise.reject('Please specify an amount of points to transfer.');
	return new Promise(function(ok, err) {
		getUser(param.shift()).then(function(user) {
			if (!user) return err('Please specify a user to transfer points to.');
			$.ajax('/apps/points_transfer/transfer_process.php', {
				type: 'POST', data: {amount: amt, to: user, checktime: microtime()}, success: function(d) {
					if (d.includes('You cannot transfer points to yourself!'))
						err('Are you trying to be greedy? Give those points to someone else!');
					else if (d.includes('The user you entered doesnt exist!'))
						err('The user '+name+" doesn't exist.");
					else if (
						d.includes('You dont have enough points to transfer!') ||
						d.includes('bigger than the amount you can transfer!')
					) err("You're not a wizard. No transferring points you don't have.");
					else if (d.includes('You can only send whole points'))
						err("Points aren't cookies. They must be given whole.");
					else if (d.includes('You havent entered the amount to transfer'))
						err("Why enter this command if you're not transferring any points?");
					else if (d.includes('You can not transfer less than 1 point!'))
						err("Don't make me divide by 0!");
					else if (d.includes('The ammount of points you entered is not a number'))
						err("Woah! That's a number now?! :O");
					else if (d.includes('Successfully transferred'))
						err(`Successfully transferred ${amt} point${amt=='1'?'':'s'} to ${user}!`);
					else err('An error occurred while transferring.');
				}, timeout: 3000, dataType: 'text', error: function() {
					err("Plaza+ can't confirm that the point transfer was successful.");
				}
			});
		});
	});
};
commands['slap'] = function(param) {
	const target = param.join(' ');
	const items = ['fish','gym sock','skunk','diaper','cheese wedge'];
	const item = items[Math.floor(Math.random() * items.length)];
	return Promise.resolve(`/me slaps ${target} with a smelly ${item}.`);
};
commands['rptag'] = (param) => new Promise(function(ok, err) {
	var tag = param.join(' ');
	if (!tag)
		$.ajax('../chat3/nav.php?loc=rptags&drop=', {
			success: function(d) {
				if (d.includes('<br>Dropped<br>')) {
					chatMsg('Your RP tag has been dropped.'); ok();
				} else err('An error occurred while trying to drop your RP tag.');
			}, timeout: 3000, dataType: 'text',
			error: function() { chatMsg("Plaza+ can't confirm that your RP tag was dropped."); ok(); }
		});
	else if (tag.length < 2) err('RP tags must be at least 2 characters long.');
	else if (tag.length > 15) err("RP tags can't be over 15 characters long.");
	else
		$.ajax('../chat3/nav.php?loc=rptags', {
			type: 'POST', data: {play: '', role: tag, set: 'Set RP tags'}, success: function(d) {
				if (d.includes('<br>Set<br>')) {
					chatMsg(`Your RP tag has been set to ${tag}.`); ok();
				} else err('An error occurred while trying to set your RP tag.');
			}, timeout: 3000, dataType: 'text',
			error: function() { chatMsg("Plaza+ can't confirm that your RP tag was set."); ok(); }
		});
});
commands['focus'] = (param) => new Promise(async function(ok, err) {
	var focused: string[] = [], blurred: string[] = [];
	function icb() {
		$('#pluscss2').text((function() { switch (focusMode) {
			case 'blur': return '.blur{filter:blur(1px);-webkit-filter:blur(1px)}.blur:hover{filter:initial;-webkit-filter:initial}';
			case 'shrink':
				return '.blur{font-size:8px;background-color:lightgray;display:block}.blur img{height:8px;width:auto}';
			default: return '.blur{display:none}';
		} })());
		var out: string[] = [];
		if (focused.length == 1) out.push(focused[0]+" has been focused");
		else if (focused.length > 1) out.push(oxford(focused) + " have been focused");
		if (blurred.length == 1) out.push(blurred[0]+" has been blurred");
		else if (blurred.length > 1) out.push(oxford(blurred) + " have been blurred");
		if (out.length > 0) chatMsg(oxford(out) + '.');
		$('.chatline').each(function() {
			if (focusList.length) {
				var user = $(this).attr('user');
				if (user) {
					if (focusList.map(''.toLowerCase).indexOf(user.toLowerCase())>=0) $(this).removeClass('blur');
					else $(this).addClass('blur');
				} else $(this).addClass('blur');
			} else $(this).removeClass('blur');
		});
		ok();
	}
	const action = param.shift();
	switch (action) {
		case 'clear': case 'reset':
			chatMsg('Focus list has been cleared.');
			focusList = [];
			return icb();
		case 'blur': case 'shrink': case 'hide':
			chatMsg('Focus has been set to '+action+' mode.');
			focusMode = action;
			return icb();
	}
	param.unshift(action);
	param = param.filter(Boolean);
	if (param.length) {
		const users = await getUsers(param);
		getUsers(param).then(function(users) {
			users.forEach(function(user) {
				if (!user) return;
				var index = focusList.map(''.toLowerCase).indexOf(user.toLowerCase());
				if (index < 0) {
					focusList.push(user);
					focused.push(user);
				} else {
					focusList.splice(index, 1);
					blurred.push(user);
				}
			});
			icb();
		});
	} else {
		if (focusList.length == 1) chatMsg(focusList[0] + ' is currently focused.');
		else if (focusList.length > 1) chatMsg(oxford(focusList) + ' are currently focused.');
		else chatMsg('No users are currently focused.');
		ok();
	}
});
commands['+docs'] = function(param) {
	var page = param.join(' ');
	window.open('http://pplus.ga/docs' + (page && 'earch?q='+encodeURIComponent(page)), '_blank');
	return Promise.resolve();
};
commands['+wiki'] = commands['+docs'];
commands['+help'] = commands['+docs'];
commands['cspl'] = (param) => new Promise(function(ok, err) {
	var cmd = param.shift();
	if (cmd != 'steal' && cmd != 'stealhsv') return ok('/cspl '+cmd+' '+param.join(' '));
	getUser(param.shift()).then(function(user) {
		if (!user) return err('Please specify a user.');
		getUser('Me').then(function(me) {
			getUser(param.shift()).then(function(you) {
				if (!you && aliases['Me']) you = me;
				if (!you) return err('Please specify your username.');
				if (you.includes('=')) return err('Please specify your username.');
				var usr = onlineList[user.toLowerCase()];
				if (!usr) return err("Couldn't find "+user+' on the online list.');
				you = you + '='; if (cmd == 'stealhsv') you = you + 'hsv:';
				$('#bericht').val('/cspl conf ' + (parseCspl(you + usr.cspl.join('/')))[0]);
				ok();
			});
		});
	});
});
commands['reply'] = function(param, dest) {
	if (!lastWhisp) return Promise.reject('You have not receieved any whispers recently.');
	return parsePost('/whisper '+lastWhisp+' '+param.join(' '), dest);
};
commands['r'] = commands['reply'];
commands['help'] = function() {
	chatMsg("Sorry. 3DSPlaza lied to you. That command doesn't exist. :(");
	return Promise.resolve();
};
// Get your mind out of the gutter! It's short for Study room PERMissions!
// And no, this was not intentional. XD
commands['sperm'] = (param) => new Promise(function(ok, err) {
	var cm = param.shift(), cmd: string = null;
	if (cm == 'scan' || cm == 'list') cmd = 'scan';
	else if (cm == 'grant' || cm == 'allow' || cm == '+') cmd = 'grant';
	else if (cm == 'revoke' || cm == 'deny' || cm == '-') cmd = 'revoke';
	else if (cm == 'test' || cm == 'check') cmd = 'test';
	else return err('Invalid command.');
	var room = param.shift();
	if (!room) {
		if (!chatroom.startsWith('v3study'))
			return err('Please specify a study room.');
		room = chatroom.substr(7);
	}
	if (cmd == 'scan') ok('/minipbatch scan chat.use.v3study'+room);
	else getUsers(param).then(function(users) {
		ok('/minipbatch '+cmd+' chat.use.v3study'+room+' '+users.join(' '));
	});
});
commands['/to'] = function(param) {
	return Promise.resolve(' //to ' + param.join(' '));
};
commands['thd'] = function(param) {
	window.open('/forums/topic.php?topic='+encodeURIComponent(param.shift()), '_blank');
	return Promise.resolve();
};
commands['noegg'] = function() {
	chatMsg('Eggs removed.');
	var evt = document.createEvent('Event');
	evt.initEvent('plusNoEgg', true, false);
	document.dispatchEvent(evt);
	return Promise.resolve();
};

function getUsers(users: string[]) {
	var usrs = users.map(function(user) {
		return getUser(user);
	});
	return Promise.all(usrs);
}

function setDest(dest?: Dest) {
	if (dest) {
		lockAsync();
		dest.test().then(function(info?: string) {
			if (info) chatMsg(info);
			boxes[active].dest = dest;
			freeAsync();
		}, function(err) {
			if (err) chatErr(err);
			freeAsync();
		});
	} else {
		$('#bericht').attr('placeholder', boxes[active].dest.info());
		$('#plusbtn'+active).attr('title', boxes[active].dest.info());
	}
}

function setActive(dest: number) {
	if (asyncLock > 0) return; // Guh.
	var be = <HTMLInputElement>$('#bericht')[0];
	boxes[active].text = $('#bericht').val();
	boxes[active].sel = [be.selectionStart, be.selectionEnd, be.selectionDirection];
	active = dest; setDest();
	$('.plusbox').removeClass('plusbox0 plusbox1 plusbox2 plusbox3 plusbox4').addClass('plusbox'+dest);
	$('.plusbtn').removeClass('plusact');
	$('#plusbtn'+dest).addClass('plusact');
	$('#bericht').val(boxes[dest].text).focus();
	// dammit chrome...
	var sel = boxes[dest].sel;
	be.setSelectionRange(sel[0], sel[1], sel[2]);
}

function sendChat(txt: string, raw?: boolean) {
	var old = $('#bericht').val(); $('#bericht').val(txt);
	if (raw) oldsp(); else sp(); $('#bericht').val(old);
}

function oxford(a: string[]) {
	if (a.length < 3) return a.join(' and ');
	return a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1];
}

import emotify from './func/emotify';

function getChat(str: string): string {
	switch (str.toLowerCase()) {
		case 'v3original': case 'original': case 'orig': return 'v3original';
		case 'v3rp': case 'rp': case 'rper': case 'roleplay': case 'roleplayer': return 'v3rp';
		case 'r9k': case 'robot9000': case 'r9000': case 'robot9k': return 'r9k';
		case 'mod': case 'modescape': return 'modescape';
	}
	if (str.startsWith('study')) return 'v3'+str;
	if (str.startsWith('v3study')) return str;
	return null;
}

function undoEmotes(v: string) {
	return v.replace(/<img src="(?:[^"]*)" alt="([^"]*)">/g, function(match, alt: string) {
		return alt.replace(/</g, '&lt;');
	});
}

interface User { user: string; tag?: string; }
function getUser(user: string) { return new Promise<string>(async function(ok, err) {
	const name = user.toLowerCase();
	try {
		let items = await storage.get('aliases');
		const usr = items['aliases'][name];
		if (!usr) return ok(user);
		ok(usr.user);
	} catch (e) {
		console.error('Failed to get aliases to find user.', user, e);
		ok(user);
	}
}); }

function stripHTML(v: string) {
	return v.replace(/<(?:.|\n)*?>/gm, '').replace(/&lt;/g, '<');
}

function lockAsync() {
	asyncLock = asyncLock + 1;
	if (asyncLock == 1) isFocus = $('#bericht').is(':focus');
	$('#bericht').val(''); $('#bericht').prop('disabled', true);
	$('#bericht').attr('placeholder', 'Please wait...');
}

function freeAsync() {
	asyncLock = Math.max(asyncLock - 1, 0);
	if (asyncLock > 0) return;
	$('#bericht').prop('disabled', false); setDest();
	if (isFocus) $('#bericht').focus();
}

type ChatMsg = ChatLine | string | void;
type ChatLine = {txt?: string, dest?: Dest};
function parsePost(txt: string, dest?: Dest): Promise<ChatLine> {
	var param = txt.split(' '), cmd = param.shift();
	if (cmd.charAt(0) != '/') return Promise.resolve({txt: emotify(txt), dest: dest});
	cmd = cmd.substr(1).toLowerCase();
	if (!commands[cmd]) {
		return Promise.resolve({txt: txt, dest: dest});
	}
	return new Promise(function(ok, err) {
		commands[cmd](param, dest).then(function(chat?: ChatMsg) {
			if (!chat) chat = {};
			if (typeof chat == 'string') chat = {txt: <string>chat};
			var line = <ChatLine>chat;
			if (!line.dest) line.dest = dest;
			ok(line);
		}, function(msg) { err(msg); });
	});
}

function sp() {
	var txt = $('#bericht').val(); if (!txt) return;
	lockAsync();
	parsePost(txt, boxes[active].dest).then(function(ret) {
		var txt = ret.txt, dest = ret.dest;
		if (!txt) return freeAsync();
		dest.test(true).then(function(msg?: string) {
			if (msg) chatMsg(msg);
			dest.send(txt).then(function(msg?: string) {
				if (msg) chatMsg(msg); freeAsync();
			}, function(msg) { chatErr(msg); console.log(msg); freeAsync(); });
		}, function(msg) { chatErr(msg); console.log(msg); freeAsync(); });
	});
}

import colorLerp from './func/colorLerp';
import parseColor from './func/parseColor';
import parseSeg from './func/parseSeg';
import parseCspl from './func/parseCspl';

$('#send').attr({'onclick': null}).click(function() { sp(); });
$('#bericht').attr({'onkeypress': null}).keydown(function(e) {
	if (asyncLock > 0) return false;
	var key = e.which, a = active, val = $('#bericht').val();
	if (key == 13) {
		if (val.startsWith('/cspl conf ')) {
			$('#bericht').val('/cspl conf '+parseCspl(val.substr(11), -1)[0]);
		}
		sp(); return false;
	} else if (key == 38) {
		a--; if (a == -1) a = 4;
	} else if (key == 40) {
		a++; if (a == 5) a = 0;
	} else return true;
	setActive(a);
	return false;
}).on('input', function() {
	if (!$('#bericht').val().startsWith('/cspl conf ')) return;
	var val = $('#bericht').val(), sel = (<HTMLInputElement>$('#bericht')[0]).selectionStart;
	var end = val.substr(sel - 1, 1);
	if (end != ' ' && end != '\\') return;
	if (end == '\\') val = val.substr(0, sel-1) + val.substr(sel);
	var csp = parseCspl(val.substr(11), sel - 11);
	var spc = val != '/cspl conf ' && val.substr(-1) == ' ';
	$('#bericht').val('/cspl conf ' + csp[0].trim() + (spc ? ' ' : ''));
	if (csp[1]) (<HTMLInputElement>$('#bericht')[0]).setSelectionRange(csp[2] + 12, csp[2] + 12);
});

// undefined means unknown; should only happen if using an RP tag with "play you are in"
function findUsername(tag: JQuery): string | undefined {
	// b is last child because of mod crowns
	tag = tag.children('b:last-child').children('u:only-child');
	if (!tag.length) return undefined;
	if (tag.find('span[style^="background"]').length) return undefined;
	var name = tag.children('span[style^="font"]:first-child');
	if (name.length) return name.text().split(' ').slice(-1)[0];
	else return tag.text().slice(0, -1);
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

var chatCheck = 0;
var chatThrottle = false;
function chatRead() {
	if (chatThrottle) return;
	chatThrottle = true;
	$($('#demo > div').not('[plused]').get().reverse()).each(function() {
		var line = $(this);
		var text = line.text();
		var html = $(this).html();
		line.prop('plused', true);
		var nametag = $(this).children('span:first-child');
		var name = findUsername(nametag);
		var idRegex = html.match(/<!---cmid:(\d+)-->/);
		var id = Number(idRegex ? idRegex[1] : -1);
		var msg = stripHTML(undoEmotes(html));
		if (name) msg = msg.substr(stripHTML(undoEmotes(nametag.html())).length);
		var wRegex = html.match(/<span style="font-size: 75%; background-color: cyan; opacity: 0\.75; color: blue;">to ([^<]+)<\/span>/);
		var whisper = wRegex ? wRegex[1] : undefined;
		var warn = !!html.match(/<span style="color: red;"><u>(! Warning (?:[^<]*) !)<\/u><\/span>/);
		if (whisper) msg = msg.replace(new RegExp('to '+escapeRegExp(whisper)+'$'), '');
		msg = msg.trim();
		var enc = false;
		if (msg.match(/^###ascii###( \d+)+$/)) {
			let reg = /(\d+)+/g, chr: RegExpExecArray, en = '';
			while ((chr = reg.exec(msg)) !== null) en += String.fromCharCode(Number(chr[1]));
			msg = en; enc = true;
		}
		var nregex = '(' + notifyNames.split(' ').filter(Boolean).map(escapeRegExp).join('|') + ')';
		var ment = nregex != "()" ? !!msg.match(new RegExp(nregex, 'i')) : undefined;
		var user = name ? name.toLowerCase() : undefined;
		var fay = user == 'fayne_aldan' && (whisper == 'you' || !whisper);
		if (whisper == 'you' && name) lastWhisp = name;
		if (id > chatCheck) {
			if (enc)
				line.before($('<div/>', {text: ': Chat decrypted: '+msg, css: {color: 'gray'}}), '<!--d-->');
			if (mainTab && chatCheck > 0) {
				if (id == -1) {} // Don't notify.
				else if (whisper == 'you' && notifyWhispers)
					sendMessage('notify', 'whisper', {user: name, msg: msg, warn: warn});
				else if (ment)
					sendMessage('notify', 'mention', {user: name, msg: msg, warn: warn});
			}
		}
		if (user) {
			let icon = $('<img>').addClass('plusicon');
			if (icons[user]) icon.attr('src', icons[user]);
			line.addClass('chatline');
			if (focusList.length > 0 && focusList.map(''.toLowerCase).indexOf(user)<0) line.addClass('blur');
			line.attr('user', user);
			line.prepend(icon, ' ');
		}
		line.linkify({ignoreTags: ['script']});
	});
	var idCheck = $('#demo').html().match(/<!---cmid:(\d+)-->/);
	if (idCheck) chatCheck = Number(idCheck[1]);
	setTimeout(() => chatThrottle = false, 0);
}
new MutationObserver(chatRead).observe($('#demo')[0], {childList: true});
chatRead();

interface OnlineUser {
	user: string, cspl: string[], conf: string, rank: string, away: boolean, timeout: boolean, ignore: boolean
}
var onlineList: Dict<OnlineUser> = {}, onlineCache: string | boolean = null;
var onlineTime: [number, number, number] = [0,0,0], onlineTimer: number = null;
var onlineThrottle = false;
function onlineRead() {
	if (onlineThrottle) return;
	onlineThrottle = true;
	var html = $('#online').html();
	if (onlineCache == html) return;
	if (onlineCache === true) return;
	var brarray = html.split('<br>'), online: Dict<OnlineUser> = {};
	var time = brarray.shift(); brarray.shift();
	onlineTime = [+time.substr(0, 2), +time.substr(3, 2), +time.substr(6, 2)];
	if (onlineTimer) window.clearInterval(onlineTimer);
	onlineTimer = window.setInterval(onlineUpd, 1000);
	if (html.match(/Warning:/)) online = onlineList;
	else
		brarray.slice(0,-1).forEach(function(v) {
			var rReg = v.match(/background-color: ([a-z]+);/);
			var rank: string = 'normal';
			if (rReg) rank = (function(){ switch (rReg[1]) {
				case 'cyan': return 'noob';
				case 'lime': return 'mod';
				case 'red': return 'banned';
				case 'black': return 'ignored';
				default: return 'normal';
			}})();
			var away = !!v.match(/opacity: 0.5;/), ignore = !!v.match(/<s>/);
			var to = !!v.match(/<img src="http:\/\/3dsplaza\.com\/global\/chat3\/to\.gif" alt="\[TO]">/);
			var user = '', cspl: string[] = [], conf: string[] = [], c: RegExpExecArray;
			var regex = /<span style="color:\s?(#?[A-Za-z0-9]*);">(.+?)<\/span>/g;
			while ((c = regex.exec(v)) !== null) {
				user += c[2];
				for (let i = 0; i < c[2].length; i++) {
					cspl.push(c[1]);
					conf.push(c[2][i]+'='+tinycolor(c[1]).toHexString());
				}
			}
			var csp = conf.join(' ');
			online[user.toLowerCase()] = {
				user: user, cspl: cspl, conf: csp, rank: rank, away: away, timeout: to, ignore: ignore
			};
		});
	onlineList = online;
	onlineWrite();
	setTimeout(() => onlineThrottle = false, 0);
};
function onlineUpd() {
	var time = onlineTime;
	time[2] = time[2] + 1;
	if (time[2] == 60) {
		time[2] = 0; time[1] = time[1] + 1;
		if (time[1] == 60) {
			time[1] = 0; time[0] = time[0] + 1;
			if (time[0] == 24) time[0] = 0;
		}
	}
	var tm = time.map(function(v) { return ('0'+v).substr(-2); }).join(':');
	onlineCache = true;
	$('#onlineTime').text(tm);
	onlineCache = $('#online').html();
}
function onlineWrite() {
	onlineCache = true;
	$('#online').text('').append(
		$('<u/>', {text: 'Users Online'}),
		$('<span/>', {
			id: 'onlineTime', css: {'float': 'right'},
			text: onlineTime.map(function(v) { return ('0'+v).substr(-2); }).join(':')
		})
	);
	function entry(user: OnlineUser, div: JQuery) {
		var udiv = $('<div/>').appendTo(div);
		var clr = (function() { switch (user.rank) {
			case 'noob': return colorNoob;
			case 'mod': return colorMod;
			case 'banned': return colorBanned;
			case 'ignored': return colorIgnored;
			default: return colorNormal;
		}})();
		var btn = $('<div/>', {css: {
			display: 'inline-block', width: 5, height: 5, backgroundColor: clr, border: '2px solid '+clr
		}}).click(function() {
			$('#morepane iframe').attr('src', 'nav.php?loc=user&who='+user.user);
			$('#bm').click();
		}).appendTo(udiv); if (user.away) btn.css({opacity: 0.5, borderColor: 'gray'});
		if (user.timeout)
			udiv.append(' ', $('<img>', {src: 'http://3dsplaza.com/global/chat3/to.gif', alt: '[TO]'}));
		udiv.append(' ');
		var name = $('<a/>', {href: '../members/view_profile.php?user='+user.user}).appendTo(udiv);
		name.css('fontSize', '90%').attr('target', '_top');
		if (user.away) name.css('opacity', 0.5);
		name = $('<b/>').appendTo(name);
		if (user.ignore) name = $('<s/>').appendTo(name);
		user.conf.split(' ').forEach(function(seg) {
			var colors = seg.split('=');
			name.append($('<span/>', {text: colors.shift(), css: {color: colors.join('=')}}));
		});
	}
	type OnlineGrouped = {mod: OnlineUser[], normal: OnlineUser[], banned: OnlineUser[]};
	function section(id: keyof OnlineGrouped, title?: string) {
		var div = $('#online');
		if (!group[id]) return;
		if (title) {
			$('<div/>', {text: title, 'class': 'onlinehead'}).appendTo('#online');
			div = $('<div/>').appendTo('#online');
		}
		group[id].forEach(function(user) { entry(user, div); });
	}
	var group: OnlineGrouped = {mod: [], normal: [], banned: []};
	for (let k in onlineList) {
		let v = onlineList[k];
		switch (v.rank) {
			case 'mod': group.mod.push(v);
			case 'banned': group.banned.push(v);
			default: group.normal.push(v);
		}
	}
	if (onlineSort) {
		section('mod', 'Chat Mods');
		section('normal', 'Normal Users');
		section('banned', 'Banned Users');
	} else for (let k in onlineList) {
		entry(onlineList[k], $('#online'));
	}
	onlineCache = $('#online').html();
}
new MutationObserver(onlineRead).observe($('#online')[0], {childList: true});

// emoticon picker
function appendToTextbox(text: string){
	var be = <HTMLInputElement>$('#bericht')[0], start = be.selectionStart, end = be.selectionEnd;
	var txt = $('#bericht').val(), range = start + text.length;
	$('#bericht').val(txt.substring(0, start) + text + txt.substr(end)).focus();
	be.setSelectionRange(range, range);
}

interface EmoteDict { [c: string]: EmoteCat; }
type EmoteCat = Emote[];
interface Emote {
	n: string, i: string;
}

var emoticons: EmoteDict = {
	'Faces': [
		{n: ':)', i: 'happy.gif'},
		{n: ':D', i: 'icon_cheesygrin.gif'},
		{n: ';)', i: 'icon_wink.gif'},
		{n: ':S', i: 'icon_confused.gif'},
		{n: ':@', i: 'icon_mad.gif'},
		{n: "-_-'", i: 'buy_sweat.png'},
		{n: ':O', i: 'icon_amazed.gif'},
		{n: 'xD', i: 'ecksdee.png'},
		{n: ':fp:', i: 'icon_facepalm.gif'},
		{n: 'R:', i: 'epic.png'},
		{n: 'RB:', i: 'rbow.png'},
		{n: 'R(', i: 'icon_unknown1.png'},
		{n: ':ponything:', i: 'icon_ponything.jpg'},
		{n: ':dummy:', i: 'reklshum.gif'},
		{n: ':nuu:', i: 'nuu.gif'}
	], 'Memes': [
		{n: ':troll:', i: 'icon_trollface.png'},
		{n: ':lol:', i: 'lol.png'},
		{n: ':megusta:', i: 'icon_megusta.jpg'},
		{n: ':no:', i: 'no.png'},
		{n: ':raeg:', i: 'raeg.png'},
		{n: ':pface:', i: 'pokerface.png'},
		{n: ':falone:', i: 'icon_foreveralone.jpg'},
		{n: ':ohplz:', i: 'please.png'},
		{n: ':ydsay:', i: 'buy_youdontsay.png'},
		{n: ':doge:', i: 'doge.png'}
	], 'Other': [
		{n: '@<3@', i: 'icon_bheart.gif'},
		{n: ':yoshi:', i: 'buy_yoshi.png'},
		{n: ':msonic:', i: 'buy_sonic.png'},
		{n: ':pball:', i: 'buy_pokeball.jpg'},
		{n: ':file:', i: 'icon_file.png'},
		{n: '//to do', i: 'icon_todo.png'},
		{n: ':cake:', i: 'icon_cake.gif'},
		{n: ':mario:', i: 'icon_mario.png'},
		{n: ':luigi:', i: 'icon_luigi.png'},
		{n: ':ds:', i: 'icon_ds.gif'},
		{n: ':burger:', i: 'icon_burger.gif'},
		{n: ':taco:', i: 'icon_taco.gif'},
		{n: ':icecream:', i: 'icon_icecream.gif'},
		{n: '[woofie!]', i: 'wolfthing.gif'}
	]
};

$('body').append(
	$('<div/>', {id: 'plus-emoticonPicker'}),
	$('<div/>', {id: 'plus-emoticonPickerBtn'})
);

$('#plus-emoticonPickerBtn').click(function() {
	$('#plus-emoticonPicker, #plus-emoticonPickerBtn').toggleClass('active');
});

for (let name in emoticons) {
	let cat = emoticons[name];
	$('#plus-emoticonPicker').append($('<hr>', {title: name}));
	cat.forEach(function(emote) {
		var img = $('<img>', { src: chrome.extension.getURL('res/emotes/'+emote.i) });
		img.click(function() { appendToTextbox(emote.n); }).attr('title', emote.n);
		$("#plus-emoticonPicker").append(img);
	});
}

// imgur uploader
$('body').append(
	$('<input/>', {id: 'plus-imgurUploadInput', type: 'file'}).hide(),
	$('<div/>', {id: 'plus-imgurUploadBtn'}).click(function() {
		$('#plus-imgurUploadInput').click();
	})
);

function uploadToImgur(file: File) {
	var fd = new FormData(); fd.append('image', file);
	var xhr = $.ajax('https://api.imgur.com/3/image.json', {
		type: 'POST', data: fd, processData: false, contentType: false,
		headers: {Authorization: 'Client-ID 0609f1f5d0e4a2b'}, dataType: 'json',
		xhr: function() {
			var xhr = new XMLHttpRequest();
			xhr.upload.addEventListener('progress', function(evt: ProgressEvent) {
				$('#plus_imgurUploadingBarPercentage').css('width', Math.round(evt.loaded / evt.total * 100) + '%');
			}, false);
			return xhr;
		},
		success: function(resp) {
			if (!resp.success) {
				var err = resp.data ? '\n"' + resp.data.error + '"' : '';
				chatErr('An error occured while uploading to Imgur: ' + err);
			} else appendToTextbox(resp.data.link);
		},
		error: function(xhr, stat) {
			if (stat == 'abort') return;
			chatErr('An unknown error occured while uploading to Imgur.');
		},
		complete: function() {
			$('#plus-imgurUploadInput').val('');
			$('#plus_imgurUploading').fadeOut(400, function() { $(this).remove(); });
		}
	});

	$('body').append(
		$('<div/>', {id: 'plus_imgurUploading', text: 'Uploading to Imgur...'}).append(
			$('<div/>', {id: 'plus_imgurUploadingBar'}).html('').append(
				$('<div/>', {id: 'plus_imgurUploadingBarPercentage'})
			),
			$('<div/>', {id: 'plus_imgurCancelUpload', text: 'Cancel'}).click(function() {
				xhr.abort();
			})
		)
	);
}

$('#plus-imgurUploadInput').change(function() { uploadToImgur((<HTMLInputElement>$(this)[0]).files[0]); });

$(document).on('paste', function(evt) {
	var items = (<ClipboardEvent>evt.originalEvent).clipboardData.items, blob: File = null;
	for (let k in items)
		if (items[k].type.startsWith('image')) blob = items[k].getAsFile();

	if (blob) {
		var reader = new FileReader();
		reader.onload = function() {
			uploadToImgur(reader.result.replace(/^data:image\/(png|jpg);base64,/, ""));
		};
		reader.readAsDataURL(blob);
	}
});

setTimeout(() => {
	if ($('#ptSettings').length) chatErr('Notice: PlazaTools has been discontinued and is no longer compatible with Plaza+. It is recommended that you uninstall PlazaTools.');
}, 0);

chatMsg('Welcome to Plaza+! Type /+wiki to open the wiki.');
