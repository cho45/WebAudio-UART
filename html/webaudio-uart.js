navigator.getMedia = (
	navigator.getUserMedia ||
	navigator.webkitGetUserMedia ||
	navigator.mozGetUserMedia ||
	navigator.msGetUserMedia
);

window.AudioContext = (
	window.AudioContext ||
	window.webkitAudioContext ||
	window.mozAudioContext ||
	window.msAudioContext
);



var UART = function () { this.init.apply(this, arguments) };
UART.prototype = {
	init : function (opts) {
		this.context = opts.context;
		this.baudrate = opts.baudrate;
		this.dataBit = 8; // FIXED
		this.startBit = 1;
		this.stopBit = opts.stopBit || 1;
		this.parity = false;
		this.modulateFrequency = opts.modulateFrequency || this.context.sampleRate / 4;
		this.wait = opts.wait || 30;
	},

	transmit : function (bytes, dest) {
		if (!dest) dest = this.context.destination;

		if (typeof bytes == 'string') {
			var b = [];
			for (var i = 0, len = bytes.length; i < len; i++) {
				b.push(bytes.charCodeAt(i) & 0xff);
			}
			bytes = b;
		}

		var buffer = this.createModulatedBuffer(bytes);
		var source = this.context.createBufferSource();
		source.buffer = buffer;
		source.connect(dest);
		source.start(0);
	},

	createModulatedBuffer : function (bytes) {
		var self = this;

		var unit      = self.context.sampleRate / self.baudrate;
		var wait      = self.wait;
		var bitsPerByte = 8 + self.startBit + self.stopBit;

		var buffer    = self.context.createBuffer(1, bytes.length * bitsPerByte * unit + (wait * 2 * unit), self.context.sampleRate);
		var data      = buffer.getChannelData(0);
		var position  = 0;

		var phase = 0;
		var toneDelta = 2 * Math.PI * self.modulateFrequency / self.context.sampleRate;  

		function sendBit (bit, length) {
			var len = length * unit;
			if (0) {
				if (self.modulateFrequency === self.context.sampleRate / 2) {
					for (var i = 0; i < len; i++) {
						phase += toneDelta;
						data[position++] = (position % 2 ? 1 : -1) * bit;
					}
				} else {
					for (var i = 0; i < len; i++) {
						phase += toneDelta;
						data[position++] = Math.sin(phase) * bit;
					}
				}
			} else {
				for (var i = 0; i < len; i++) {
					data[position++] = bit ? 1 : -1;
				}
			}
		}

		function sendByte (byte) {
			sendBit(0, self.startBit);
			for (var b = 0; b < 8; b++) {
				//  least significant bit first
				if (byte & (1<<b)) {
					sendBit(1, 1);
				} else {
					sendBit(0, 1);
				}
			}
			sendBit(1, self.stopBit);
		}

		sendBit(1, wait);
		for (var i = 0, len = bytes.length; i < len; i++) {
			sendByte(bytes[i]);
		}
		sendBit(1, wait);

		return buffer;
	}
};


window.onload = function () {
	console.log('load');

	var context = new AudioContext();

	var output = context.createGain();

	output.connect(context.destination);

	var uart = new UART({
		context: context,
		baudrate: 9600
	});


	WebAudioDebug.prove(context, output, {
		bufferSize : 64e3,
		windowTime : 100e-3,
		highResolution : false,
		trigger : WebAudioDebug.OscilloscopeNode.Trigger.RaisingEdge({ triggerChannel: 0, width : 10, threshold : 0.5 }),
		continuous : false
	});


	setTimeout(function () {
		uart.transmit("SSID:Foobar\nPassword:madakimetenai", output);
	}, 500);


	document.body.onclick = function () {
		uart.transmit("SSID:Foobar\nPassword:madakimetenai", output);
	};
};
