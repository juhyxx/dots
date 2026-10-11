// Web MIDI input: forwards note-on messages from every connected device, with the time they arrived.
window.Dots = window.Dots || {};

Dots.Midi = (() => {
  const supported = 'requestMIDIAccess' in navigator;
  let access = null;
  let handler = null;
  let status = supported ? 'off' : 'unsupported';
  const listeners = [];

  const inputs = () => (access ? [...access.inputs.values()].map((i) => i.name) : []);

  function setStatus(s) {
    status = s;
    listeners.forEach((fn) => fn(status, inputs()));
  }

  function onMessage(e) {
    const [st, note, vel] = e.data;
    if ((st & 0xf0) === 0x90 && vel > 0 && handler) handler(note, vel, e.timeStamp);
  }

  function bind() {
    access.inputs.forEach((input) => {
      input.onmidimessage = onMessage;
    });
    setStatus(inputs().length ? 'connected' : 'no-device');
  }

  async function connect() {
    if (!supported) return false;
    try {
      access = await navigator.requestMIDIAccess({ sysex: false });
      access.onstatechange = bind;
      bind();
      return true;
    } catch (err) {
      setStatus('denied');
      return false;
    }
  }

  return {
    supported,
    connect,
    inputs,
    get status() {
      return status;
    },
    onNote(fn) {
      handler = fn;
    },
    onStatus(fn) {
      listeners.push(fn);
      fn(status, inputs());
    },
  };
})();
