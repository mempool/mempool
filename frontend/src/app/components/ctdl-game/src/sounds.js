import { Synth, NoiseSynth, Gain, BitCrusher, now, start } from 'tone';

const gain = new Gain(1).toDestination();
const crusher = new BitCrusher({
  bits: 8,
  wet: 1
});

const pulseOptions = {
  oscillator: {
    type: 'pulse'
  },
  envelope: {
    release: 0
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

const pulseSynth = new Synth(pulseOptions).connect(gain);
const squareSynth = new Synth(squareOptions).connect(gain);
const triangleSynth = new Synth(triangleOptions).connect(gain);
const sineSynth = new Synth(sineOptions).connect(gain);
let noiseSynth = new NoiseSynth().connect(gain);
let noise2Synth = new NoiseSynth();

noise2Synth.chain(crusher, gain);

let enabled = true;

const sounds = {
  select: () => {
    const present = now();
    const dur = .1;

    sineSynth.portamento = 0;
    sineSynth.envelope.attack = .005;
    sineSynth.envelope.decay = .1;
    sineSynth.envelope.sustain = .3;
    sineSynth.envelope.release = .07;

    sineSynth.triggerAttack('A#3', present, .4);
    sineSynth.setNote('A#4', present + dur / 3, .4);
    sineSynth.triggerRelease(present + dur);
  },
  playerHurt: () => {
    const present = now();
    const dur = .1;


    noiseSynth.dispose();
    noiseSynth = new NoiseSynth();
    noiseSynth.connect(gain);
    noiseSynth.noise.type = 'pink';

    noiseSynth.envelope.attack = .005;
    noiseSynth.envelope.decay = .1;
    noiseSynth.envelope.sustain = .3;
    noiseSynth.envelope.release = .07;

    noiseSynth.triggerAttack(present, .3);
    noiseSynth.triggerRelease(present + dur);

    squareSynth.portamento = dur / 3;
    squareSynth.envelope.attack = .005;
    squareSynth.envelope.decay = .1;
    squareSynth.envelope.sustain = .3;
    squareSynth.envelope.release = .07;

    squareSynth.triggerAttack('A#3', present + dur / 2, .2);
    squareSynth.setNote('G3', present + dur / 2 + dur / 3, .2);
    squareSynth.triggerRelease(present + dur / 2 + dur);
  },
  item: () => {
    const present = now();
    const dur = .05;

    sineSynth.portamento = 0;
    sineSynth.envelope.attack = .005;
    sineSynth.envelope.decay = .1;
    sineSynth.envelope.sustain = .3;
    sineSynth.envelope.release = .07;

    sineSynth.triggerAttack('A#4', present, .2);
    sineSynth.setNote('G5', present + dur / 2, .2);
    sineSynth.triggerRelease(present + dur);
  },
  honeyBadger: () => {
    const dur = .08;
    const notes = ['A4', 'C5', 'E5', 'A5', 'G6'];
    let time = now();

    sineSynth.portamento = 0;
    sineSynth.envelope.attack = .05;
    sineSynth.envelope.decay = .1;
    sineSynth.envelope.sustain = .3;
    sineSynth.envelope.release = dur * notes.length * 2;


    notes.forEach(note => {
      sineSynth.triggerAttack(note, time, .01);
      time += dur;
    });
    sineSynth.triggerRelease(time);

  },
  blockFound: () => {
    const present = now();
    const dur = .05;

    sineSynth.portamento = 0;
    sineSynth.envelope.attack = .005;
    sineSynth.envelope.decay = .1;
    sineSynth.envelope.sustain = .3;
    sineSynth.envelope.release = .07;

    sineSynth.triggerAttack('A#5', present, .2);
    sineSynth.triggerRelease(present + dur);
  },
  block: () => {
    const present = now();
    const dur = .05;

    noiseSynth.dispose();
    noiseSynth = new NoiseSynth();
    noiseSynth.connect(gain);
    noiseSynth.noise.type = 'brown';
    noiseSynth.envelope.attack = .005;
    noiseSynth.envelope.decay = .1;
    noiseSynth.envelope.sustain = .3;
    noiseSynth.envelope.release = .07;

    squareSynth.portamento = 0;
    squareSynth.envelope.attack = .005;
    squareSynth.envelope.decay = .1;
    squareSynth.envelope.sustain = .3;
    squareSynth.envelope.release = .07;

    noiseSynth.triggerAttack(present, .2);
    noiseSynth.triggerRelease(present + dur);

    squareSynth.triggerAttack('B3', present + dur / 2, .02);
    squareSynth.triggerRelease(present + dur / 2 + dur);
  },
  clunk: () => {
    const present = now();
    const dur = .025;

    noise2Synth.dispose();
    noise2Synth = new NoiseSynth();
    noise2Synth.connect(gain);
    noise2Synth.noise.type = 'white';
    noise2Synth.envelope.attack = .005;
    noise2Synth.envelope.decay = .1;
    noise2Synth.envelope.sustain = .3;
    noise2Synth.envelope.release = .07;

    squareSynth.portamento = 0;
    squareSynth.envelope.attack = .005;
    squareSynth.envelope.decay = .1;
    squareSynth.envelope.sustain = .3;
    squareSynth.envelope.release = .07;

    noise2Synth.triggerAttack(present, .1);
    noise2Synth.triggerRelease(present + dur);

    squareSynth.triggerAttack('B7', present + dur / 2, .02);
    squareSynth.triggerRelease(present + dur / 2 + dur);
  },
  lightningTorch: () => {
    const present = now();
    const dur = .4;

    noiseSynth.noise.type = 'white';

    noiseSynth.envelope.attack = .0005;
    noiseSynth.envelope.decay = .0005;
    noiseSynth.envelope.sustain = .3;
    noiseSynth.envelope.release = .0005;

    noiseSynth.triggerAttack(present, .02);
    noiseSynth.triggerRelease(present + dur);
  },
  elevator: () => {
    const present = now();
    const dur = .5;

    noiseSynth.noise.type = 'brown';

    noiseSynth.envelope.attack = .0005;
    noiseSynth.envelope.decay = .0005;
    noiseSynth.envelope.sustain = .3;
    noiseSynth.envelope.release = .0005;

    noiseSynth.triggerAttack(present, .02);
    noiseSynth.triggerRelease(present + dur);

    triangleSynth.portamento = 0;
    triangleSynth.envelope.attack = .05;
    triangleSynth.envelope.decay = .1;
    triangleSynth.envelope.sustain = .3;
    triangleSynth.envelope.release = .07;

    triangleSynth.triggerAttack('A1', present, .2);
    triangleSynth.triggerRelease(present + dur);
  },
  elevatorStop: () => {
    const present = now();
    const dur = .3;

    noise2Synth.noise.type = 'pink';

    noise2Synth.envelope.attack = .0005;
    noise2Synth.envelope.decay = .0005;
    noise2Synth.envelope.sustain = .3;
    noise2Synth.envelope.release = 2.3;

    noise2Synth.triggerAttack(present, .4);
    noise2Synth.triggerRelease(present + dur);
  },
  splash: () => {
    const present = now();
    const dur = .7;

    noise2Synth.noise.type = 'white';

    noise2Synth.envelope.attack = .05;
    noise2Synth.envelope.decay = .1;
    noise2Synth.envelope.sustain = 1;
    noise2Synth.envelope.release = 3.3;

    noise2Synth.triggerAttack(present, .03);
    noise2Synth.triggerRelease(present + dur);
  },
  longNoise: () => {
    const present = now();
    const dur = .7;

    noise2Synth.noise.type = 'pink';

    noise2Synth.envelope.attack = .7;
    noise2Synth.envelope.decay = .1;
    noise2Synth.envelope.sustain = 1;
    noise2Synth.envelope.release = 3.3;

    noise2Synth.triggerAttack(present, .4);
    noise2Synth.triggerRelease(present + dur);
  },
  sword: () => {
    const present = now();
    const dur = .05;

    noise2Synth.dispose();
    noise2Synth = new NoiseSynth();
    noise2Synth.connect(gain);
    noiseSynth.noise.type = 'pink';

    noiseSynth.envelope.attack = .05;
    noiseSynth.envelope.decay = .1;
    noiseSynth.envelope.sustain = .3;
    noiseSynth.envelope.release = .17;

    noiseSynth.triggerAttack(present, .1);
    noiseSynth.triggerRelease(present + dur);
  },
  woosh: () => {
    const present = now();
    const dur = .05;

    noise2Synth.dispose();
    noise2Synth = new NoiseSynth();
    noise2Synth.connect(gain);
    noise2Synth.noise.type = 'brown';

    noise2Synth.envelope.attack = .05;
    noise2Synth.envelope.decay = .1;
    noise2Synth.envelope.sustain = .3;
    noise2Synth.envelope.release = .17;

    noise2Synth.triggerRelease(present);
    noise2Synth.triggerAttack(present + 0.001, .1);
    noise2Synth.triggerRelease(present + dur);
  },
  shitcoinerHurt: () => {
    const present = now();
    const dur = .05;

    noise2Synth.dispose();
    noise2Synth = new NoiseSynth();
    noise2Synth.connect(gain);
    noise2Synth.noise.type = 'brown';

    noise2Synth.envelope.attack = .005;
    noise2Synth.envelope.decay = .1;
    noise2Synth.envelope.sustain = .3;
    noise2Synth.envelope.release = .07;

    noise2Synth.triggerRelease(present);
    noise2Synth.triggerAttack(present + 0.001, .3);
    noise2Synth.triggerRelease(present + dur);

    pulseSynth.portamento = 0;
    pulseSynth.envelope.attack = .005;
    pulseSynth.envelope.decay = .1;
    pulseSynth.envelope.sustain = .3;
    pulseSynth.envelope.release = .07;

    pulseSynth.triggerAttack('A#2', present + dur / 2, .05);
    pulseSynth.setNote('G1', present + dur / 2, .05);
    pulseSynth.triggerRelease(present + dur / 2 + dur);
  },
  policeForceHurt: () => {
    const present = now();
    const dur = .1;

    noiseSynth.dispose();
    noiseSynth = new NoiseSynth();
    noiseSynth.connect(gain);
    noiseSynth.noise.type = 'brown';

    noiseSynth.envelope.attack = .005;
    noiseSynth.envelope.decay = .1;
    noiseSynth.envelope.sustain = .3;
    noiseSynth.envelope.release = .07;

    noiseSynth.triggerAttack(present, .05);
    noiseSynth.triggerRelease(present + dur);

    triangleSynth.portamento = dur / 3;
    triangleSynth.envelope.attack = .005;
    triangleSynth.envelope.decay = .1;
    triangleSynth.envelope.sustain = .3;
    triangleSynth.envelope.release = .07;

    triangleSynth.triggerAttack('A#2', present + dur / 2, .1);
    triangleSynth.setNote('A2', present + dur / 2 + dur / 3, .05);
    triangleSynth.triggerRelease(present + dur / 2 + dur);
  },
  rabbitHurt: () => {
    const present = now();
    const dur = .05;

    noise2Synth.dispose();
    noise2Synth = new NoiseSynth();
    noise2Synth.connect(gain);
    noise2Synth.noise.type = 'white';

    noise2Synth.envelope.attack = .005;
    noise2Synth.envelope.decay = .1;
    noise2Synth.envelope.sustain = .3;
    noise2Synth.envelope.release = .07;

    noise2Synth.triggerRelease(present);
    noise2Synth.triggerAttack(present + 0.001, .01);
    noise2Synth.triggerRelease(present + dur / 2);

    squareSynth.portamento = dur / 3;
    pulseSynth.envelope.attack = dur;
    pulseSynth.envelope.decay = .1;
    pulseSynth.envelope.sustain = .3;
    pulseSynth.envelope.release = .07;

    pulseSynth.triggerAttack('A#7', present + dur / 3, .01);
    pulseSynth.setNote('G6', present + dur / 2 * 1.5, .05);
    pulseSynth.triggerRelease(present + dur / 2 + dur);
  },
  goldbugsHurt: () => {
    const present = now();
    const dur = .12;

    noise2Synth.dispose();
    noise2Synth = new NoiseSynth();
    noise2Synth.connect(gain);
    noise2Synth.noise.type = 'white';

    noise2Synth.envelope.attack = .005;
    noise2Synth.envelope.decay = .1;
    noise2Synth.envelope.sustain = .3;
    noise2Synth.envelope.release = .07;

    noise2Synth.triggerRelease(present);
    noise2Synth.triggerAttack(present + 0.001, .001);
    noise2Synth.triggerRelease(present + dur / 2);

    squareSynth.portamento = dur / 3;
    pulseSynth.envelope.attack = dur;
    pulseSynth.envelope.decay = .1;
    pulseSynth.envelope.sustain = .3;
    pulseSynth.envelope.release = .07;

    pulseSynth.triggerAttack('A#8', present, .001);
    pulseSynth.setNote('G7', present + dur / 2 * 1.5, .005);
    pulseSynth.triggerRelease(present + dur / 2 + dur);
  },
  creatureHurt: () => {
    const present = now();
    const dur = .15;

    noise2Synth.dispose();
    noise2Synth = new NoiseSynth();
    noise2Synth.connect(gain);
    noise2Synth.noise.type = 'brown';

    noise2Synth.envelope.attack = .2;
    noise2Synth.envelope.decay = .1;
    noise2Synth.envelope.sustain = .3;
    noise2Synth.envelope.release = .07;

    noise2Synth.triggerRelease(present);
    noise2Synth.triggerAttack(present + 0.001, .1);
    noise2Synth.triggerRelease(present + dur / 2);

    squareSynth.portamento = dur / 3;
    squareSynth.envelope.attack = dur;
    squareSynth.envelope.decay = .1;
    squareSynth.envelope.sustain = .3;
    squareSynth.envelope.release = .07;

    squareSynth.triggerAttack('G1', present + dur / 3, .2);
    squareSynth.setNote('G0', present + dur / 2 * 1.5, .5);
    squareSynth.triggerRelease(present + dur / 2 + dur);
  },
  rumble: () => {
    const present = now();
    const dur = .2;

    noise2Synth = new NoiseSynth();
    noise2Synth.connect(gain);

    noise2Synth.noise.type = 'brown';
    noise2Synth.envelope.attack = dur / 2;
    noise2Synth.envelope.decay = dur;
    noise2Synth.envelope.sustain = .3;
    noise2Synth.envelope.release = dur;

    noise2Synth.triggerRelease(present);
    noise2Synth.triggerAttack(present + 0.001, .02);
    noise2Synth.triggerRelease(present + dur / 2);

    triangleSynth.envelope.attack = dur;
    triangleSynth.envelope.decay = .1;
    triangleSynth.envelope.sustain = .3;
    triangleSynth.envelope.release = dur / 4;

    triangleSynth.triggerAttack('A0', present, .1);
    triangleSynth.triggerAttack('F#0', present + dur * 0.75, .3);
    triangleSynth.triggerRelease(present + dur);
  },
  bark: () => {
    const present = now();
    const dur = .2;

    noise2Synth = new NoiseSynth();
    noise2Synth.connect(gain);

    noise2Synth.noise.type = 'brown';
    noise2Synth.envelope.attack = dur / 3;
    noise2Synth.envelope.decay = dur;
    noise2Synth.envelope.sustain = .3;
    noise2Synth.envelope.release = dur;

    noise2Synth.triggerRelease(present);
    noise2Synth.triggerAttack(present + 0.001, .1);
    noise2Synth.triggerRelease(present + dur / 2);

    noiseSynth.dispose();
    noiseSynth = new NoiseSynth();
    noiseSynth.chain(crusher, gain);
    crusher.bits = 8;

    noiseSynth.noise.type = 'pink';
    noiseSynth.envelope.attack = dur;
    noiseSynth.envelope.decay = dur;
    noiseSynth.envelope.sustain = .3;
    noiseSynth.envelope.release = dur;

    noiseSynth.triggerRelease(present);
    noiseSynth.triggerAttack(present + dur / 4, .03);
    noiseSynth.triggerRelease(present + dur);

    triangleSynth.envelope.attack = dur;
    triangleSynth.envelope.decay = .1;
    triangleSynth.envelope.sustain = .3;
    triangleSynth.envelope.release = dur / 4;

    triangleSynth.triggerAttack('A3', present, .1);
    triangleSynth.triggerAttack('F#2', present + dur * 0.5, .8);
    triangleSynth.triggerRelease(present + dur);
  },
  bearGrowl: () => {
    const present = now();
    const dur = .3;

    noise2Synth = new NoiseSynth();
    noise2Synth.connect(gain);

    noise2Synth.noise.type = 'brown';
    noise2Synth.envelope.attack = dur / 2;
    noise2Synth.envelope.decay = dur;
    noise2Synth.envelope.sustain = .3;
    noise2Synth.envelope.release = dur;

    noise2Synth.triggerRelease(present);
    noise2Synth.triggerAttack(present + 0.001, .02);
    noise2Synth.triggerRelease(present + dur / 2);

    noiseSynth.dispose();
    noiseSynth = new NoiseSynth();
    noiseSynth.chain(crusher, gain);
    crusher.bits = 8;

    noiseSynth.noise.type = 'pink';
    noiseSynth.envelope.attack = dur;
    noiseSynth.envelope.decay = dur;
    noiseSynth.envelope.sustain = .3;
    noiseSynth.envelope.release = dur;

    noiseSynth.triggerRelease(present);
    noiseSynth.triggerAttack(present + dur / 4, .01);
    noiseSynth.triggerRelease(present + dur);

    triangleSynth.envelope.attack = dur;
    triangleSynth.envelope.decay = .1;
    triangleSynth.envelope.sustain = .3;
    triangleSynth.envelope.release = dur / 4;

    triangleSynth.triggerAttack('A0', present, .3);
    triangleSynth.triggerAttack('F#0', present + dur * 0.75, .8);
    triangleSynth.triggerRelease(present + dur);
  },
  bearHurt: () => {
    const present = now();
    const dur = .3;

    noise2Synth = new NoiseSynth();
    noise2Synth.connect(gain);

    noise2Synth.noise.type = 'brown';
    noise2Synth.envelope.attack = dur / 2;
    noise2Synth.envelope.decay = dur;
    noise2Synth.envelope.sustain = .3;
    noise2Synth.envelope.release = dur;

    noise2Synth.triggerRelease(present);
    noise2Synth.triggerAttack(present + 0.001, .2);
    noise2Synth.triggerRelease(present + dur / 2);

    triangleSynth.envelope.attack = 0.004;
    triangleSynth.envelope.decay = .1;
    triangleSynth.envelope.sustain = .3;
    triangleSynth.envelope.release = 0.004;

    triangleSynth.triggerAttack('F1', present, .3);
    triangleSynth.triggerRelease(present + dur);
  },
  drop: () => {
    const present = now();
    const dur = .05;

    crusher.bits = 16;
    noise2Synth.noise.type = 'brown';

    noise2Synth.envelope.attack = .005;
    noise2Synth.envelope.decay = .1;
    noise2Synth.envelope.sustain = .3;
    noise2Synth.envelope.release = .07;

    noise2Synth.triggerRelease(present);
    noise2Synth.triggerAttack(present + 0.001, .05);
    noise2Synth.triggerRelease(present + dur);

    triangleSynth.portamento = 0;
    triangleSynth.envelope.attack = .005;
    triangleSynth.envelope.decay = .1;
    triangleSynth.envelope.sustain = .3;
    triangleSynth.envelope.release = .07;

    triangleSynth.triggerAttack('A#0', present + dur / 2, .6);
    triangleSynth.triggerRelease(present + dur / 2 + dur);
  },
  magic: () => {
    const noises = ['brown', 'brown', 'pink', 'white', 'brown', 'brown'];
    const dur = .15;
    let time = now();

    noiseSynth.envelope.attack = .4;
    noiseSynth.envelope.decay = .1;
    noiseSynth.envelope.sustain = .3;
    noiseSynth.envelope.release = .07;

    triangleSynth.portamento = 0;
    triangleSynth.envelope.attack = .4;
    triangleSynth.envelope.decay = .1;
    triangleSynth.envelope.sustain = .3;
    triangleSynth.envelope.release = .07;

    triangleSynth.triggerAttack('C1', time, .2);
    noises.forEach(noise => {
      noiseSynth.triggerAttack(time, .01);
      noiseSynth.noise.type = noise;
      time += dur;
    });
    noiseSynth.triggerRelease(time + dur);
    triangleSynth.triggerRelease(time + dur);
  },
  burn: () => {
    const present = now();
    const dur = .3;

    noise2Synth.dispose();
    noise2Synth = new NoiseSynth();
    noise2Synth.chain(crusher, gain);
    crusher.bits = 8;
    noise2Synth.noise.type = 'brown';

    noise2Synth.envelope.attack = .004;
    noise2Synth.envelope.decay = 1;
    noise2Synth.envelope.sustain = 1;
    noise2Synth.envelope.release = 3;

    noise2Synth.triggerRelease(present);
    noise2Synth.triggerAttack(present + 0.001, .03);
    noise2Synth.triggerRelease(present + dur);
  },
  explode: () => {
    const present = now();
    const dur = .05;

    crusher.bits = 8;
    noise2Synth.noise.type = 'brown';

    noise2Synth.envelope.attack = .005;
    noise2Synth.envelope.decay = .1;
    noise2Synth.envelope.sustain = .3;
    noise2Synth.envelope.release = 1.3;

    noise2Synth.triggerRelease(present);
    noise2Synth.triggerAttack(present + 0.001, .2);
    noise2Synth.triggerRelease(present + dur);

    triangleSynth.portamento = 0;
    triangleSynth.envelope.attack = .005;
    triangleSynth.envelope.decay = .1;
    triangleSynth.envelope.sustain = .3;
    triangleSynth.envelope.release = 1.2;

    triangleSynth.triggerAttack('A#0', present + dur / 2, .6);
    triangleSynth.triggerRelease(present + dur / 2 + dur);
  }
};

document.addEventListener('click', () => {
  start();
});
export const isSoundLoaded = () => now() > .1;

export const toggleSounds = enable => {
  enabled = enable;
};

export const playSound = id => {
  try {
    if (enabled) sounds[id]();
  } catch(e) {
    if (window.DEBUG) console.log(e);
    // do nothing
  }
};

window.playSound = playSound;