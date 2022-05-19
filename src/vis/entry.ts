import * as d3 from 'd3';

import Timeline from './timeline';
import ReligionHierarchy from './religion-hierarchy';
import MapPane from './map';
import LocationList from './location-list';
import Untimed from './untimed-display';
import * as T from './datatypes';
import {createColorscales} from './colorscale';
import {getDataset,Dataset} from './dataset';
import ConfidencePane from './confidence-pane';
import SourcePane from './source-pane';
import TagsPane from './tags';
import SettingsPane from './settings-pane';
import * as modal from './modal';
import View from './view';
import {Message} from './message';
import { HistoryControls } from './history-controls';
import {createView} from './goldenlayout-util';
import {getConfig, storeConfig} from './default-layout';

// @ts-ignore: Import not found
import GoldenLayout from 'golden-layout';

import DataLoader from 'worker-loader?filename=[name].js!./fetch.worker';
const dataLoader = new DataLoader();

const messageReceivers: Map<string, View<any, any>> = new Map<string, View<any, any>>();

const workerListener = async function(event: MessageEvent) {
  if (!messageReceivers.has(event.data.target)) {
    console.error(`${event.data.target} is not a valid target`);
    return;
  }

  const recv = messageReceivers.get(event.data.target);
  if (event.data.type === 'set-data') {
    await recv.setData(event.data.data);
  } else if (event.data.type === 'notify-is-loading') {
    await recv.setLoadingState(event.data.data);
  } else if (event.data.type === 'set-brush' || event.data.type === 'clear-brush') {
    await recv.linkData(event.data.data);
  } else if (event.data.type === 'set-map-state' && event.data.target === 'map') {
    // do nothing
  } else {
    console.error('Unparsable worker message:', event.data);
  }
};


const layout_config = getConfig();
const layout = new GoldenLayout(layout_config, d3.select('#goldenlayout-root').node());

import ReligionWorker from 'worker-loader?filename=[name].js!./religion.worker';
createView(ReligionWorker, ReligionHierarchy, 'religion', dataLoader, messageReceivers, workerListener, layout);

import UntimedWorker from 'worker-loader?filename=[name].js!./untimed.worker';
createView(UntimedWorker, Untimed, 'untimed', dataLoader, messageReceivers, workerListener, layout);

import ConfidenceWorker from 'worker-loader?filename=[name].js!./confidence.worker';
createView(ConfidenceWorker, ConfidencePane, 'confidence', dataLoader, messageReceivers, workerListener, layout);

import LocationListWorker from 'worker-loader?filename=[name].js!./location-list.worker';
createView(LocationListWorker, LocationList, 'location-list', dataLoader, messageReceivers, workerListener, layout);

import SourceListWorker from 'worker-loader?filename=[name].js!./source-list.worker';
createView(SourceListWorker, SourcePane, 'source-list', dataLoader, messageReceivers, workerListener, layout);

import TimelineWorker from 'worker-loader?filename=[name].js!./timeline.worker';
createView(TimelineWorker, Timeline, 'timeline', dataLoader, messageReceivers, workerListener, layout);

import MapWorker from 'worker-loader?filename=[name].js!./map.worker';
createView(MapWorker, MapPane, 'map', dataLoader, messageReceivers, workerListener, layout);

import TagsWorker from 'worker-loader?filename=[name].js!./tags.worker';
createView(TagsWorker, TagsPane, 'tags', dataLoader, messageReceivers, workerListener, layout);

import MessageWorker from 'worker-loader?filename=[name].js!./message.worker';
createView(MessageWorker, Message, 'message', dataLoader, messageReceivers, workerListener);

import HistoryWorker from 'worker-loader?filename=[name].js!./history.worker';
createView(HistoryWorker, HistoryControls, 'history', dataLoader, messageReceivers, workerListener);

layout.registerComponent('settings', (container, _) => {
  const view = new SettingsPane(dataLoader, container, layout);
});


/// Callback for every created stack
layout.on( 'stackCreated', function(stack){
    stack.header.controlsContainer.prepend(`<span class="modal-button" title="About this view"><i class="fa fa-fw fa-question-circle-o"></i></span>`);
    d3.select(stack.header.controlsContainer[0]).select('span.modal-button')
      .on('click', () => {
        stack.getActiveContentItem().container.emit('modal-button-clicked');
      });
});


layout.init();

// check if the location has a hash that is a UUID
const url = new URL(window.location.toString());
const re = new RegExp('^#(?<uuid>[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12})$', 'i');  // URL hash is UUID
const hash = re.exec(url.hash);
if (hash) {
  dataLoader.postMessage({ type: 'load-data', data: hash.groups.uuid });
  url.hash = '#';
  window.location.replace(url);
} else {
  dataLoader.postMessage({ type: 'load-data' });
}
