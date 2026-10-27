import { EN_CORE } from './en.core';
import { EN_APP } from './en.app';
import { EN_MORE } from './en.more';
import { EN_REST } from './en.rest';
import { EN_WORDS } from './en.words';
import { EN_JOBS } from './en.jobs';

/** Portuguese text -> English. Keys containing {0}, {1}... are templates matched as patterns. */
export const EN: Record<string, string> = { ...EN_WORDS, ...EN_JOBS, ...EN_REST, ...EN_MORE, ...EN_APP, ...EN_CORE };
