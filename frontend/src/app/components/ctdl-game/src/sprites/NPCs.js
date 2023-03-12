import { addTextToQueue } from '../textUtils';

export default {
  wizardWithNoMoney: {
    frames: [
      { x: 52, y: 0, w: 13, h: 28 },
      { x: 66, y: 0, w: 13, h: 28 }
    ],
    static: true,
    select: npc => {
      npc.frame = window.SELECTEDCHARACTER.getCenter().x > npc.getCenter().x ? 1 : 0;
      addTextToQueue('Wizard with no money:\nI wish I could use my magic\nto create bitcoin.');
      addTextToQueue('Wizard with no money:\nBut by Merlin\'s beard...\nit\'s impossible!', () => {
        npc.isSelected = false;
      });
    }
  }
};