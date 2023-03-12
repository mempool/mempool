// Llibre Vermell de Montserrat: Anonymous - Mariam Matrem Virginem

import cello from './cello';
import harp from './harp';
import pipe from './pipe';
import strings from './strings';
import viola from './viola';
// import violin from './violin'

export default {
  id: 'mariamMatremVirginem',
  length: 200.97,
  loop: false,
  tracks: {
    pulse: strings,
    pulse2: viola,
    triangle: cello,
    sine: pipe,
    square: harp,
  }
};