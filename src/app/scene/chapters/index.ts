import { SceneKind } from '../../content/life';
import { ChapterBuilder } from '../chapter-scene';
import { backHome } from './back-home';
import { birth } from './birth';
import { dreamweaver } from './dreamweaver';
import { family } from './family';
import { firstCode } from './first-code';
import { garage } from './garage';
import { kharkivCareer } from './kharkiv-career';
import { krakow } from './krakow';
import { lyceum } from './lyceum';
import { placeholder } from './placeholder';
import { rally } from './rally';
import { school } from './school';
import { university } from './university';
import { war } from './war';

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
  'first-code': firstCode,
  'kharkiv-career': kharkivCareer,
  krakow,
  'back-home': backHome,
  war,
  garage,
};
