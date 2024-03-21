// @ts-ignore: Import not found
import { LayoutConfig, GoldenLayout } from 'golden-layout';
import { getConsentCookie } from '../common/cookies';

const ls_key = 'damast-vis-layout';

// Increment this if there are breaking changes in the default layout so old
// layouts are no longer loaded from localStorage. For example, if new views
// emerge, the new default config should be loaded.
const layout_version: string = '3';

const default_config: LayoutConfig = {
  settings: {
    showPopoutIcon: false,
    constrainDragToContainer: true,
  },
  labels: {
    maximise: 'Maximize view',
  },
  dimensions: {
    borderWidth: 5,
    minItemWidth: 200,
    minItemHeight: 150,
  },
  root: {
    type: 'row',
    content: [
      {
        type: 'column',
        width: 20,
        content: [
          {
            type: 'stack',
            height: 30,
            content: [
              {
                type: 'component',
                componentType: 'confidence',
                title: 'Confidence',
              },
              {
                type: 'component',
                componentType: 'source-list',
                title: 'Sources',
              },
              {
                type: 'component',
                componentType: 'tags',
                title: 'Tags',
              },
              {
                type: 'component',
                componentType: 'settings',
                title: 'Settings'
              },
            ]
          },
          {
            type: 'component',
            componentType: 'religion',
            title: 'Religion',
            height: 70,
          }
        ],
      },
      {
        type: 'column',
        content: [
          {
            type: 'row',
            height: 75,
            content: [
              {
                type: 'component',
                componentType: 'map',
                title: 'Map',
                width: 80
              },
              {
                type: 'component',
                componentType: 'location-list',
                title: 'Location List',
                width: 20
              },
            ]
          },
          {
            type: 'stack',
            content: [
              {
                type: 'component',
                componentType: 'timeline',
                title: 'Timeline',
                width: 85
              },
              {
                type: 'component',
                componentType: 'untimed',
                title: 'Untimed Data',
              },
            ]
          }
        ],
      },
    ]
  }
};

interface ConfigProp {
  activeItemIndex?: number;
  content?: ConfigProp[];
  type: 'component' | 'row' | 'column' | 'stack';
  title?: string;
};

const title_icons = /^<i .*>\s*/;

export function storeConfig(layout: GoldenLayout) {
  if (getConsentCookie() !== 'essential') return;

  const cfg = layout.saveLayout();

  // avoid settings dialog always being visible by removing all activeItemIndex entries
  const traverse = (c: ConfigProp) => {
    delete c['activeItemIndex'];
    if (c.content?.length) c.content.forEach(traverse);

    // do not store loading icons in tab titles
    if (c.title && c.type === 'component' && title_icons.test(c.title)) {
      c.title = c.title.replace(title_icons, '');
    }
  };

  cfg.root.content.forEach(traverse);
  
  const obj = JSON.stringify({
    version: layout_version,
    content: cfg
  });
  
  try {
    window.localStorage.setItem(ls_key, obj);
  } catch (err) {
    console.error(err);
  }
}

export function getConfig(): LayoutConfig {
  try {
    const cfg = JSON.parse(window.localStorage.getItem(ls_key));

    if (cfg === null || cfg.version !== layout_version) return default_config;

    const layoutConfig = LayoutConfig.fromResolved(cfg.content);

    return layoutConfig;
  } catch (err) {
    console.error(err);
    return default_config;
  }
}

export function clearConfig() {
  window.localStorage.removeItem(ls_key);
}
