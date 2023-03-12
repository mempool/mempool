/**
 * @description Method to preload asset
 * @param {String} asset path to asset
 */
export const loadAsset = asset => new Promise(resolve => {
  const newImg = new Image;
  newImg.onload = () => {
    resolve(newImg);
  };
  newImg.src = asset;
});