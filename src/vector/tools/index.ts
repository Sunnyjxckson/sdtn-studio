// Every vector tool, in tool strip order.
import { anchorTools } from './anchors';
import { blendTools } from './blend';
import { cutTools } from './cut';
import { measureTools } from './measure';
import { paintTools } from './paintTools';
import { penTools } from './pen';
import { pencilTools } from './pencil';
import { selectTools, viewTools } from './select';
import { shapeTools } from './shapes';
import { moreShapeTools } from './shapesMore';
import { transformTools } from './transform';
import { typeTools } from './type';
import type { VToolDef } from './types';

const ORDER: VToolDef['group'][] = ['select', 'draw', 'shape', 'type', 'transform', 'paint', 'measure', 'view'];

const all: VToolDef[] = [
  ...selectTools,
  ...penTools,
  ...anchorTools,
  ...pencilTools,
  ...shapeTools,
  ...moreShapeTools,
  ...typeTools,
  ...transformTools,
  ...cutTools,
  ...blendTools,
  ...paintTools,
  ...measureTools,
  ...viewTools,
];

export const VTOOLS: VToolDef[] = ORDER.flatMap((g) => all.filter((t) => t.group === g));
export const toolById = (id: string): VToolDef => VTOOLS.find((t) => t.id === id) ?? VTOOLS[0];
