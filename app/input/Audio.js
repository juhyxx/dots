import { midiNotes, getMidiNodeByFreq } from '../notes.js';
import Input from './Input.js';

export default class Audio extends Input {

	get width() {
		return 1000;
	}

	get height() {
		return 200;
	}

	get canvasContext() {
		return this.el.getContext('2d');
	}

	constructor(el) {
		super();
		this.el = el;
		this.el.width = this.width;
		this.el.height = this.height;

		let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		this.analyser = audioCtx.createAnalyser();
		this.analyser.fftSize = Math.pow(2, 14);
		this.fftSize = this.analyser.fftSize;
		this.bufferLength = this.analyser.frequencyBinCount;
		this.dataArray = new Uint8Array(this.bufferLength);
		this.sampleRate;



		navigator.getUserMedia(
			{audio: true},
			(stream) => {
				let input = audioCtx.createMediaStreamSource(stream);
				input.connect(this.analyser);
				this.sampleRate = audioCtx.sampleRate;


			},
			(err) => {
				console.error('The following gUM error occured: ' + err);
			}
		);
		this.render();
	}

	get available() {
		return navigator.getUserMedia !== undefined;
	}

	render() {
		this.renderVisual = requestAnimationFrame(this.render.bind(this));
		this.analyser.getByteFrequencyData(this.dataArray);
		this.canvasContext.fillStyle = 'rgb(119, 74, 15)';
		this.canvasContext.fillRect(0, 0, this.width, this.height);

		let barWidth = (this.width / this.bufferLength);
		barWidth = 1;
		let freqRatio = this.sampleRate / this.fftSize;
		let barHeight;
		let x = 0;


		midiNotes.forEach(item => {
			if (item.octave > -1) {
				this.canvasContext.fillStyle = `rgba(0,0,0,0.1)`;
				this.canvasContext.fillRect(this.width / 4 * Math.log10((item.freq / freqRatio)) * barWidth, 0, 1, this.height);
				if (item.name === 'C') {
					this.canvasContext.fillStyle = `rgba(0,0,0,0.7)`;
					this.canvasContext.fillRect(this.width / 4 * Math.log10((item.freq / freqRatio)) * barWidth, 0, 1, this.height);
					this.canvasContext.fillText(Math.round(item.freq), 5 + this.width / 4 * Math.log10((item.freq / freqRatio)) * barWidth, 10);
					this.canvasContext.fillText(Math.round(item.octave), 5 + this.width / 4 * Math.log10((item.freq / freqRatio)) * barWidth, 20);
				}
			}
		});

		let max = Math.max.apply(this, this.dataArray);


		for (let i = 0; i < this.bufferLength; i++) {
			barHeight = this.dataArray[i];

			if (barHeight > max - 50) {
				if (barHeight === max) {
					let freq = freqRatio * i;
					let note = getMidiNodeByFreq(freq);
					this.canvasContext.fillText(note.name + note.octave, this.width / 4 * Math.log10(x), 10);
				}
				this.canvasContext.fillStyle = `rgb(255,255,255)`;
				this.canvasContext.fillRect(this.width / 4 * Math.log10(x), this.height - (heightRatio * barHeight), barWidth, barHeight * heightRatio);
			} else {
				this.canvasContext.fillStyle = `rgba(150,150,130, 0.5)`;
			}
			let heightRatio = (this.height - 20) / 255;
			x += barWidth;
		}
	}

}
