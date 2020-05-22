export function saveState({ spriteSheet, tileMap }) {
  localStorage.setItem('tileMap', JSON.stringify(tileMap.serialize()));
  localStorage.setItem('spriteSheet', JSON.stringify(spriteSheet.serialize()));
  localStorage.setItem('lastSaved', Date.now());
}

export function restoreState() {
  return {
    lastSaved: parseInt(localStorage.getItem('lastSaved'), 10),
    tileMap: JSON.parse(localStorage.getItem('tileMap')),
    spriteSheet: JSON.parse(localStorage.getItem('spriteSheet')),
  };
}