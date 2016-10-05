import StaffView from 'StaffView.js';

export default class Application {

	get notes() {
		return Object.freeze(['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']);
	}
	get basicNotes() {
		return Object.freeze(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
	}
	get midiNotes() {
		return this._midiNotes = this._midiNotes || Object.freeze(new Array(128).fill(undefined).map((item, index) => {
			return Object.freeze({
				midi: index,
				name: this.notes[index % 12],
				octave: Math.floor(index / 12)
			});
		}));
	}

	get time() {
		return 3;
	}

	static run() {
		return (new this);
	}

	constructor() {
		this.staffView = new StaffView('svg #note');

		document.querySelector('nav button').addEventListener('click', () => {
			if (this._interval) {
				clearTimeout(this._interval);
			} else {
				this.runTest();
			}
		});
		document.querySelector('#piano').addEventListener('click', (e) => {
			let value = e.target.getAttribute('value');

			if (value) {
				this.checkResult(this.notes.indexOf(value));
			}
		});
	}

	checkResult(index) {
		if (index === this.note.midi % 12) {
			this.resultOk();
			this.runTest();
		} else {
			this.resultFail();
		}
	}

	resultOk() {
		console.log('OK');
	}
	resultFail() {
		console.log('fail');
	}


	onTimeout() {
		this.resultFail();
		this.runTest();
	}

	get note() {
		return this.note;
	}

	set note(note) {
		this._note = note;
		this.staffView.showNote(this._note, this.time);
	}

	runTest() {
		this.counter = this.counter || 0;
		this.counter++;
		clearTimeout(this._interval);
		this.note = this.getRandom({min: 38,max: 67});
		//this.note = this.midiNotes[78];
		this._interval = setTimeout(this.onTimeout.bind(this), (this.time * 1000) + 100);
	}

	getRandom({min, max}) {
		let notes = this.getWithoutHalfTones(this.midiNotes.slice(min, max));

		return this.randomItem(notes);
	}

	randomItem(arr) {
		return arr[this.random(0, arr.length - 1)];
	}

	random(min, max) {
		return Math.floor(Math.random() * (max - min)) + min;
	}

	getWithoutHalfTones(notes) {
		return notes.filter((item, index) => ([1, 3, 6, 8, 10].indexOf(item.midi % 12) < 0));
	}

}
