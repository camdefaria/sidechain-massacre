export const ROOMS = ['Coat Check', 'Bar', 'Dance Floor', 'VIP Lounge', 'Back Exit'];

export function difficultyForRoom(r) {
  return {
    digits: 2 + Math.min(2, Math.floor(r / 2)), // 2,2,3,3,4
    flashMs: Math.max(260, 650 - r * 90),
    hintDelay: Math.max(1800, 3400 - r * 350),
  };
}

export function randDigits(n) {
  const min = 10 ** (n - 1);
  const max = 10 ** n - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}
