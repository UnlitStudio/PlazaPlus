import * as _ from 'lodash';
import * as $ from 'jquery';
import * as tinycolor from 'tinycolor2';
import * as Autolinker from 'autolinker';
import Enums from './enums';
import {sendMsgFactory, listenForMsgs, MsgListenReg} from './func/portHelpers';
import {storageListen} from './helpers/storage';
import {Dict, IDict} from './helpers/types';

var chatIns = _.rest(function(objs: any[]) {
	$('#demo').prepend(_.concat(objs, '<br>', '<!--d-->'));
});
// Wrapped because I don't exactly want to keep canRun in memory.
(function(){
	// Make sure Plaza+ has all it needs to function.
	var canRun =
		$('#demo').length === 0 ? false :
		$('#online').length === 0 ? 'The chat did not load correctly. Please refresh.' :
		$('#bericht').length === 0 ? 'You must be logged in and not banned to use Plaza+.' :
		$('.plazaPlusRunning').length > 0 ? 'Plaza+ is somehow already running in this tab.' :
		true;
	// Is throwing an error the best way to terminate a content script?
	// I don't want to have to wrap the whole script in a function.
	if (canRun === false) throw new Error('The chat did not load correctly. Please refresh.');
	else if (_.isString(canRun)) {
		$('#demo').prepend($('<span/>', {text: ': '+canRun, css: {color: 'red'}}), '<br>', '<!--d-->');
		throw new Error(canRun);
	}
})();

import './chat.less';

function chatMsg(msg: string) {
	chatIns($('<span/>', {text: ': '+msg, css: {color: 'gray'}}));
}
function chatErr(msg: string) {
	chatIns($('<span/>', {text: ': '+msg, css: {color: 'red'}}));
}
function microtime() {
	var now = _.now() / 1000, s = parseInt(String(now), 10);
	return (Math.round((now - s) * 1000) / 1000) + ' ' + s;
}
interface Alias { name: string; tag: string; }

var chatroom = (/\?room=(.*)/.exec($('.contain_inside form').attr('action')) || ['','v3original'])[1];
var port = chrome.runtime.connect({name: 'chat:'+chatroom}), mainTab = false;
var active = 0, boxes: TextBox[] = [], icons: Dict<string> = {}, aliases: Dict<Alias> = {};
var focusList: string[] = [], focusMode = 'blur', isFocus = false, asyncLock = 0, notifyNames = '';
var notifyWhispers = false, lastWhisp: string = null, onlineSort = false;
var colorNormal = '#0000ff', colorNoob = '#00ffff', colorMod = '#00ff00';
var colorBanned = '#ff0000', colorIgnored = '#000000';

// Chrome doesn't allow unsafeWindow. D:<
// Instead, we have to inject an event listener into the page.
var oldsp: () => void;
(function() {
	var s = document.createElement('script');
	s.src = chrome.extension.getURL('res/chatInject.js');
	s.onload = function() { $(this).remove(); };
	document.body.appendChild(s);
	var evt = document.createEvent('Event');
	evt.initEvent('plusSendChat', true, false);
	oldsp = function() { document.dispatchEvent(evt); };
})();

if (!chrome.storage.sync) chrome.storage.sync = chrome.storage.local;

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

var linker = new Autolinker({stripPrefix: false, twitter: false, phone: false});

storageListen({
	iconCache(v) {
		icons = v; $('.plusicon').attr('src', null);
		_.each(v, function(v, k) {
			$('.chatline[user="'+_.toLower(k)+'"] .plusicon').attr('src', v);
		});
	}
}, {
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
_.times(3, function(i) { $('<style/>', {id: 'pluscss'+i}).appendTo('head'); });
$('<span/>', {id: 'plazaPlusRunning'}).appendTo('body');
$('#bericht, #send').addClass('plusbox plusbox0');
$('form:first').html('Change your name color:<br>').append(
	$('<input>', {name: 'color', type: 'text'}).change(function() {
		var col = parseColor($(this).val()); if (col) $(this).val(col.toHexString());
	}),
	$('<input>', {name: 'color_change', type: 'submit', val: '>'}),
	'<br>'
); $('<div/>', {id: 'plusbar'}).appendTo('body');

type BoxSel = [number, number, 'forward' | 'backward' | 'none'];
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
				if (_.includes(d, 'This user does not seem to exist.'))
					err('The user '+user+" doesn't exist.");
				else if (_.includes(d, 'You cannot whisper'))
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
					if (_.includes(d, 'Your message has been sent succesfully!'))
						ok('sent');
					else if (_.includes(d, 'You are currently banned'))
						err("You can't send PMs while banned.");
					else if (_.includes(d, " doesn't exist!")) err('The user '+user+" doesn't exist.");
					else if (_.includes(d, 'friends can send PMs to'))
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
_.times(5, function(n) {
	var box = new TextBox(new DestChat()), title = box.dest.info();
	boxes.push(box);
	$('<div/>', {class: 'plusbtn', id: 'plusbtn'+n}).click(function() { setActive(n); })
		.append('<div/>').attr('title', 'Chat').appendTo('#plusbar');
});
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
		// witty 1 liners amirite?
		if (!user) return err('Please specify a user.');
		$.ajax('../chat3/nav.php', {
			data: {loc: 'user', who: user}, success: function(d) {
				var id = d.match(/'\/INTERNAL-ignore (?:\+|-) (\d+)';/);
				if (_.includes(d, 'This user does not seem to exist.'))
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
				if (_.includes(d, 'This user does not seem to exist.'))
					err('The user '+user+" doesn't exist.");
				else if (id) sendChat('/INTERNAL-ignore - ' + id[1]);
				else err('Failed to retrieve '+user+"'s member ID.");
				ok();
			}, timeout: 3000, dataType: 'text',
			error: function() { err('Failed to retrieve '+user+"'s member ID."); }
		});
	});
});
commands['overraeg'] = (param) => Promise.resolve('/raeg ' + _.repeat(':)', 20));
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
/*
commands.pm = function(cb, param) { getUser(param.shift(), function(user, tag) {
	if (!user) return cb(chatErr('Please specify a user.'));
	var subj = param.join(' ');
	if (!subj) return cb(chatErr('Please specify a subject.'));
	var dest = {type: 'pm', user: user, subj: emotify(subj).substr(0, 50)};
	cb(setDest(dest));
}); };
commands.alias = function(cb, param) {
	var tag = param.shift(), user = param.shift(), name = _.toLower(tag || '');
	if (!tag)
		return cb(chatMsg(
			aliases.length ?
				'Aliases: ' + oxford(_.map(aliases, _.template('<%= tag %> is <%= user %>'))) :
			'No aliases are set.'
		));
	else if (user) {
		aliases[name] = {tag: tag, user: user}; chatMsg('Alias '+tag+' has been set to '+user+'.');
	} else if (aliases[name]) {
		delete aliases[name]; chatMsg('Alias '+tag+' has been deleted.');
	} else return cb(chatMsg('Alias '+tag+' is not set.'));
	chrome.storage.sync.set({aliases: aliases}, function() {
		if (chrome.runtime.lastError) chatErr('Failed to save aliases: ' + chrome.runtime.lastError);
		cb();
	});
};
commands.room = function(cb, param) {
	var room = param.shift();
	if (!room) return cb(chatErr('Please specify a chatroom.'));
	var chat = getChat(room);
	if (!chat) return cb(chatErr(room+' is not a valid chatroom.'));
	window.open('chat.php?room='+chat, '_top');
	$('#bericht').attr('placeholder', 'Switching chatrooms...');
};
commands.transfer = function(cb, param) {
	var amt = param.shift();
	if (!amt) return cb(chatErr('Please specify an amount of points to transfer.'));
	getUser(param.shift(), function(user) {
		if (!user) return cb(chatErr('Please specify a user to transfer points to.'));
		$.ajax('/apps/points_transfer/transfer_process.php', {
			type: 'POST', data: {amount: amt, to: user, checktime: microtime()}, success: function(d) {
				if (_.includes(d, 'You cannot transfer points to yourself!'))
					cb(chatErr('Are you trying to be greedy? Give those points to someone else!'));
				else if (_.includes(d, 'The user you entered doesnt exist!'))
					cb(chatErr('The user '+name+" doesn't exist."));
				else if (
					_.includes(d, 'You dont have enough points to transfer!') ||
					_.includes(d, 'bigger than the amount you can transfer!')
				) cb(chatErr("You're not a wizard. No transferring points you don't have."));
				else if (_.includes(d, 'You can only send whole points'))
					cb(chatErr("Points aren't cookies. They must be given whole."));
				else if (_.includes(d, 'You havent entered the amount to transfer'))
					cb(chatErr("Why enter this command if you're not transferring any points?"));
				else if (_.includes(d, 'You can not transfer less than 1 point!'))
					cb(chatErr("Don't make me divide by 0!"));
				else if (_.includes(d, 'The ammount of points you entered is not a number'))
					cb(chatErr("Woah! That's a number now?! :O"));
				else if (_.includes(d, 'Successfully transferred'))
					cb(chatMsg('Successfully transferred '+amt+' point'+(amt>1?'s':'')+' to '+user+'!'));
				else cb(chatErr('An error occurred while transferring.'));
			}, timeout: 3000, dataType: 'text', error: function() {
				cb(chatMsg("Plaza+ can't confirm that the point transfer was successful."));
			}
		});
	});
};
commands.slap = function(cb, param) {
	var item = _.sample(['fish','gym sock','skunk','diaper','cheese wedge']);
	cb('/me slaps '+param.join(' ')+' with a smelly '+item+'.');
};
commands.rptag = function(cb, param) {
	var tag = param.join(' ');
	if (!tag)
		$.ajax('../chat3/nav.php?loc=rptags&drop=', {
			success: function(d) {
				if (_.includes(d, '<br>Dropped<br>')) cb(chatMsg('Your RP tag has been dropped.'));
				else cb(chatErr('An error occurred while trying to drop your RP tag.'));
			}, timeout: 3000, dataType: 'text',
			error: function() { cb(chatMsg("Plaza+ can't confirm that your RP tag was dropped.")); }
		});
	else if (tag.length < 2) cb(chatErr('RP tags must be at least 2 characters long.'));
	else if (tag.length > 15) cb(chatErr("RP tags can't be over 15 characters long."));
	else
		$.ajax('../chat3/nav.php?loc=rptags', {
			type: 'POST', data: {play: '', role: tag, set: 'Set RP tags'}, success: function(d) {
				if (_.includes(d, '<br>Set<br>')) cb(chatMsg('Your RP tag has been set to '+tag+'.'));
				else cb(chatErr('An error occurred while trying to set your RP tag.'));
			}, timeout: 3000, dataType: 'text',
			error: function() { cb(chatMsg("Plaza+ can't confirm that your RP tag was set.")); }
		});
};
commands.focus = function(cb, param) {
	var focused = [], blurred = [], action = param.shift();
	function icb() {
		$('#pluscss2').text((function() { switch (focusMode) {
			case 'blur': return '.blur{filter:blur(1px);-webkit-filter:blur(1px)}.blur:hover{filter:initial;-webkit-filter:initial}';
			case 'shrink':
				return '.blur{font-size:8px;background-color:lightgray;display:block}.blur img{height:8px;width:auto}';
			default: return '.blur{display:none}';
		} })());
		var out = [];
		if (focused.length == 1) out.push(focused[0]+" has been focused");
		else if (focused.length > 1) out.push(oxford(focused) + " have been focused");
		if (blurred.length == 1) out.push(blurred[0]+" has been blurred");
		else if (blurred.length > 1) out.push(oxford(blurred) + " have been blurred");
		if (out.length > 0) chatMsg(oxford(out) + '.');
		$('.chatline').each(function() {
			if (focusList.length === 0) return $(this).removeClass('blur');
			var user = $(this).attr('user');
			if (!user) return $(this).addClass('blur');
			if (_.includes(_.map(focusList, _.toLower), _.toLower(user))) $(this).removeClass('blur');
			else $(this).addClass('blur');
		});
		cb();
	}
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
	param.unshift(action); param = _.compact(param);
	if (param.length)
		getUsers(param).then(function(users) {
			_.each(users, function(user) {
				if (!user) return;
				var index = _.indexOf(_.map(focusList, _.toLower), _.toLower(user));
				if (index == -1) { focusList.push(user); focused.push(user); }
				else { focusList.splice(index, 1); blurred.push(user); }
			}); icb();
		});
	else {
		if (focusList.length == 1) cb(chatMsg(focusList[0] + ' is currently focused.'));
		else if (focusList.length > 1) cb(chatMsg(oxford(focusList) + ' are currently focused.'));
		else cb(chatMsg('No users are currently focused.'));
	}
};
commands['+help'] = function(cb, param) { cb(sendMessage('openHelp', param.shift())); };
commands.cspl = function(cb, param) {
	var cmd = param.shift();
	if (cmd != 'steal' && cmd != 'stealhsv') return cb('/cspl '+cmd+' '+param.join(' '));
	getUser(param.shift(), function(user) {
		if (!user) return cb(chatErr('Please specify a user.'));
		getUser('Me', function(me, meh) {
			getUser(param.shift(), function(you) {
				if (!you && meh) you = me;
				if (!you) return cb(chatErr('Please specify your username.'));
				if (_.includes(you, '=')) return cb(chatErr('Please specify your username.'));
				var usr = onlineList[_.toLower(user)];
				if (!usr) return cb(chatErr("Couldn't find "+user+' on the online list.'));
				you = you + '='; if (cmd == 'stealhsv') you = you + 'hsv:';
				$('#bericht').val('/cspl conf ' + (parseCspl(you + usr.cspl.join('/')))[0]);
				cb();
			});
		});
	});
};
commands.reply = function(cb, param, dest) {
	if (!lastWhisp) return cb(chatErr('You have not receieved any whispers recently.'));
	parsePost('/whisper '+lastWhisp+' '+param.join(' '), dest, cb);
};
commands.r = commands.reply;
commands.help = function(cb) {
	cb(chatMsg("Sorry. 3DSPlaza lied to you. That command doesn't exist. :("));
};
// Get your mind out of the gutter! It's short for Study room PERMissions!
// And no, this was not intentional. XD
commands.sperm = function(cb, param) {
	var cm = param.shift(), cmd = false;
	if (cm == 'scan' || cm == 'list') cmd = 'scan';
	else if (cm == 'grant' || cm == 'allow' || cm == '+') cmd = 'grant';
	else if (cm == 'revoke' || cm == 'deny' || cm == '-') cmd = 'revoke';
	else if (cm == 'test' || cm == 'check') cmd = 'test';
	if (!cmd) return cb(chatErr('Invalid command.'));
	var room = param.shift();
	if (!room) {
		if (!_.startsWith(chatroom, 'v3study')) return cb(chatErr('Please specify a study room.'));
		room = chatroom.substr(7);
	}
	if (cmd == 'scan') cb('/minipbatch scan chat.use.v3study'+room);
	else getUsers(param).then(function(users) {
		cb('/minipbatch '+cmd+' chat.use.v3study'+room+' '+users.join(' '));
	});
};
*/

function getUsers(users: string[]) {
	return Promise.all(_.map(users, function(user) {
		return getUser(user);
	}));
}

function setDest(dest?: Dest) {
	if (dest) {
		lockAsync();
		dest.test().then(function(info?: string) {
			if (info) chatMsg(info);
			boxes[active].dest = dest;
			freeAsync();
		}, function(err) { chatErr(err); });
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
	return a.length < 3 ? _.join(a, ' and ') : _.join(_.initial(a), ', ') + ', and ' + _.last(a);
}

import emotify from './func/emotify';

function getChat(str: string): string {
	switch (_.toLower(str)) {
		case 'v3original': case 'original': case 'orig': return 'v3original';
		case 'v3rp': case 'rp': case 'rper': case 'roleplay': case 'roleplayer': return 'v3rp';
		case 'v3rpaux': case 'rpaux': case 'auxrp': return 'v3rpaux';
		case 'r9k': case 'robot9000': case 'r9000': case 'robot9k': return 'r9k';
		default: return null;
	}
}

function undoEmotes(v: string) {
	return v.replace(/<img src="(?:[^"]*)" alt="([^"]*)">/g, function(match, alt) {
		return _.escape(alt);
	});
}

interface User { user: string; tag?: string; }
function getUser(user: string) { return new Promise<string>(function(ok, err) {
	var name = _.toLower(user);
	chrome.storage.sync.get('aliases', function(items) {
		var usr = items['aliases'][name];
		if (!usr) return ok(user);
		ok(usr.user);
	});
}); }

function stripHTML(v: string) {
	return _.unescape(v.replace(/<(?:.|\n)*?>/gm, ''));
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
	cmd = _.toLower(cmd.substr(1));
	if (!commands[cmd]) {
		return Promise.resolve({txt: txt, dest: dest});
	}
	return new Promise(function(ok, err) {
		commands[cmd](param, dest).then(function(chat?: ChatMsg) {
			if (!chat) chat = {};
			if (_.isString(chat)) chat = {txt: <string>chat};
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
		if (_.startsWith(val, '/cspl conf ')) {
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
	if (!_.startsWith($('#bericht').val(), '/cspl conf ')) return;
	var val = $('#bericht').val(), sel = (<HTMLInputElement>$('#bericht')[0]).selectionStart;
	var end = val.substr(sel - 1, 1);
	if (end != ' ' && end != '\\') return;
	if (end == '\\') val = val.substr(0, sel-1) + val.substr(sel);
	var csp = parseCspl(val.substr(11), sel - 11);
	var spc = val != '/cspl conf ' && val.substr(-1) == ' ';
	$('#bericht').val('/cspl conf ' + _.trim(csp[0]) + (spc ? ' ' : ''));
	if (csp[1]) (<HTMLInputElement>$('#bericht')[0]).setSelectionRange(csp[2] + 12, csp[2] + 12);
});

var chatCache: string = null, chatCheck = 0;
var chatRead = _.throttle(function() {
	var html = $('#demo').html();
	if (chatCache == html) return;
	var brarray = html.split('<!--d-->'), whisp: string = null;
	if (brarray[0].substr(0, 9) == 'undefined') {
		setTimeout(function() { chatErr('Failed to retrieve messages.'); }, 0);
		brarray[0] = brarray[0].substr(9);
	}
	var res = _.map(_.take(brarray, 75), function(v) {
		if (_.includes(v, '<!--plused-->')) return v;
		var uRegex = v.match(/(?:<b><u(?: oncontextmenu="[^"]+")?>(?:<span style="font-size: 85%;">(?:\[(?:.+)\] )?)?(.+?)(?:<\/span> as (?:.*?))?:?<\/u><\/b>)/);
		var name = uRegex ? _.trim(stripHTML(uRegex[1])) : null;
		var idRegex = v.match(/<!---cmid:(\d+)-->/);
		var idCheck: number = _.toInteger(idRegex ? idRegex[1] : -1);
		var user = name;
		var msg = undoEmotes(v.replace(/<span style="color: (.*?)<\/u><\/b><\/span>/, ''));
		msg = _.trim(_.trim(stripHTML(msg)));
		var wRegex = v.match(/<span style="font-size: 75%; background-color: cyan; opacity: 0\.75; color: blue;">to ([^<]+)<\/span>/);
		var whisper = wRegex ? wRegex[1] : null;
		var warnRegex = v.match(/<span style="color: red;"><u>(! Warning (?:[^<]*) !)<\/u><\/span>/);
		if (warnRegex) msg = _.trim(stripHTML(undoEmotes(warnRegex[1])));
		var enc = false, warnCheck = !!warnRegex;
		if (whisper) msg = _.trim(msg.replace(new RegExp('to '+_.escapeRegExp(whisper)+'$'), ''));
		if (msg.match(/^###ascii###( \d+)+$/)) (function() {
			var reg = /(\d+)+/g, chr: RegExpExecArray; var en = '';
			while ((chr = reg.exec(msg)) !== null) en += String.fromCharCode(_.toNumber(chr[1]));
			msg = en; enc = true;
		})();
		var nregex = '(' + _.join(_.map(_.compact(_.split(notifyNames, ' ')), _.escapeRegExp), '|') + ')';
		var ment = nregex != "()" ? !!msg.match(new RegExp(nregex, 'i')) : false;
		name = user ? _.toLower(user) : null;
		var fay = name == 'fayne_aldan' && (whisper == 'you' || !whisper);
		if (whisper == 'you' && user && !whisp) whisp = user;
		if (idCheck > chatCheck) {
			if (enc)
				setTimeout(function() {
					chatMsg('Chat' + (user ? ' from '+user : '') + ' decrypted: '+msg);
				}, 0);
			if (mainTab && chatCache) {
				if (idCheck == -1) {} // Don't notify.
				else if (fay && _.includes(msg, '!+check')) (function() {
					var vers = chrome.runtime.getManifest().version_name;
					sendChat(`/whisperto ${user} Using Plaza+ ${vers}`, true);
				})();
				else if (whisper == 'you' && notifyWhispers)
					sendMessage('notify', 'whisper', {user: user, msg: msg, warn: warnCheck});
				else if (ment)
					sendMessage('notify', 'mention', {user: user, msg: msg, warn: warnCheck});
			}
		} else if (idCheck == chatCheck) {
			return '';
		}
		if (name) {
			var i = 'class="plusicon"';
			if (icons[name]) i += ' src="' + icons[name] + '"';
			var b = 'chatline';
			if (focusList.length > 0 && !_.includes(_.map(focusList, _.toLower), name)) b += ' blur';
			v = '<!--plused-->'+v.replace(/^<div>/, '<div class="'+b+'" user="'+name+'"><img '+i+'> ');
		} else v = '<!--plused-->' + v;
		if (_.includes(v, '<script')) return v;
		return linker.link(v);
	});
	if (whisp) lastWhisp = whisp;
	chatCache = _.join(res, '<!--d-->'); var idCheck = chatCache.match(/<!---cmid:(\d+)-->/);
	if (idCheck) chatCheck = _.toNumber(idCheck[1]);
	$('#demo').html(chatCache);
});
chatRead(); new MutationObserver(chatRead).observe($('#demo')[0], {childList: true});

interface OnlineUser {
	user: string, cspl: string[], conf: string, rank: string, away: boolean, timeout: boolean, ignore: boolean
}
var onlineList: Dict<OnlineUser> = {}, onlineCache: string | boolean = null;
var onlineTime: [number, number, number] = [0,0,0], onlineTimer: number = null;
var onlineRead = _.throttle(function() {
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
		_.each(_.initial(brarray), function(v) {
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
				_.times(c[2].length, function(i) { // jshint ignore:line
					cspl.push(c[1]);
					conf.push(c[2][i]+'='+tinycolor(c[1]).toHexString());
				});
			}
			var csp = conf.join(' ');
			online[_.toLower(user)] = {
				user: user, cspl: cspl, conf: csp, rank: rank, away: away, timeout: to, ignore: ignore
			};
		});
	onlineList = online;
	onlineWrite();
});
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
	var tm = _.map(time, function(v) { return ('0'+v).substr(-2); }).join(':');
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
			text: _.map(onlineTime, function(v) { return ('0'+v).substr(-2); }).join(':')
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
		_.each(user.conf.split(' '), function(seg) {
			var colors = seg.split('=');
			name.append($('<span/>', {text: colors.shift(), css: {color: colors.join('=')}}));
		});
	}
	function section(id: string, title?: string) {
		var div = $('#online');
		if (!group[id]) return;
		if (title) {
			$('<div/>', {text: title, 'class': 'onlinehead'}).appendTo('#online');
			div = $('<div/>').appendTo('#online');
		}
		_.each(group[id], function(user) { entry(user, div); });
	}
	var group = _.groupBy(onlineList, function(v) {
		var r = v.rank;
		return r == 'mod' ? 'mod' : r == 'banned' ? 'banned' : 'normal';
	});
	if (onlineSort) {
		section('mod', 'Chat Mods');
		section('normal', 'Normal Users');
		section('banned', 'Banned Users');
	} else _.each(onlineList, _.partial(entry, _, $('#online')));
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

var emoticons = {
	Faces: [
		{n: ':)', w: 15, h: 15, p: '-1px -17px'},
		{n: ':D', w: 15, h: 15, p: '-17px -17px'},
		{n: ';)', w: 15, h: 15, p: '-33px -17px'},
		{n: ':S', w: 15, h: 15, p: '-49px -17px'},
		{n: ':@', w: 15, h: 15, p: '-81px -17px'},
		{n: "-_-'", w: 15, h: 15, p: '-40px -53px'},
		{n: ':O', w: 16, h: 16, p: '-1px -33px'},
		{n: 'xD', w: 16, h: 16, p: '-18px -33px'},
		{n: ':fp:', w: 19, h: 19, p: '-35px -33px'},
		{n: 'R:', w: 16, h: 16, p: '-55px -33px'},
		{n: 'RB:', w: 16, h: 16, p: '-72px -33px'},
		{n: 'R(', w: 16, h: 16, p: '-89px -33px'},
		{n: ':ponything:', w: 16, h: 23, p: '-109px -90px'},
		{n: ':dummy:', w: 21, h: 16, p: '-1px -53px'},
		{n: ':nuu:', w: 16, h: 16, p: '-23px -53px'}
	], Memes: [
		{n: ':troll:', w: 18, h: 15, p: '-1px -70px'},
		{n: ':lol:', w: 17, h: 20, p: '-20px -70px'},
		{n: ':megusta:', w: 22, h: 23, p: '-38px -70px'},
		{n: ':no:', w: 20, h: 20, p: '-61px -70px'},
		{n: ':raeg:', w: 20, h: 20, p: '-61px -91px'},
		{n: ':pface:', w: 14, h: 19, p: '-82px -70px'},
		{n: ':falone:', w: 26, h: 24, p: '-82px -90px'},
		{n: ':ohplz:', w: 17, h: 19, p: '-1px -94px'},
		{n: ':ydsay:', w: 20, h: 16, p: '-19px -94px'},
		{n: ':doge:', w: 20, h: 20, p: '-97px -69px'}
	], Other: [
		{n: '@<3@', w: 15, h: 13, p: '-61px -114px'},
		{n: ':yoshi:', w: 16, h: 16, p: '-1px -114px'},
		{n: ':msonic:', w: 16, h: 16, p: '-18px -114px'},
		{n: ':pball:', w: 14, h: 15, p: '-35px -114px'},
		{n: ':file:', w: 10, h: 14, p: '-50px -114px'},
		{n: '//to do', w: 16, h: 16, p: '-77px -114px'},
		{n: ':cake:', w: 15, h: 15, p: '-94px -115px'},
		{n: ':mario:', w: 15, h: 15, p: '-110px -115px'},
		{n: ':luigi:', w: 15, h: 14, p: '-126px -116px'},
		{n: ':ds:', w: 15, h: 15, p: '-1px -131px'},
		{n: ':burger:', w: 15, h: 15, p: '-17px -130px'},
		{n: ':taco:', w: 15, h: 15, p: '-33px -130px'},
		{n: ':icecream:', w: 15, h: 15, p: '-49px -130px'}
	]
};

$('body').append(
	$('<div/>', {id: 'plus-emoticonPicker'}),
	$('<div/>', {id: 'plus-emoticonPickerBtn'})
);

$('#plus-emoticonPickerBtn').click(function() {
	$('#plus-emoticonPicker, #plus-emoticonPickerBtn').toggleClass('active');
});

_.each(emoticons, function(emotes, cat) {
	$('#plus-emoticonPicker').append($('<hr>', {title: cat}));
	_.each(emotes, function(emote) {
		$("#plus-emoticonPicker").append($('<span/>', {css: {
				backgroundPosition: emote.p, width: emote.w, height: emote.h
		}}).click(function() { appendToTextbox(emote.n); }).attr('title', emote.n));
	});
});

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
	_.each(items, function(item) { if (_.startsWith(item.type, 'image')) blob = item.getAsFile(); });

	if (blob) {
		var reader = new FileReader();
		reader.onload = function() {
			uploadToImgur(reader.result.replace(/^data:image\/(png|jpg);base64,/, ""));
		};
		reader.readAsDataURL(blob);
	}
});

chatMsg('Welcome to Plaza+! Type /+help for help with Plaza+.');