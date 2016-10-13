import { getMidiNodeByFreq } from '../notes.js';
import Input from './Input.js';

export default class Audio extends Input {

	constructor(el) {
		super();
		this.el = el;
		let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		this.analyser = audioCtx.createAnalyser();
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
		this.renderFreq();
	}

	get available() {
		return navigator.getUserMedia !== undefined;
	}

	renderTime() {
		let WIDTH = 300;
		let HEIGHT = 100;
		let canvasCtx = this.el.getContext('2d');

		this.renderVisual = requestAnimationFrame(this.renderTime.bind(this));

		this.analyser.getByteTimeDomainData(this.dataArray);
		canvasCtx.fillStyle = 'rgb(200, 200, 200)';
		canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
		canvasCtx.lineWidth = 2;
		canvasCtx.strokeStyle = 'rgb(0, 0, 0)';
		canvasCtx.beginPath();

		let sliceWidth = WIDTH * 1.0 / this.bufferLength;
		let x = 0;

		for (let i = 0; i < this.bufferLength; i++) {
			let v = this.dataArray[i] / 128.0;
			let y = v * HEIGHT / 2;

			if (i === 0) {
				canvasCtx.moveTo(x, y);
			} else {
				canvasCtx.lineTo(x, y);
			}
			x += sliceWidth;
		}

		canvasCtx.lineTo(this.el.width, this.el.height / 2);
		canvasCtx.stroke();
	}

	renderFreq() {
		let WIDTH = 300;
		let HEIGHT = 150;
		let canvasCtx = this.el.getContext('2d');

		this.renderVisual = requestAnimationFrame(this.renderFreq.bind(this));

		this.analyser.getByteFrequencyData(this.dataArray);

		canvasCtx.fillStyle = 'rgb(255, 255, 255)';
		canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

		var barWidth = (WIDTH / this.bufferLength) * 2.5;
		var barHeight;
		var x = 0;

		let max = Math.max.apply(this, this.dataArray);
		let freqRatio = this.sampleRate / this.fftSize;

		for (var i = 0; i < this.bufferLength; i++) {
			barHeight = this.dataArray[i];


			if (barHeight > 180) {
				if (barHeight === max) {
					let freq = freqRatio * i;

					console.log(i, freq, getMidiNodeByFreq(freq));

				}
				canvasCtx.fillStyle = `rgb(255,80,80)`;
			} else {
				canvasCtx.fillStyle = `rgb(100,100,100)`;
			}
			canvasCtx.fillRect(x, HEIGHT - barHeight / 2, barWidth, barHeight / 2);



			x += barWidth + 1;
		}
	}

}
