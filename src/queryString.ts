import type { Features } from './useFeatures';

export type QueryFlagsOptions = {
  /** Query parameter to read. Defaults to `ff`. */
  param?: string;
  /**
   * Query string to parse, with or without its leading `?`. Defaults to
   * `location.search` when there is a `location`.
   */
  search?: string;
};

const DEFAULT_PARAM = 'ff';

const defaultSearch = (): string => {
  return typeof location === 'undefined' ? '' : location.search;
};

/**
 * Applies flag overrides from the query string, on top of whatever the registry
 * already holds — this layers, it does not replace.
 *
 * `?ff=new-navbar` turns a flag on, a `-` prefix turns it off, values can be
 * comma-separated and the parameter can repeat:
 *
 * ```
 * ?ff=new-navbar,-beta-settings
 * ?ff=new-navbar&ff=-beta-settings
 * ```
 *
 * Returns the flags it touched, which is what a debug panel would display.
 * Call it after `persistFeatures` so overrides win over the stored state.
 */
export const applyQueryFlags = <Flag extends string>(
  features: Features<Flag>,
  options: QueryFlagsOptions = {}
): Flag[] => {
  const param = options.param ?? DEFAULT_PARAM;
  const search = options.search ?? defaultSearch();

  if (!search) {
    return [];
  }

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const touched: Flag[] = [];

  for (const value of params.getAll(param)) {
    for (const entry of value.split(',')) {
      const trimmed = entry.trim();
      if (!trimmed) {
        continue;
      }

      const disabling = trimmed.startsWith('-');
      const flag = (disabling ? trimmed.slice(1).trim() : trimmed) as Flag;
      if (!flag) {
        continue;
      }

      if (disabling) {
        features.disable(flag);
      } else {
        features.enable(flag);
      }
      touched.push(flag);
    }
  }

  return touched;
};
