'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeDashboard = makeDashboard;
exports.addLogData = addLogData;
exports.addTimedOutContainerData = addTimedOutContainerData;
exports.addLiveContainerData = addLiveContainerData;
exports.removeLiveContainerData = removeLiveContainerData;
exports.addWebhookErrorData = addWebhookErrorData;
exports.addResourceUsageData = addResourceUsageData;
exports.setStatus = setStatus;
var blessed = require('blessed');
var contrib = require('blessed-contrib');
var screen = {};
var grid = {};
var logDisplay = {};
var timedOutContainersDisplay = {};
var jobNameDisplay = {};
var nodeNameDisplay = {};
var statusDisplay = {};
var resourceUsageDisplay = {};
var liveContainersDisplay = {};
var webhookErrorDisplay = {};
var initTimedOutContainerData = [];
var initLiveContainerData = [];
var initWebhookErrorData = [];
var initResourceUsageData = [{
  title: 'CPU',
  style: { line: 'red' },
  x: [],
  y: []
}, {
  title: 'RAM',
  style: { line: 'yellow' },
  x: [],
  y: []
}];

function makeDashboard(node, jobname, cb) {
  screen = blessed.screen();
  grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

  logDisplay = grid.set(0, 0, 6, 6, contrib.log, {
    fg: 'green',
    scrollable: true,
    selectedFg: 'green',
    label: 'Service Logs'
  });

  timedOutContainersDisplay = grid.set(0, 6, 6, 4, contrib.table, {
    keys: true,
    fg: 'green',
    interactive: true,
    label: 'Timed Out Containers',
    columnSpacing: 1,
    columnWidth: [24, 24]
  });

  jobNameDisplay = grid.set(0, 10, 2, 2, blessed.box, {
    label: 'Job',
    padding: 2,
    align: 'center',
    content: jobname,
    style: {
      fg: 'green'
    }
  });

  nodeNameDisplay = grid.set(2, 10, 2, 2, blessed.box, {
    label: 'Node',
    padding: 2,
    align: 'center',
    content: node,
    style: {
      fg: 'green'
    }
  });

  statusDisplay = grid.set(4, 10, 2, 2, blessed.box, {
    label: 'Status',
    padding: 2,
    align: 'center',
    content: '...',
    style: {
      fg: 'green'
    }
  });

  resourceUsageDisplay = grid.set(6, 0, 6, 8, contrib.line, {
    showNthLabel: 1,
    maxY: 100,
    label: 'Total Resource Usage',
    showLegend: true,
    legend: { width: 10 }
  });

  liveContainersDisplay = grid.set(6, 8, 3, 4, contrib.table, {
    keys: true,
    fg: 'green',
    interactive: true,
    label: 'Live Containers',
    columnSpacing: 1,
    columnWidth: [24, 24]
  });

  webhookErrorDisplay = grid.set(9, 8, 3, 4, contrib.table, {
    keys: true,
    fg: 'green',
    interactive: true,
    label: 'Webhook Errors',
    columnSpacing: 1,
    columnWidth: [10, 16, 24]
  });

  screen.key(['escape', 'q', 'C-c'], function (ch, key) {
    return process.exit(0);
  });

  logDisplay.on('click', function (mouse) {
    logDisplay.focus();
  });

  timedOutContainersDisplay.on('click', function (mouse) {
    timedOutContainersDisplay.focus();
  });

  liveContainersDisplay.on('click', function (mouse) {
    liveContainersDisplay.focus();
  });

  webhookErrorDisplay.on('click', function (mouse) {
    webhookErrorDisplay.focus();
  });

  liveContainersDisplay.focus();
  screen.render();
  cb();
}

function addLogData(data) {
  logDisplay.log(data);
  screen.render();
}

function addTimedOutContainerData(data) {
  initTimedOutContainerData.push(data);
  timedOutContainersDisplay.setData({
    headers: ['ContainerID', 'Service'],
    data: initTimedOutContainerData
  });
  screen.render();
}

function addLiveContainerData(data) {
  initLiveContainerData = initLiveContainerData.filter(function (x) {
    return JSON.stringify(x) !== JSON.stringify(data);
  });
  initLiveContainerData.push(data);
  liveContainersDisplay.setData({
    headers: ['ContainerID', 'Service'],
    data: initLiveContainerData
  });

  screen.render();
}

function removeLiveContainerData(data) {
  var indexToRemove = initLiveContainerData.findIndex(function (x) {
    return JSON.stringify(x) === JSON.stringify(data);
  });
  if (indexToRemove !== -1) {
    initLiveContainerData.splice(indexToRemove, 1);
    liveContainersDisplay.setData({
      headers: ['ContainerID', 'Service'],
      data: initLiveContainerData
    });

    screen.render();
  }
}

function addWebhookErrorData(data) {
  initWebhookErrorData.push(data);
  webhookErrorDisplay.setData({
    headers: ['Service', 'Type', 'URL'],
    data: initWebhookErrorData
  });
  screen.render();
}

function addResourceUsageData(data) {
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = initResourceUsageData[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var resource = _step.value;

      if (resource.x.length === 5) {
        resource.x.splice(0, 1);
      }
      if (resource.y.length === 5) {
        resource.y.splice(0, 1);
      }
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  initResourceUsageData[0].x.push(data[0].x);
  initResourceUsageData[0].y.push(data[0].y);
  initResourceUsageData[1].x.push(data[1].x);
  initResourceUsageData[1].y.push(data[1].y);

  resourceUsageDisplay.setData(initResourceUsageData);
  screen.render();
}

function setStatus(status) {
  statusDisplay.setContent(status ? 'running' : 'stopped');
}
