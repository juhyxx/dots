let notes = Object.freeze(['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']);
let midiNotes = function() {
	return Object.freeze(new Array(128)
		.fill(undefined)
		.map((item, index) => Object.freeze({
			midi: index,
			name: notes[index % 12],
			octave: Math.floor(index / 12) - 1,
			freq: Math.pow(2, (index - 69) / 12) * 440
		})
	));
}();
let getWithoutHalfTones = (notes) => notes.filter((item, index) => ([1, 3, 6, 8, 10].indexOf(item.midi % 12) < 0));

let getMidiNodeByFreq = function(freq) {
	return midiNotes.reduce((prev, next) => {
		if (freq > prev.freq) {
			return next;
		}
		return prev;
	}, midiNotes[0]);
};


export { midiNotes, notes, getWithoutHalfTones, getMidiNodeByFreq };
