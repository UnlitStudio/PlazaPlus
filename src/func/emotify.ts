export default function(txt: string) {
	return txt
	.replace(/:flip:/g, '(╯°□°）╯︵ ┻━┻') // Table flip
	.replace(/:e:/g, 'é') // Pokémon
	.replace(/:w:/g, 'ω') // owo has evolved
	.replace(/:i:/g, 'ı') // Erman Sayın
	.replace(/:lenny:/g, '( ͡° ͜ʖ ͡° )') // Lenny Face
	.replace(/:=\/=:/g, '≠').replace(/:<=:/g, '≤').replace(/:>=:/g, '≥')
	.replace(/:\/:/g, '÷').replace(/:inf:/g, '∞').replace(/:pi:/g, 'π')
	.replace(/:+-:/g, '±').replace(/:rlo:/g, '\u202E').replace(/:lro:/g, '\u202D')
};
