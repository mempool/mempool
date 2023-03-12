import { Synth, NoiseSynth, Transport, AutoFilter, Part, Gain, Reverb, PingPongDelay, Oscillator } from 'tone';

// TODO add "Nomen a solempnibus II" ?
// TODO add "Procurans odium II" ?
// TODO add "Guillaume de Machaut - Douce Dame Jolie" ?

const pulseOptions = {
  oscillator: {
    type: 'pulse'
  },
  envelope: {
    release: 0.07
  }
};

const triangleOptions = {
  oscillator: {
    type: 'triangle'
  },
  envelope: {
    release: 0.07
  }
};

const squareOptions = {
  oscillator: {
    type: 'square'
  },
  envelope: {
    release: 0.07
  }
};

const sineOptions = {
  oscillator: {
    type: 'sine'
  },
  envelope: {
    sustain: .8,
    release: 0.8
  }
};

const SNDTRCK = {
  constructor: {
    AutoFilter,
    Gain,
    Reverb,
    Oscillator
  },
  devices: {
    gain: new Gain(1).toDestination(),
    reverb: null,
    delay: null,
    lfo: null,
    autoFilter: null,
    autoFilter2: null,
    pulseSynth: new Synth(pulseOptions),
    pulse2Synth: new Synth(pulseOptions),
    squareSynth: new Synth(squareOptions),
    triangleSynth: new Synth(triangleOptions),
    sineSynth: new Synth(sineOptions),
    drumSynth: new Synth(sineOptions),
    noiseSynth: new NoiseSynth(),
    brownNoiseSynth: new NoiseSynth()
  },
};


SNDTRCK.devices.drumSynth.portamento = .1;
SNDTRCK.devices.brownNoiseSynth.noise.type = 'brown';

SNDTRCK.synths = [
  SNDTRCK.devices.pulseSynth,
  SNDTRCK.devices.pulse2Synth,
  SNDTRCK.devices.squareSynth,
  SNDTRCK.devices.triangleSynth,
  SNDTRCK.devices.sineSynth,
  SNDTRCK.devices.drumSynth,
  SNDTRCK.devices.noiseSynth,
  SNDTRCK.devices.brownNoiseSynth
];

SNDTRCK.synths .map(synth => synth.volume.value = -19);

let enabled;

let pulsePart = new Part();
let pulse2Part = new Part();
let squarePart = new Part();
let trianglePart = new Part();
let sinePart = new Part();
let noisePart = new Part();
let brownNoisePart = new Part();
let drumPart = new Part();
let eventPart = new Part();


export const initSoundtrack = async id => {
  if (SNDTRCK.song?.deinit) SNDTRCK.song.deinit(SNDTRCK);
  const song = await import(
    /* webpackMode: "lazy" */
    `./tracks/${id}/index.js`
  );
  SNDTRCK.song = song.default;

  if (Transport.state === 'started') stopMusic();

  if (pulsePart) pulsePart.remove();
  if (pulse2Part) pulse2Part.remove();
  if (sinePart) sinePart.remove();
  if (trianglePart) trianglePart.remove();
  if (noisePart) noisePart.remove();
  if (brownNoisePart) brownNoisePart.remove();

  SNDTRCK.synths.map(synth =>
    synth.disconnect() && synth.connect(SNDTRCK.devices.gain)
  );
  if (SNDTRCK.song.reverbs) {
    SNDTRCK.devices.reverb = new Reverb({
      decay: 7,
      wet: .5,
    });
    SNDTRCK.song.reverbs.map(synth => {
      SNDTRCK.devices[synth].disconnect();
      SNDTRCK.devices[synth].chain(
        SNDTRCK.devices.reverb,
        SNDTRCK.devices.gain
      );
    });
  } else if (SNDTRCK.devices.reverb) {
    SNDTRCK.devices.reverb.dispose();
  }

  if (SNDTRCK.song.delays) {
    SNDTRCK.devices.delay = new PingPongDelay(
      60 / SNDTRCK.song.bpm * SNDTRCK.song.delay,
      SNDTRCK.song.delayFeedback
    );
    SNDTRCK.song.delays.map(synth => {
      SNDTRCK.devices[synth].chain(
        SNDTRCK.devices.delay,
        SNDTRCK.devices.gain
      );
    });
  } else if (SNDTRCK.devices.delay) {
    SNDTRCK.devices.delay.dispose();
  }
  if (SNDTRCK.song.lfo) {
    SNDTRCK.devices.lfo = new Oscillator({
      frequency: 7,
      volume: 10,
      type: 'sine'
    });
    SNDTRCK.song.lfo.map(synth => {
      SNDTRCK.devices.lfo.connect(SNDTRCK.devices[synth].frequency);
    });
    SNDTRCK.devices.lfo.start();
  } else if (SNDTRCK.devices.lfo) {
    SNDTRCK.devices.lfo.dispose();
  }

  if (SNDTRCK.song.init) SNDTRCK.song.init(SNDTRCK);

  Transport.loop = SNDTRCK.song.loop;
  Transport.loopStart = 0;
  Transport.loopEnd = SNDTRCK.song.length;

  if (SNDTRCK.song.tracks.event) {
    eventPart = new Part((time, note) => {
      const event = new CustomEvent(getSoundtrack(), { detail: note.event });
      window.dispatchEvent(event);
    }, parseNotes(SNDTRCK.song.tracks.event));
  }

  if (!enabled && Transport.state !== 'started') {
    // only start the events
    return startMusic();
  }

  if (SNDTRCK.song.tracks.pulse) {
    pulsePart = new Part((time, note) => {
      SNDTRCK.devices.pulseSynth.triggerAttackRelease(note.name, note.duration, time, note.velocity);
    }, parseNotes(SNDTRCK.song.tracks.pulse));
  }
  if (SNDTRCK.song.tracks.pulse2) {
    pulse2Part = new Part((time, note) => {
      SNDTRCK.devices.pulse2Synth.triggerAttackRelease(note.name, note.duration, time, note.velocity);
    }, parseNotes(SNDTRCK.song.tracks.pulse2));
  }
  if (SNDTRCK.song.tracks.square) {
    squarePart = new Part((time, note) => {
      SNDTRCK.devices.squareSynth.triggerAttackRelease(note.name, note.duration, time, note.velocity);
    }, parseNotes(SNDTRCK.song.tracks.square));
  }
  if (SNDTRCK.song.tracks.triangle) {
    trianglePart = new Part((time, note) => {
      SNDTRCK.devices.triangleSynth.triggerAttackRelease(note.name, note.duration, time, note.velocity);
    }, parseNotes(SNDTRCK.song.tracks.triangle));
  }
  if (SNDTRCK.song.tracks.sine) {
    sinePart = new Part((time, note) => {
      SNDTRCK.devices.sineSynth.triggerAttackRelease(note.name, note.duration, time, note.velocity);
    }, parseNotes(SNDTRCK.song.tracks.sine));
  }
  if (SNDTRCK.song.tracks.noise) {
    noisePart = new Part((time, note) => {
      SNDTRCK.devices.noiseSynth.triggerAttackRelease(note.duration, time, note.velocity);
    }, parseNotes(SNDTRCK.song.tracks.noise));
  }
  if (SNDTRCK.song.tracks.brownNoise) {
    brownNoisePart = new Part((time, note) => {
      SNDTRCK.devices.brownNoiseSynth.triggerAttackRelease(note.duration, time, note.velocity);
    }, parseNotes(SNDTRCK.song.tracks.brownNoise));
  }
  if (SNDTRCK.song.tracks.drum) {
    drumPart = new Part((time, note) => {
      SNDTRCK.devices.drumSynth.setNote('D4', time);
      SNDTRCK.devices.drumSynth.triggerAttackRelease(note.name, note.duration, time + 0.01, note.velocity);
      SNDTRCK.devices.drumSynth.triggerAttackRelease('D1', note.duration, time + 0.02, note.velocity);
    }, parseNotes(SNDTRCK.song.tracks.drum));
  }


  if (enabled && Transport.state !== 'started') {
    startMusic();
  }
};

window.initSoundtrack = initSoundtrack;


export const getSoundtrack = () => SNDTRCK.song?.id;
window.getSoundtrack = getSoundtrack;

export const toggleSoundtrack = enable => {
  enabled = enable;
  if (!enabled) {
    stopMusic();
  } else if (enabled && SNDTRCK.song) {
    startMusic();
  }
};

export const startMusic = async () => {
  if (!SNDTRCK.song || !enabled) {
    if (SNDTRCK.song.tracks.event) {
      await Transport.start('+.1', 0);
      eventPart.start(0);
    }
    return;
  }

  const event = new CustomEvent('toggleSoundtrack', { detail: true });
  window.dispatchEvent(event);

  await Transport.start('+.1', 0);

  if (SNDTRCK.song.tracks.event) eventPart.start(0);
  if (SNDTRCK.song.tracks.pulse) pulsePart.start(0);
  if (SNDTRCK.song.tracks.pulse2) pulse2Part.start(0);
  if (SNDTRCK.song.tracks.square) squarePart.start(0);
  if (SNDTRCK.song.tracks.triangle) trianglePart.start(0);
  if (SNDTRCK.song.tracks.sine) sinePart.start(0);
  if (SNDTRCK.song.tracks.noise) noisePart.start(0);
  if (SNDTRCK.song.tracks.brownNoise) brownNoisePart.start(0);
  if (SNDTRCK.song.tracks.drum) drumPart.start(0);
};

export const stopMusic = () => {
  if (!SNDTRCK.song) return;

  const event = new CustomEvent('toggleSoundtrack', { detail: false });
  window.dispatchEvent(event);
  Transport.stop();
  if (pulsePart) pulsePart.stop(0);
  if (pulse2Part) pulse2Part.stop(0);
  if (squarePart) squarePart.stop(0);
  if (trianglePart) trianglePart.stop(0);
  if (sinePart) sinePart.stop(0);
  if (noisePart) noisePart.stop(0);
  if (brownNoisePart) brownNoisePart.stop(0);
  if (drumPart) drumPart.stop(0);
  if (eventPart) eventPart.stop(0);
};

/**
 * @description Method to change the musiv volume
 * @param {value} value 0-1
 */
export const changeVolume = value => {
  SNDTRCK.devices.gain.gain.rampTo(value, 0);
};

function parseNotes(notes) {
  return notes.map(note => ({
    time: note[0],
    duration: note[1],
    name: note[2],
    velocity: note[3],
    event: note[4]
  }));
}