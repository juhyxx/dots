import StaffView from 'StaffView.js';

export default class Application {

	get notes() {
		return ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
	}
	get basicNotes() {
		return ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
	}
	get midiNotes() {
		return new Array(128).fill(undefined).map((item, index) => {
			return {
				midi: index,
				name: this.notes[index % 12],
				octave: Math.floor(index / 12)
			};
		});
	}
	get midiNotesWithoutHalfTones() {
		return this.midiNotes.map((item, index) => {
			if ([1, 3, 6, 8, 10].indexOf(item.midi % 12) < 0) {
				return item;
			}
		}).filter((item => item !== undefined)).map((item, index) => {
			item.index = index;

			return item;
		});
	}

	static run() {
		return (new this);
	}

	constructor() {
		this.staffView = new StaffView('svg #note');

		document.querySelector('nav button').addEventListener('click', () => {
			this.runTest();
		});
		document.querySelector('#piano').addEventListener('click', (e) => {
			let value = e.target.getAttribute('value');

			if (value) {
				this.checkResult(this.notes.indexOf(value));
			}
		});

	}

	checkResult(index) {
		if (index === this._lastNote.index % 12) {
			console.log('OK');
		}
		console.log(index, this._lastNote.index % 12);
	}

	onInterval() {
		let noteContainer = document.querySelector('#note-container');

		this._lastNote = this.getRandom(this.basicNotes);
		this.staffView.showNote(this._lastNote);
		noteContainer.setAttribute('className', '');
		noteContainer.setAttribute('className', 'animation');
	}

	runTest() {
		console.log('running');
		clearInterval(this._interval);
		this._interval = setInterval(this.onInterval.bind(this), 5000);
		this.onInterval();
	}

	getRandom(arr) {
		return this.midiNotesWithoutHalfTones[this.random(44, 64)];
	}

	random(min, max) {
		return Math.floor(Math.random() * (max - min)) + min;
	}

}
