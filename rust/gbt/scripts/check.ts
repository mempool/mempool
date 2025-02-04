import { exec } from 'node:child_process';

async function execAsync(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      }

      resolve(stdout || stderr);
    });
  });
}

async function getRequired() {
  const cat = await execAsync('cat rust-toolchain');

  return cat.split(/\r?\n|\r|\n/g)[0];
}

async function getCargoVer() {
  const cargo = await execAsync('cargo version');

  const verLine = cargo.split(/\r?\n|\r|\n/g)[0];

  return verLine.split(' ')[1];
}

async function checkVer() {
  const wants = await getRequired();
  const got = await getCargoVer();
  
  if (!got.includes(wants)) {
    console.log(`[WARNING] cargo version mismatch with ./rust-toolchain version, wants ${wants} got ${got}`);
  } else {
    console.log(`checkVer: Got cargo ${got} which is the version we want ${wants}, that is good`);
  }
}

checkVer();