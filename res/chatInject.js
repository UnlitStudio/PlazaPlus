/* globals sendpost */

(function() {
	var oldsp = sendpost;
	document.addEventListener('plusSendChat', oldsp);
	sendpost = function() {
		document.getElementById('send').click();
	};
	document.addEventListener('plusNoEgg', function() {
		throwEgg = function() {};
	});
})();
