import { SceneKind } from '../../content/life';
import { ChapterBuilder } from '../chapter-scene';
import { firstCode } from './first-code';
import { krakow } from './krakow';
import { placeholder } from './placeholder';

/** One builder per scene kind; add a kind to SceneKind and its builder here. */
export const CHAPTER_BUILDERS: Record<SceneKind, ChapterBuilder> = {
  placeholder,
  'first-code': firstCode,
  krakow,
};
