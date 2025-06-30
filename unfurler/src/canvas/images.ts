import { Image } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';
import config from '../config';
import logger from '../logger';

const svgFactory = {
  bitcoin: (width, height, color) => {
    return `<svg xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:cc="http://creativecommons.org/ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <g transform="translate(0.00630876,-0.00301984)">
  <path fill="${color}" d="m63.033,39.744c-4.274,17.143-21.637,27.576-38.782,23.301-17.138-4.274-27.571-21.638-23.295-38.78,4.272-17.145,21.635-27.579,38.775-23.305,17.144,4.274,27.576,21.64,23.302,38.784z"/>
  <path fill="#FFF" d="m46.103,27.444c0.637-4.258-2.605-6.547-7.038-8.074l1.438-5.768-3.511-0.875-1.4,5.616c-0.923-0.23-1.871-0.447-2.813-0.662l1.41-5.653-3.509-0.875-1.439,5.766c-0.764-0.174-1.514-0.346-2.242-0.527l0.004-0.018-4.842-1.209-0.934,3.75s2.605,0.597,2.55,0.634c1.422,0.355,1.679,1.296,1.636,2.042l-1.638,6.571c0.098,0.025,0.225,0.061,0.365,0.117-0.117-0.029-0.242-0.061-0.371-0.092l-2.296,9.205c-0.174,0.432-0.615,1.08-1.609,0.834,0.035,0.051-2.552-0.637-2.552-0.637l-1.743,4.019,4.569,1.139c0.85,0.213,1.683,0.436,2.503,0.646l-1.453,5.834,3.507,0.875,1.439-5.772c0.958,0.26,1.888,0.5,2.798,0.726l-1.434,5.745,3.511,0.875,1.453-5.823c5.987,1.133,10.489,0.676,12.384-4.739,1.527-4.36-0.076-6.875-3.226-8.515,2.294-0.529,4.022-2.038,4.483-5.155zm-8.022,11.249c-1.085,4.36-8.426,2.003-10.806,1.412l1.928-7.729c2.38,0.594,10.012,1.77,8.878,6.317zm1.086-11.312c-0.99,3.966-7.1,1.951-9.082,1.457l1.748-7.01c1.982,0.494,8.365,1.416,7.334,5.553z"/>
  </g>
</svg>`
  }
}

function getNetworkLogo(network: string, size: number = 24) {
  switch (network) {
    case 'bitcoin':
      return svgFactory.bitcoin(size, size, '#f7931a');
    case 'signet':
      return svgFactory.bitcoin(size, size, '#b028aa');
    case 'testnet':
      return svgFactory.bitcoin(size, size, '#5fd15c');
    case 'testnet4':
      return svgFactory.bitcoin(size, size, '#5fd15c');
    case 'liquid':
      // not yet implemented
      return '';
    default:
      return '';
  }
}

const imageMap: Map<string, Image | Array<{ resolve: (img: Image) => void; reject: (error: Error) => void }>> = new Map();

const localImages = [
  {
    key: 'mempool-logo',
    path: path.join(__dirname, '../../../frontend/src/resources/mempool-space-logo-bigger.png'),
  },
];

const remoteImages = [
  {
    key: 'foundry-logo',
    url: config.API.MEMPOOL + '/services/enterprise/images/foundry/logo',
  },
];

const literalImages = [
  {
    key: 'bitcoin-mainnet-logo',
    svg: getNetworkLogo('bitcoin'),
  },
  {
    key: 'bitcoin-signet-logo',
    svg: getNetworkLogo('signet'),
  },
  {
    key: 'bitcoin-testnet-logo',
    svg: getNetworkLogo('testnet'),
  },
  {
    key: 'bitcoin-testnet4-logo',
    svg: getNetworkLogo('testnet4'),
  },
]

// Preload images at module level
async function preloadImages(): Promise<void> {
  for (const image of localImages) {
    try {
      if (fs.existsSync(image.path)) {
        const logo = new Image();
        logo.src = fs.readFileSync(image.path);
        imageMap.set(image.key, logo);
      } else {
        logger.warn(`image file not found at: ${image.path}`);
      }
    } catch (error) {
      logger.err(`Error preloading images: ${error}`);
    }
  }

  for (const image of remoteImages) {
    // Set an array to collect waiting promises before starting the load
    imageMap.set(image.key, [] as any);

    const logo = new Image();
    logo.onload = () => {
      const waitingPromises = imageMap.get(image.key) as Array<{ resolve: (img: Image) => void; reject: (error: Error) => void }>;
      imageMap.set(image.key, logo);
      
      // Resolve all waiting promises
      waitingPromises.forEach(({ resolve }) => resolve(logo));
    };
    logo.onerror = () => {
      const waitingPromises = imageMap.get(image.key) as Array<{ resolve: (img: Image) => void; reject: (error: Error) => void }>;
      const errorObj = new Error(`Failed to load image: ${image.url}`);
      
      // Reject all waiting promises
      waitingPromises.forEach(({ reject }) => reject(errorObj));
      
      // Remove the failed loading entry
      imageMap.delete(image.key);
    };
    logo.src = image.url;
  }

  for (const image of literalImages) {
    const logo = new Image();
    logo.src = image.svg;
    imageMap.set(image.key, logo);
  }
}

preloadImages();

async function getImage(key: string): Promise<Image> {
  const value = imageMap.get(key);
  
  // Case 1: Image is available -> return immediately
  if (value instanceof Image) {
    return value;
  }
  
  // Case 2: Key does not exist -> fail immediately
  if (value === undefined) {
    throw new Error(`Image not found: ${key}`);
  }
  
  // Case 3: Image is loading -> add to waiting array
  if (Array.isArray(value)) {
    return new Promise<Image>((resolve, reject) => {
      value.push({ resolve, reject });
    });
  }
  
  // Should never reach here
  throw new Error(`Unexpected value type for image key: ${key}`);
}

export { getImage };