import StaffView from 'StaffView.js';
import { $ } from 'shortcuts.js';

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
		return this._time || 3;
	}

	set time(time) {
		this._time = time;
	}

	static run() {
		return (new this);
	}

	constructor() {
		this.staffView = new StaffView('svg #note');
		this._results = {};

		$('nav button').addEventListener('click', () => {
			console.log(this._interval);
			if (this._interval) {
				$('nav button').innerHTML = '<i class="fa fa-play"></i>';
				clearTimeout(this._interval);
				this._interval = undefined;
				$('body').className = '';
			} else {
				$('body').className = 'play';
				this._results = {};
				this.updateProgress();
				$('nav button').innerHTML = '<i class="fa fa-stop"></i>';
				this.runTest();
			}
		});
		$('#piano').addEventListener('click', (e) => {
			let value = e.target.getAttribute('value');

			if (value) {
				this.checkResult(this.notes.indexOf(value));
			}
		});
		$('#range').addEventListener('change', (e) => {
			this.time = 11 - parseInt(e.target.value, 10);
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

	updateProgress() {
		let fail = 0,
			ok = 0;

		Object.keys(this._results).forEach(key => {
			let item = this._results[key];
			fail = fail + item.fail;
			ok = ok + item.ok;
		});


		$('#progress .ok').style['flex-grow'] = ok || 1;
		$('#progress .fail').style['flex-grow'] = fail || 1;
		$('#progress .ok').innerHTML = ok;
		$('#progress .fail').innerHTML = fail;
	}

	resultOk() {
		this._results[this.note.midi] = this._results[this.note.midi] || {
			ok: 0,
			fail: 0
		};
		this._results[this.note.midi].ok = this._results[this.note.midi].ok + 1;
		this.updateProgress();
	}
	resultFail() {
		this._results[this.note.midi] = this._results[this.note.midi] || {
			ok: 0,
			fail: 0
		};
		this._results[this.note.midi].fail = this._results[this.note.midi].fail + 1;
		this.updateProgress();
	}


	onTimeout() {
		this.resultFail();
		this.runTest();
	}

	get note() {
		return this._note;
	}

	set note(note) {
		this._note = note;
		this.staffView.showNote(this._note, this.time);
	}

	runTest() {
		this.counter = this.counter || 0;
		this.counter++;
		clearTimeout(this._interval);
		this.note = this.getRandom({min: 38,max: 77});
		//this.note = this.midiNotes[78];
		this._interval = setTimeout(this.onTimeout.bind(this), (this.time * 1000) + 100);
	}

	getRandom({min, max}) {
		let notes = this.getWithoutHalfTones(this.midiNotes.slice(min, max));
		let note = this.randomItem(notes);

		while (note === this.note) {
			note = this.randomItem(notes);
		}
		return note;
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
