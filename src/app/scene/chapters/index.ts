import { SceneKind } from '../../content/life';
import { ChapterBuilder } from '../chapter-scene';
import { birth } from './birth';
import { dreamweaver } from './dreamweaver';
import { family } from './family';
import { lyceum } from './lyceum';
import { placeholder } from './placeholder';
import { rally } from './rally';
import { school } from './school';
import { university } from './university';

/** One builder per scene kind; add a kind to SceneKind and its builder here. */
export const CHAPTER_BUILDERS: Record<SceneKind, ChapterBuilder> = {
  placeholder,
  birth,
  school,
  lyceum,
  university,
  dreamweaver,
  family,
  rally,
};
