// Import and export commands.
import type { VCommand } from '../tools/types';
import { exportPng, exportSvg } from './io_export';

export const ioCommands: VCommand[] = [
  { id: 'exportSvg', title: 'Export SVG', keys: ['mod+shift+e'], run: () => void exportSvg({ base: false, full: false }) },
  { id: 'exportPng', title: 'Export PNG', keys: ['mod+alt+e'], run: () => void exportPng({ base: false, full: false }) },
];
