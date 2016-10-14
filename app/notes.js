let notes = Object.freeze(['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']);
let midiNotes = function() {
	return Object.freeze(new Array(128).fill(undefined)
		.map((item, index) => Object.freeze({
			midi: index,
			name: notes[index % 12],
			octave: Math.floor(index / 12) - 1,
			freq: Math.pow(2, (index - 69) / 12) * 440,
			isHalfTone: [1, 3, 6, 8, 10].includes(index % 12)
		})
	));
}();

let getMidiNodeByFreq = function(freq) {
	return midiNotes.reduce((prev, next) => freq > prev.freq ? next : prev, midiNotes[0]);
};


export { midiNotes, notes, getMidiNodeByFreq };
