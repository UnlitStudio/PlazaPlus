import * as _ from 'lodash';
import * as $ from 'jquery';
import * as tinycolor from 'tinycolor2';
import Enums from './enums';
import {Dict} from './helpers/types';
import './options.less';

$(function(){

if (!chrome.storage.sync) chrome.storage.sync = chrome.storage.local;

function getColor(color: string) {
	var col = /^\s*rand(om)?\s*$/i.exec(color) ? tinycolor.random() : tinycolor(color);
	if (!col.isValid()) return undefined; else return col;
}

$('#tabs img').click(function() {
	var tab = '#'+$(this).attr('tab');
	if ($(tab).is(':visible')) return;
	$('body > div:visible').not('#tabs').fadeOut(function() { $(tab).fadeIn(); });
});
$('.help').click(function() { $(this).next('.desc').fadeToggle(); });

// omg thank you chrome <3
function testSound() {
	var a = new Audio();
	a.src = chrome.extension.getURL('res/'+$('#notifySound').val());
	a.volume = $('#notifyVolume').val() / 100;
	a.play();
}
$('#changeIcon').click(function() {
	window.open('https://erman.rocks/services/plaza+/', '_blank');
});
$('#notifySound').change(testSound);
$('#notifySoundTest').click(testSound);
$('#onlineColors input').change(function() {
	var color = getColor($(this).val());
	if (!color) {
		var id = $(this).attr('id');
		color = tinycolor(
			id=='colorNormal'?'00f':
			id=='colorNoob'  ?'0ff':
			id=='colorMod'   ?'0f0':
			id=='colorBanned'?'f00':
			/* colorIgnored */'000');
	}
	$(this).val(color.toHexString());
	$(this).parent().next().find('div').css('backgroundColor', color.toHexString());
});
function checkAliases() {
	var tags: string[] = [], me = false;
	$('#aliases .alias').each(function() {
		tags.push(_.toLower($(this).find('.tag input').val()));
	});
	tags = _.uniq(tags);
	_.each(tags, function(tag) {
		var check = false;
		if (_.toLower(tag) == 'me') me = true;
		$('#aliases .alias').each(function() {
			if (_.toLower($(this).find('.tag input').val()) != tag) return;
			var error =
				!tag ? "Alias tags can't be empty" :
				_.includes(tag, ' ') ? "Alias tags can't contain spaces" :
				check ? "This alias tag is already being used" :
				false;
			check = true;
			if (error) $(this).next('.error').show().find('td').text(error);
			else $(this).next('.error').hide();
		});
	});
	if (me) $('#meTip').slideUp(); else $('#meTip').slideDown();
}
function addAlias(tag: string, user: string) {
	$('#addalias').before(
		$('<tr/>', {'class': 'alias'}).append(
			$('<td/>', {'class': 'tag'}).append(
				$('<input>', {type: 'text', val: tag, change: checkAliases})
			),
			$('<td/>', {'class': 'user'}).append($('<input>', {type: 'text', val: user})),
			$('<td/>', {'class': 'del'}).append($('<button/>', {text: '-'}).click(function() {
				$(this).parent().parent().next('.error').remove();
				$(this).parent().parent().remove();
				checkAliases();
			}))
		),
		$('<tr/>', {'class': 'error'}).append($('<td/>', {colspan: 3}))
	);
	checkAliases();
}

$('#addalias .add button').click(function() {
	var tag = $('#addalias .tag input').val();
	var user = $('#addalias .user input').val();
	if (!tag) return;
	addAlias(tag, user);
	$('#addalias input').val('');
});

// default aliases
addAlias('Fayne', 'Fayne_Aldan');
addAlias('Rob', 'Robdeprop');

var bools = ['hideTabs','onlineSort','displayIcons','notifyWhispers'];
var cols = ['normal','noob','mod','banned','ignored'];
var texts = ['notifyNames','notifyIgnore','notifySound'];
var nums = ['notifyVolume'];

type Loader = (val: any) => void;
var loaders: Dict<Loader> = {};
// booleans
_.each(bools, function(n) {
	loaders[n] = function(v) { $('#'+n).prop('checked', v); };
});
// colors
_.each(cols, function(col) {
	var n = _.camelCase('color-'+col);
	var c = tinycolor(Enums.syncDef[n]);
	loaders[n] = function(v) {
		var col = getColor(v) || c;
		$('#'+n).val(col.toHexString());
		$('#'+n).parent().next().find('div').css('backgroundColor', col.toHexString());
	};
});
// texts and numbers
_.each(_.concat(texts, nums), function(n) {
	loaders[n] = function(v) { $('#'+n).val(v); };
});
// aliases
loaders['aliases'] = function(v) {
	$('#aliases .alias').remove();
	$('#aliases .error').remove();
	_.each(v, function(alias) { addAlias(alias.tag, alias.user); });
};

type Saver = () => any;
var savers: Dict<Saver> = {};
// booleans
_.each(bools, function(n) {
	savers[n] = function() { return $('#'+n).prop('checked'); };
});
// texts and colors
_.each(_.concat(texts, _.map(cols, function(n) {
	return _.camelCase('color-'+n);
})), function(n) {
	savers[n] = function() { return $('#'+n).val(); };
});
// numbers
_.each(nums, function(n) {
	savers[n] = function() { return _.toNumber($('#'+n).val()); };
});
// aliases
savers['aliases'] = function() {
	var aliases: Dict<{}> = {};
	$('#aliases .alias').each(function() {
		var tag = $(this).find('.tag input').val();
		var user = $(this).find('.user input').val();
		var name = _.toLower(tag);
		if (aliases[name] || !tag || _.includes(tag, ' ')) return;
		aliases[name] = {tag: tag, user: user};
	});
	return aliases;
};

chrome.storage.sync.get(function(items) {
	// this won't halt the entire script, right?
	if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError);
	_.each(items, function(v, k) { console.log(loaders[k] || _.noop);
	(loaders[k] || _.noop)(v); });
});

chrome.storage.onChanged.addListener(function(changes, space) {
	if (space != 'sync') return;
	_.each(changes, function(v, k) { (loaders[k] || _.noop)(v.newValue); });
});

$('#save').click(function() {
	var items: Dict<any> = {}; _.each(savers, function(func, k) { items[k] = func(); });
	chrome.storage.sync.set(items, function() {
		if (chrome.runtime.lastError) return;
		$('#success').show().fadeOut('slow');
	});
});
$('#reset').click(function() { $('#footer').hide(); $('#resetConfirm').show(); });
$('#resetNo').click(function() { $('#footer').show(); $('#resetConfirm').hide(); });
$('#resetYes').click(function() {
	$('#resetConfirm').html('<td class="center">Please wait...</td>');
	chrome.storage.sync.set(Enums.syncDef, function() { location.reload(); });
});

});
