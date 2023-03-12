import Block from '../Block';
import Human from '../npcs/Human';
import Citizen from '../npcs/Citizen';
import NPC from '../npcs/NPC';
import Des from '../npcs/Des';
import Soulexporter from '../npcs/Soulexporter';
import SoulexBoy from '../npcs/SoulexBoy';
import Wiz from '../npcs/Wiz';
import Item from '../Item';

// TODO can we somehow resolve this? I don't want to load all game objects ever from the start
export const gameObjects = {
    Block,
    Human,
    Citizen,
    Item,
    NPC,
    Des,
    Soulexporter,
    SoulexBoy,
    Wiz
};