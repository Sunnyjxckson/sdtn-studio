// Small stores for tool settings. Kept out of the main store on purpose.
import { create } from 'zustand';
import { PX_IN_V } from '../../model/garment';

function make<T extends object>(init: T) {
  return create<T & { set: (p: Partial<T>) => void }>((set) => ({ ...init, set: (p) => set(p as never) }));
}

export const usePencilOpts = make({ fidelity: 2.5, blobSize: 24, pressure: true });
export const useShapeOpts = make({ radius: 10, sides: 6, points: 5, inner: 0.5 });
export const useTypeOpts = make({
  font: 'IBM Plex Sans',
  size: 24,
  weight: 400,
  anchor: 'start' as 'start' | 'middle' | 'end',
  letter: 0,
});
export const useXfOpts = make({
  angle: 45,
  sx: 100,
  sy: 100,
  axis: 0,
  shear: 20,
  shearAxis: 'h' as 'h' | 'v',
});
export const useMeasureOpts = make({ ppi: PX_IN_V, readout: '', dimMode: 'linear' as 'linear' | 'angular' | 'radius' | 'diameter' });
export const useBlendOpts = make({ steps: 6 });
