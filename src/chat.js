/* globals chrome */

require('./chat.less');

var Enums = require('./enums.js');
var $ = require('jquery');
var _ = {
	rest: require('lodash/rest'),
	concat: require('lodash/concat'),
	isString: require('lodash/isString'),
	now: require('lodash/now'),
	spread: require('lodash/spread'),
	head: require('lodash/head'),
	noop: require('lodash/noop'),
	tail: require('lodash/tail'),
	each: require('lodash/each'),
	toLower: require('lodash/toLower'),
	times: require('lodash/times'),
	includes: require('lodash/includes'),
	repeat: require('lodash/repeat'),
	map: require('lodash/map'),
	template: require('lodash/template'),
	sample: require('lodash/sample'),
	split: require('lodash/split'),
	compact: require('lodash/compact'),
	indexOf: require('lodash/indexOf'),
	startsWith: require('lodash/startsWith'),
	isNil: require('lodash/isNil'),
	bind: require('lodash/bind'),
	constant: require('lodash/constant'),
	join: require('lodash/join'),
	initial: require('lodash/initial'),
	last: require('lodash/last'),
	escape: require('lodash/escape'),
	toLower: require('lodash/toLower'),
	unescape: require('lodash/unescape'),
	clamp: require('lodash/clamp'),
	memoize: require('lodash/memoize'),
	reduce: require('lodash/reduce'),
	trim: require('lodash/trim'),
	cond: require('lodash/cond'),
	concat: require('lodash/concat'),
	rearg: require('lodash/rearg'),
	partial: require('lodash/partial'),
	toNumber: require('lodash/toNumber'),
	isNaN: require('lodash/isNaN'),
	eq: require('lodash/eq'),
	uniqueId: require('lodash/uniqueId'),
	zip: require('lodash/zip'),
	split: require('lodash/split'),
	throttle: require('lodash/throttle'),
	take: require('lodash/take'),
	escapeRegExp: require('lodash/escapeRegExp'),
	compact: require('lodash/compact'),
	split: require('lodash/split'),
	groupBy: require('lodash/groupBy')
};
_.partial.placeholder = _;
var Promise = require('promise');
var Autolinker = require('autolinker');
var tinycolor = require('tinycolor2');

var chatIns = _.rest(function(objs) {
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

function chatMsg(msg) {
	chatIns($('<span/>', {text: ': '+msg, css: {color: 'gray'}}));
}
function chatErr(msg) {
	chatIns($('<span/>', {text: ': '+msg, css: {color: 'red'}}));
}
function microtime() {
	var now = _.now() / 1000, s = parseInt(now, 10);
	return (Math.round((now - s) * 1000) / 1000) + ' ' + s;
}

var chatroom = /\?room=(.*)/.exec($('.contain_inside form').attr('action'));
chatroom = chatroom ? chatroom[1] : 'v3original';
var port = chrome.runtime.connect({name: 'chat:'+chatroom}), mainTab = false;
var active = 0, dests = {}, icons = {}, aliases = {}, focusList = [], isFocus = false;
var focusMode = 'blur', asyncLock = 0, notifyNames = '', notifyWhispers = false, lastWhisp = false;
var onlineSort = false, colorNormal = '#0000ff', colorNoob = '#00ffff', colorMod = '#00ff00';
var colorBanned = '#ff0000', colorIgnored = '#000000';

// Chrome doesn't allow unsafeWindow. D:<
// Instead, we have to inject an event listener into the page.
var oldsp;
(function() {
	var s = document.createElement('script');
	s.src = chrome.extension.getURL('res/chatInject.js');
	s.onload = function() { $(this).remove(); };
	document.body.appendChild(s);
	var evt = document.createEvent('Event');
	evt.initEvent('plusSendChat', true, false);
	oldsp = function() { document.dispatchEvent(evt); };
})();

// message listeners
var listeners = {};
listeners.newMain = function() { mainTab = true; };

// message helpers
var sendMessage = _.rest(function(type, data) { port.postMessage(_.concat([type], data)); });
port.onMessage.addListener(function(msg, sender) {
	_.spread(listeners[_.head(msg)] || _.noop)(_.tail(msg));
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

var syncListeners = {}, localListeners = {};
syncListeners.hideTabs = function(v) {
	$('#pluscss1').text(v ? '#plusbtn0,#plusbtn1,#plusbtn2,#plusbtn3,#plusbtn4{width:0px !important}' : '');
};
syncListeners.displayIcons = function(v) {
	$('#pluscss0').text(v ? '' : '.plusicon{display:none}');
};
syncListeners.aliases = function(v) { aliases = v; };
syncListeners.notifyNames = function(v) { notifyNames = v; };
syncListeners.notifyWhispers = function(v) { notifyWhispers = v; };
syncListeners.onlineSort = function(v) { onlineSort = v; };
syncListeners.colorNormal = function(v) { colorNormal = v; };
syncListeners.colorNoob = function(v) { colorNoob = v; };
syncListeners.colorMod = function(v) { colorMod = v; };
syncListeners.colorBanned = function(v) { colorBanned = v; };
syncListeners.colorIgnored = function(v) { colorIgnored = v; };

localListeners.iconCache = function(v) {
	icons = v; $('.plusicon').attr('src', null);
	_.each(v, function(v, k) {
		$('.chatline[user="'+_.toLower(k)+'"] .plusicon').attr('src', v);
	});
};

chrome.storage.onChanged.addListener(function(changes, space) {
	if (space != 'sync') return;
	_.each(changes, function(v, k) { (syncListeners[k] || _.noop)(v.newValue, v.oldValue); });
});
chrome.storage.onChanged.addListener(function(changes, space) {
	if (space != 'local') return;
	_.each(changes, function(v, k) { (localListeners[k] || _.noop)(v.newValue, v.oldValue); });
});

chrome.storage.sync.get(Enums.syncDef, function(items) {
	if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError);
	_.each(items, function(v, k) { (syncListeners[k] || _.noop)(v); });
});
chrome.storage.local.get(Enums.localDef, function(items) {
	if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError);
	_.each(items, function(v, k) { (localListeners[k] || _.noop)(v); });
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

var destTypes = {};
destTypes.chat = {
	info: function() { return 'Chat'; },
	send: function(cb, txt) { sendChat(txt, true); cb(true); },
	usable: function(cb) { cb(true); }
};
destTypes.whisper = {
	info: function() {
		if (this.tag && this.tag != this.user)
			return 'Whisper '+this.tag+' ('+this.user+')';
		return 'Whisper '+this.user;
	},
	send: function(cb, txt) { sendChat('/whisperto '+this.user+' '+txt, true); cb(true); },
	usable: function(cb) {
		var user = this.user;
		$.ajax('../chat3/nav.php', {
			data: {loc: 'user', who: user}, success: function(d) {
				if (_.includes(d, 'This user does not seem to exist.'))
					cb(false, 'The user '+user+" doesn't exist.");
				else if (_.includes(d, 'You cannot whisper'))
					cb(false, "You can't whisper "+user+" because you aren't friends with them.");
				else cb(true);
			}, timeout: 3000, dataType: 'text', error: function() { cb(true); }
		});
	}
};
destTypes.echo = {
	info: function() { return 'Echo'; },
	send: function(cb, txt) { chatMsg(txt); cb(true); },
	usable: function(cb) { cb(true); }
};
destTypes.null = {
	info: function() { return 'Null'; },
	send: function(cb) { cb(true); },
	usable: function(cb) { cb(true); }
};
destTypes.pm = {
	info: function() {
		if (this.tag && this.tag != this.user)
			return 'PM '+this.tag+' ('+this.user+') - Subject: '+this.subj;
		return 'PM '+this.user+' - Subject: '+this.subj;
	},
	send: function(cb, txt) {
		var user = this.user, subj = this.subj;
		$.ajax('../members/send_pm.php', {
			type: 'POST', data: {
				to: user, subject: subj, message: txt.replace(/\\\\/g, '\n'),
				checktime: microtime(), send: 'Send'
			}, success: function(d) {
				if (_.includes(d, 'Your message has been sent succesfully!'))
					cb(true, 'Your PM has been sent to '+user+'.');
				else if (_.includes(d, 'You are currently banned'))
					cb(false, "You can't send PMs while banned.");
				else if (_.includes(d, " doesn't exist!")) cb(false, 'The user '+user+" doesn't exist.");
				else if (_.includes(d, 'friends can send PMs to'))
					cb(false, "You can't PM "+user+" because you aren't friends with them.");
				else cb(false, 'An unknown error occurred while sending the PM to '+user+'.');
			}, timeout: 3000, dataType: 'text',
			error: function() { cb(false, "Plaza+ can't confirm if your PM was sent to "+user+'.'); }
		});
		setDest({type: 'chat'});
	},
	usable: function(cb) {
		var user = this.user;
		$.ajax('../members/send_pm.php', {
			type: 'POST', data: {
				to: user, subject: '', message: '', checktime: microtime(), send: 'Send'
			}, success: function(d) {
				if (_.includes(d, " doesn't exist!")) cb(false, 'The user '+user+" doesn't exist.");
				else if (_.includes(d, 'friends can send PMs to'))
					cb(false, "You can't PM "+user+" because you aren't friends with them.");
				else cb(true, 'Type the PM message for '+user+' into the textbox.');
			}, timeout: 3000, dataType: 'text',
			error: function() { cb(true, 'Type the PM message for '+user+' into the textbox.'); }
		});
	}
};

function aliasCmd(txt, noparam) { return function(cb, param, dest) {
	parsePost(txt + (noparam ? '' : param.join(' ')), dest, cb);
}; }

// Commands
var commands = {};
commands.raw = function(cb, param) { cb(param.join(' ')); };
commands.query = function(cb, param) {
	getUser(param.shift(), function(user) { cb('/query '+user); });
};
commands.ignore = function(cb, param) { getUser(param.shift(), function(user) {
	// witty 1 liners amirite?
	if (!user) return cb(chatErr('Please specify a user.'));
	$.ajax('../chat3/nav.php', {
		data: {loc: 'user', who: user}, success: function(d) {
			var id = d.match(/'\/INTERNAL-ignore (?:\+|-) (\d+)';/);
			if (_.includes(d, 'This user does not seem to exist.'))
				chatErr('The user '+user+" doesn't exist.");
			else if (id) sendChat('/INTERNAL-ignore + ' + id[1]);
			else chatErr('Failed to retrieve '+user+"'s member ID.");
			cb();
		}, timeout: 3000, dataType: 'text',
		error: function() { cb(chatErr('Failed to retrieve '+user+"'s member ID.")); }
	});
}); };
commands.unignore = function(cb, param) { getUser(param.shift(), function(user) {
	if (!user) return cb(chatErr('Please specify a user.'));
	$.ajax('../chat3/nav.php', {
		data: {loc: 'user', who: user}, success: function(d) {
			var id = d.match(/'\/INTERNAL-ignore (?:\+|-) (\d+)';/);
			if (_.includes(d, 'This user does not seem to exist.'))
				chatErr('The user '+user+" doesn't exist.");
			else if (id) sendChat('/INTERNAL-ignore - ' + id[1]);
			else chatErr('Failed to retrieve '+user+"'s member ID.");
			cb();
		}, timeout: 3000, dataType: 'text',
		error: function() { cb(chatErr('Failed to retrieve '+user+"'s member ID.")); }
	});
}); };
commands.overraeg = aliasCmd('/raeg ' + _.repeat(':)', 20), true);
commands['+ver'] = function(cb) {
	var ver = chrome.runtime.getManifest().version_name;
	cb(chatMsg('You are using Plaza+ '+ver+' (Chrome).'));
};
commands.chat = function(cb, param) {
	var dest = {type: 'chat'}, msg = param.join(' ');
	if (msg) return parsePost(msg, dest, cb);
	cb(setDest(dest));
};
commands.echo = function(cb, param) {
	var dest = {type: 'echo'}, msg = param.join(' ');
	if (msg) return parsePost(msg, dest, cb);
	cb(setDest(dest));
};
commands.whisper = function(cb, param) { getUser(param.shift(), function(user, tag) {
	if (!user) return cb(chatErr('Please specify a user.'));
	var dest = {type: 'whisper', tag: tag, user: user}, msg = param.join(' ');
	if (msg) return parsePost(msg, dest, cb);
	cb(setDest(dest));
}); };
commands.whisperto = commands.whisper;
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

function getUsers(users) {
	return Promise.all(_.map(users, function(u) {
		return new Promise(function(ok) { getUser(u, function(user) { ok(user); }); });
	}));
}

function setDest(d) {
	if (d) {
		lockAsync();
		_.bind(destTypes[d.type].usable, d)(function(stat, info) {
			if (info) {
				if (stat) chatMsg(info); else chatErr(info);
			}
			if (stat) {
				d.text = d.text || '';
				d.selection = d.selection || [0, 0, 'forward'];
				dests[active] = d;
			}
			freeAsync();
		});
	} else {
		var type = destTypes[dests[active].type] || {info: _.constant('Invalid destination')};
		$('#bericht').attr('placeholder', _.bind(type.info, dests[active]));
		$('#plusbtn'+active).attr('title', _.bind(type.info, dests[active]));
	}
}

function setActive(dest) {
	if (asyncLock > 0) return; // Guh.
	var be = $('#bericht')[0];
	dests[active].text = $('#bericht').val();
	dests[active].selection = [be.selectionStart, be.selectionEnd, be.selectionDirection];
	active = dest; setDest();
	$('.plusbox').removeClass('plusbox0 plusbox1 plusbox2 plusbox3 plusbox4').addClass('plusbox'+dest);
	$('.plusbtn').removeClass('plusact');
	$('#plusbtn'+dest).addClass('plusact');
	$('#bericht').val(dests[dest].text).focus();
	// dammit chrome...
	var sel = dests[dest].selection;
	$('#bericht')[0].setSelectionRange(sel[0], sel[1], sel[2]);
}

function sendChat(txt, raw) {
	var old = $('#bericht').val(); $('#bericht').val(txt);
	if (raw) oldsp(); else sp(); $('#bericht').val(old);
}

function oxford(a) {
	return a.length < 3 ? _.join(a, ' and ') : _.join(_.initial(a), ', ') + ', and ' + _.last(a);
}

function emotify(txt) {
	txt = txt.replace(/:flip:/g, '(╯°□°）╯︵ ┻━┻'); // Table flip
	txt = txt.replace(/:e:/g, 'é'); // Pokémon
	txt = txt.replace(/:w:/g, 'ω'); // owo has evolved
	txt = txt.replace(/:i:/g, 'ı'); // Erman Sayın
	txt = txt.replace(/:=\/=:/g, '≠').replace(/:<=:/g, '≤').replace(/:>=:/g, '≥');
	txt = txt.replace(/:\/:/g, '÷').replace(/:inf:/g, '∞').replace(/:pi:/g, 'π');
	txt = txt.replace(/:+-:/g, '±').replace(/:rlo:/g, '\u202E').replace(/:lro:/g, '\u202D');
	return txt;
}

function getChat(str) {
	switch (_.toLower(str)) {
		case 'v3original': case 'original': case 'orig': return 'v3original';
		case 'v3game': case 'game': return 'v3game';
		case 'v3red': case 'red': return 'v3red';
		case 'v3yellow': case 'yellow': return 'v3yellow';
		case 'v3green': case 'green': return 'v3green';
		case 'v3rp': case 'rp': case 'rper': case 'roleplay': case 'roleplayer': return 'v3rp';
		case 'v3rpaux': case 'rpaux': case 'auxrp': return 'v3rpaux';
		case 'r9k': case 'robot9000': case 'r9000': case 'robot9k': return 'r9k';
		default: return false;
	}
}

function undoEmotes(v) {
	return v.replace(/<img src="(?:[^"]*)" alt="([^"]*)">/g, function(match, alt) {
		return _.escape(alt);
	});
}

function getUser(user, cb) {
	var name = _.toLower(user);
	chrome.storage.sync.get({aliases: Enums.syncDef.aliases}, function(items) {
		var alias = items.aliases[name] || {user: user, tag: false};
		cb(alias.user, alias.tag);
	});
}

function stripHTML(v) {
	return _.unescape(v.replace(/<(?:.|\n)*?>/gm, ''));
}

function lockAsync() {
	asyncLock = asyncLock + 1;
	if (asyncLock == 1) isFocus = $('#bericht').is(':focus');
	$('#bericht').val(''); $('#bericht').attr('disabled', true);
	$('#bericht').attr('placeholder', 'Please wait...');
}

function freeAsync() {
	asyncLock = Math.max(asyncLock - 1, 0);
	if (asyncLock > 0) return;
	$('#bericht').attr('disabled', false); setDest();
	if (isFocus) $('#bericht').focus();
}

function parsePost(txt, dest, cb) {
	var param = txt.split(' '), cmd = param.shift();
	if (cmd.charAt(0) != '/') return cb(emotify(txt), dest);
	cmd = _.toLower(cmd.substr(1));
	try {
		(commands[cmd] || function(cb) { cb(emotify(txt)); })(function(txt, dst) {
			cb(txt, dst || dest);
		}, param, dest);
	} catch (e) { console.error(e); cb(chatErr(String(e))); }
}

function sp() {
	var txt = $('#bericht').val(); if (!txt) return;
	lockAsync();
	parsePost(txt, dests[active], function(txt, dest) {
		if (!txt) return freeAsync();
		var type = destTypes[dest.type] || {
			usable: function(cb) {
				cb(false, 'Invalid destination. This should not be possible...');
			}
		};
		_.bind(type.usable, dest)(function(stat, info) {
			if (info) {
				if (stat) chatMsg(info); else chatErr(info);
			}
			if (stat)
				_.bind(type.send, dest)(function(stat, info) {
					if (info) {
						if (stat) chatMsg(info); else chatErr(info);
					}
					freeAsync();
				}, txt);
			else return freeAsync();
		});
	});
}

var colorLerp = require('./func/colorLerp.js');
var parseColor = require('./func/parseColor.js');
var parseSeg = require('./func/parseSeg.js');
var parseCspl = require('./func/parseCspl.js');

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
	var val = $('#bericht').val(), sel = $('#bericht')[0].selectionStart;
	var end = val.substr(sel - 1, 1);
	if (end != ' ' && end != '\\') return;
	if (end == '\\') val = val.substr(0, sel-1) + val.substr(sel);
	var csp = parseCspl(val.substr(11), sel - 11);
	var spc = val != '/cspl conf ' && val.substr(-1) == ' ';
	$('#bericht').val('/cspl conf ' + _.trim(csp[0]) + (spc ? ' ' : ''));
	if (csp[1]) $('#bericht')[0].setSelectionRange(csp[2] + 12, csp[2] + 12);
});
$('<div/>', {'class': 'plusbtn', id: 'plusopt'}).click(function() { sendMessage('openOptions'); })
	.append($('<div/>')).attr('title', 'Plaza+ Options').appendTo('#plusbar');
_.times(5, function(n) {
	dests[n] = {type: 'chat', text: '', selection: [0, 0, 'forward']};
	$('<div/>', {'class': 'plusbtn', id: 'plusbtn'+n}).click(function() { setActive(n); })
		.append($('<div/>')).attr('title', 'Chat').appendTo('#plusbar');
});
setActive(0);

var chatCache = false, chatCheck = 0;
var chatRead = _.throttle(function() {
	var html = $('#demo').html();
	if (chatCache == html) return;
	var brarray = html.split('<!--d-->'), whisp = false;
	if (brarray[0].substr(0, 9) == 'undefined') {
		setTimeout(function() { chatErr('Failed to retrieve messages.'); }, 0);
		brarray[0] = brarray[0].substr(9);
	}
	var res = _.map(_.take(brarray, 75), function(v) {
		if (!_.includes(v, '<!--plused-->')) {
			var user = v.match(/(?:<b><u(?: oncontextmenu="[^"]+")?>(?:<span style="font-size: 85%;">(?:\[(?:.+)\] )?)?(.+?)(?:<\/span> as (?:.*?))?:?<\/u><\/b>)/);
			var name = user ? _.trim(stripHTML(user[1])) : false;
			var idCheck = v.match(/<!---cmid:(\d+)-->/);
			idCheck = idCheck ? idCheck[1] : -1; user = name;
			var msg = undoEmotes(v.replace(/<span style="color: (.*?)<\/u><\/b><\/span>/, ''));
			msg = _.trim(_.trim(stripHTML(msg)));
			var whisper = /<span style="font-size: 75%; background-color: cyan; opacity: 0\.75; color: blue;">to ([^<]+)<\/span>/;
			whisper = v.match(whisper); whisper = whisper ? whisper[1] : false;
			var warnCheck = v.match(/<span style="color: red;"><u>(! Warning (?:[^<]*) !)<\/u><\/span>/);
			if (warnCheck) msg = _.trim(stripHTML(undoEmotes(warnCheck[1])));
			var enc = false; warnCheck = !!warnCheck;
			if (whisper) msg = _.trim(msg.replace(new RegExp('to '+_.escapeRegExp(whisper)+'$'), ''));
			if (msg.match(/^###ascii###( \d+)+$/)) (function() {
				var reg = /(\d+)+/g, chr; enc = '';
				while ((chr = reg.exec(msg)) !== null) enc += String.fromCharCode(chr[1]);
				msg = enc; enc = true;
			})();
			var nregex = _.map(_.compact(_.split(notifyNames, ' ')), _.escapeRegExp);
			nregex = '(' + _.join(nregex, '|') + ')';
			nregex = nregex != "()" ? msg.match(new RegExp(nregex, 'i')) : false;
			name = user ? _.toLower(user) : false;
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
						sendChat('/whisperto '+user+' Plaza+ ' + vers + ' (Chrome)', true);
					})();
					else if (whisper == 'you' && notifyWhispers)
						sendMessage('notify', 'whisper', {user: user, msg: msg, warn: warnCheck});
					else if (nregex)
						sendMessage('notify', 'mention', {user: user, msg: msg, warn: warnCheck});
				}
			}
			if (name) {
				var i = 'class="plusicon"';
				if (icons[name]) i += ' src="' + icons[name] + '"';
				var b = 'chatline';
				if (focusList.length > 0 && !_.includes(_.map(focusList, _.toLower), name)) b += ' blur';
				v = '<!--plused--><span class="'+b+'" user="'+name+'"><img '+i+'> '+v+'</span>';
			} else v = '<!--plused-->' + v;
		}
		if (_.includes(v, '<script')) return v;
		return linker.link(v);
	});
	if (whisp) lastWhisp = whisp;
	chatCache = _.join(res, '<!--d-->'); var idCheck = chatCache.match(/<!---cmid:(\d+)-->/);
	if (idCheck) chatCheck = idCheck[1];
	$('#demo').html(chatCache);
});
chatRead(); new MutationObserver(chatRead).observe($('#demo')[0], {childList: true});

var onlineList = {}, onlineCache = false;
var onlineTime = [0,0,0], onlineTimer = false;
var onlineRead = _.throttle(function() {
	var html = $('#online').html();
	if (onlineCache == html) return;
	if (onlineCache === true) return;
	var brarray = html.split('<br>'), online = {};
	var time = brarray.shift(); brarray.shift();
	onlineTime = [+time.substr(0, 2), +time.substr(3, 2), +time.substr(6, 2)];
	if (onlineTimer) window.clearInterval(onlineTimer);
	onlineTimer = window.setInterval(onlineUpd, 1000);
	if (html.match(/Warning:/)) online = onlineList;
	else
		_.each(_.initial(brarray), function(v) {
			var rank = v.match(/background-color: ([a-z]+);/);
			if (rank)	rank = (function(){ switch (rank[1]) {
				case 'cyan': return 'noob';
				case 'lime': return 'mod';
				case 'red': return 'banned';
				case 'black': return 'ignored';
				default: return 'normal';
			}})(); else rank = 'normal';
			var away = !!v.match(/opacity: 0.5;/), ignore = !!v.match(/<s>/);
			var to = !!v.match(/<img src="http:\/\/3dsplaza\.com\/global\/chat3\/to\.gif" alt="\[TO]">/);
			var user = '', cspl = [], conf = [], c = '';
			var regex = /<span style="color:\s?(#?[A-Za-z0-9]*);">(.+?)<\/span>/g;
			while ((c = regex.exec(v)) !== null) {
				user += c[2];
				_.times(c[2].length, function(i) { // jshint ignore:line
					cspl.push(c[1]);
					conf.push(c[2][i]+'='+tinycolor(c[1]).toHexString());
				});
			}
			conf = conf.join(' ');
			online[_.toLower(user)] = {
				user: user, cspl: cspl, conf: conf, rank: rank, away: away, timeout: to, ignore: ignore
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
	time = _.map(time, function(v) { return ('0'+v).substr(-2); }).join(':');
	onlineCache = true;
	$('#onlineTime').text(time);
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
	function entry(user, div) {
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
	function section(id, title) {
		var div = '#online';
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
		if (group.mod) {
			section('mod', 'Chat Mods');
			if (group.normal) section('normal', 'Normal Users');
		} else if (group.normal) section('normal');
		if (group.banned) section('banned', 'Banned Users');
	} else _.each(onlineList, entry);
	onlineCache = $('#online').html();
}
new MutationObserver(onlineRead).observe($('#online')[0], {childList: true});

// emoticon picker
function appendToTextbox(text){
	var be = $('#bericht')[0], start = be.selectionStart, end = be.selectionEnd;
	var txt = $('#bericht').val(), range = start + text.length;
	$('#bericht').val(txt.substring(0, start) + text + txt.substr(end)).focus();
	be.setSelectionRange(range, range, 'none');
}

var emoticons = {
	Faces: [
		{n: ':)', w: 15, h: 15, p: '-1px -17px'},
		{n: ':D', w: 15, h: 15, p: '-17px -17px'},
		{n: ';)', w: 15, h: 15, p: '-33px -17px'},
		{n: ':S', w: 15, h: 15, p: '-49px -17px'},
		{n: ':@', w: 15, h: 15, p: '-81px -17px'},
		{n: '-_-&apos;', w: 15, h: 15, p: '-40px -53px'},
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

function uploadToImgur(file) {
	var fd = new FormData(); fd.append('image', file);
	var xhr = $.ajax('https://api.imgur.com/3/image.json', {
		type: 'POST', data: fd, processData: false, contentType: false,
		headers: {Authorization: 'Client-ID 0609f1f5d0e4a2b'}, dataType: 'json',
		xhr: function() {
			// trick to get the progress event in jQuery ajax
			var xhr = new window.XMLHttpRequest();
			xhr.upload.addEventListener('progress', function(evt) {
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
			$('<div/>', {id: 'plus_imgurUploadingBar'}).html(
				$('<div/>', {id: 'plus_imgurUploadingBarPercentage'})
			),
			$('<div/>', {id: 'plus_imgurCancelUpload', text: 'Cancel'}).click(function() {
				xhr.abort();
			})
		)
	);
}

$('#plus-imgurUploadInput').change(function() { uploadToImgur($(this)[0].files[0]); });

$(document).on('paste', function(evt) {
	var items = (evt.clipboardData || evt.originalEvent.clipboardData).items, blob = null;
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
