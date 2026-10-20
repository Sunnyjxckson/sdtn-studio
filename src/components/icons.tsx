export type IconName =
  | 'move' | 'add' | 'erase' | 'cut' | 'hole' | 'distress' | 'text' | 'note' | 'hand'
  | 'undo' | 'redo' | 'eye' | 'eyeoff' | 'up' | 'down' | 'trash' | 'plus' | 'minus' | 'fit'
  | 'brush' | 'smudge' | 'eraser' | 'fill' | 'eyedrop' | 'copy' | 'lock' | 'download' | 'clear';

const PATHS: Record<IconName, string> = {
  move: 'M4,3 L15,10 L10,11 L8,16 Z',
  add: 'M4,10 H16 M10,4 V16',
  erase: 'M3,13 L10,6 L15,11 L10,16 H6 Z M3,17 H17',
  cut: 'M5,5 L15,15 M15,5 L5,15 M3,4 A2,2 0 1,0 3.1,4 M3,16 A2,2 0 1,0 3.1,16',
  hole: 'M10,10 m-6,0 a6,4 0 1,0 12,0 a6,4 0 1,0 -12,0 M5,9 H15 M5,11 H15',
  distress: 'M3,8 L5,6 L7,8 L9,6 L11,8 L13,6 L15,8 L17,6 M3,13 L5,11 L7,13 L9,11 L11,13 L13,11 L15,13',
  text: 'M4,5 H16 M10,5 V16',
  note: 'M4,16 Q6,6 10,10 T16,4 M13,4 H16 V7',
  hand: 'M10,3 V17 M3,10 H17 M10,3 L8,5 M10,3 L12,5 M10,17 L8,15 M10,17 L12,15 M3,10 L5,8 M3,10 L5,12 M17,10 L15,8 M17,10 L15,12',
  undo: 'M7,5 L3,9 L7,13 M3,9 H12 Q17,9 17,13 Q17,16 13,16',
  redo: 'M13,5 L17,9 L13,13 M17,9 H8 Q3,9 3,13 Q3,16 7,16',
  eye: 'M1,10 Q10,2 19,10 Q10,18 1,10 Z M10,10 m-2.5,0 a2.5,2.5 0 1,0 5,0 a2.5,2.5 0 1,0 -5,0',
  eyeoff: 'M1,10 Q10,2 19,10 Q10,18 1,10 Z M3,17 L17,3',
  up: 'M5,12 L10,6 L15,12',
  down: 'M5,8 L10,14 L15,8',
  trash: 'M4,6 H16 M8,6 V4 H12 V6 M6,6 L7,17 H13 L14,6',
  plus: 'M4,10 H16 M10,4 V16',
  minus: 'M4,10 H16',
  fit: 'M3,7 V3 H7 M13,3 H17 V7 M17,13 V17 H13 M7,17 H3 V13',
  brush: 'M16,3 L9,11 M9,11 Q5,11 5,15 Q5,17 3,17 Q9,18 10,13 Z M12,7 L14,9',
  smudge: 'M8,17 V9 Q8,7 9.5,7 Q11,7 11,9 V8 Q11,6 12.5,6 Q14,6 14,8 V9 Q14,7.5 15.3,7.5 Q16.5,7.5 16.5,9 V13 Q16.5,17 12,17 Z M8,11 L6,9 Q4.5,8 4,9.5 L7,15',
  eraser: 'M3,13 L10,6 L15,11 L10,16 H6 Z M6.5,9.5 L11.5,14.5 M3,17 H17',
  fill: 'M4,10 L10,4 L16,10 L10,16 Z M4,10 H16 M17,13 Q18.5,15.5 17,16.5 Q15.5,15.5 17,13 Z',
  eyedrop: 'M13,3 L17,7 L15,9 L11,5 Z M12,6 L5,13 L4,16 L7,15 L14,8',
  copy: 'M7,7 H16 V16 H7 Z M4,13 V4 H13',
  lock: 'M5,9 H15 V17 H5 Z M7,9 V6 Q7,3 10,3 Q13,3 13,6 V9',
  download: 'M10,3 V13 M6,9 L10,13 L14,9 M4,17 H16',
  clear: 'M4,4 H16 V16 H4 Z M7,7 L13,13 M13,7 L7,13',
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
