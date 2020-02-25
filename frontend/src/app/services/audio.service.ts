import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  audio = new Audio();

  constructor() { }

  public playSound(name: 'magic' | 'chime' | 'cha-ching') {
    try {
      this.audio.src = '../../../assets/sounds/' + name + '.mp3';
      this.audio.load();
      this.audio.play();
    } catch (e) {
      console.log('Play sound failed', e);
    }
  }

}
