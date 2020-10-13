import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  audio = new Audio();
  isPlaying = false;

  constructor() { }

  public playSound(name: 'magic' | 'chime' | 'cha-ching' | 'bright-harmony') {
    if (this.isPlaying) {
      return;
    }
    this.isPlaying = true;
    this.audio.src = '../../../resources/sounds/' + name + '.mp3';
    this.audio.load();
    this.audio.play().catch((e) => {
      console.log('Play sound failed' + e);
    });
    setTimeout(() => this.isPlaying = false, 100);
  }
}
