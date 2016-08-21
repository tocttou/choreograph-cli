const blessed = require('blessed');
const contrib = require('blessed-contrib');
let screen = {};
let grid = {};
let logDisplay = {};
let timedOutContainersDisplay = {};
let jobNameDisplay = {};
let nodeNameDisplay = {};
let statusDisplay = {};
let resourceUsageDisplay = {};
let liveContainersDisplay = {};
let webhookErrorDisplay = {};
let initTimedOutContainerData = [];
let initLiveContainerData = [];
let initWebhookErrorData = [];
let initResourceUsageData = [
  {
    title: 'CPU',
    style: { line: 'red' },
    x: [],
    y: []
  },
  {
    title: 'RAM',
    style: { line: 'yellow' },
    x: [],
    y: []
  }
];

export function makeDashboard(node, jobname, cb) {
  screen = blessed.screen();
  grid = new contrib.grid({ rows: 12, cols: 12, screen });

  logDisplay = grid.set(0, 0, 6, 6, contrib.log,
    {
      fg: 'green',
      scrollable: true,
      selectedFg: 'green',
      label: 'Service Logs'
    });

  timedOutContainersDisplay =  grid.set(0, 6, 6, 4, contrib.table,
    {
      keys: true,
      fg: 'green',
      interactive: true,
      label: 'Timed Out Containers',
      columnSpacing: 1,
      columnWidth: [24, 24]
    });

  jobNameDisplay =  grid.set(0, 10, 2, 2, blessed.box,
    {
      label: 'Job',
      padding: 2,
      align: 'center',
      content: jobname,
      style: {
        fg: 'green'
      }
    });

  nodeNameDisplay =  grid.set(2, 10, 2, 2, blessed.box,
    {
      label: 'Node',
      padding: 2,
      align: 'center',
      content: node,
      style: {
        fg: 'green'
      }
    });

  statusDisplay =  grid.set(4, 10, 2, 2, blessed.box,
    {
      label: 'Status',
      padding: 2,
      align: 'center',
      content: '...',
      style: {
        fg: 'green'
      }
    });

  resourceUsageDisplay = grid.set(6, 0, 6, 8, contrib.line,
    {
      showNthLabel: 1,
      maxY: 100,
      label: 'Total Resource Usage',
      showLegend: true,
      legend: { width: 10 }
    });

  liveContainersDisplay = grid.set(6, 8, 3, 4, contrib.table,
    {
      keys: true,
      fg: 'green',
      interactive: true,
      label: 'Live Containers',
      columnSpacing: 1,
      columnWidth: [24, 24]
    });

  webhookErrorDisplay = grid.set(9, 8, 3, 4, contrib.table,
    {
      keys: true,
      fg: 'green',
      interactive: true,
      label: 'Webhook Errors',
      columnSpacing: 1,
      columnWidth: [10, 16, 24]
    });

  screen.key(['escape', 'q', 'C-c'], (ch, key) => {
    return process.exit(0);
  });

  logDisplay.on('click', (mouse) => {
    logDisplay.focus();
  });

  timedOutContainersDisplay.on('click', (mouse) => {
    timedOutContainersDisplay.focus();
  });

  liveContainersDisplay.on('click', (mouse) => {
    liveContainersDisplay.focus();
  });

  webhookErrorDisplay.on('click', (mouse) => {
    webhookErrorDisplay.focus();
  });

  liveContainersDisplay.focus();
  screen.render();
  cb();
}

export function addLogData(data) {
  logDisplay.log(data);
  screen.render();
}

export function addTimedOutContainerData(data) {
  initTimedOutContainerData.push(data);
  timedOutContainersDisplay.setData({
    headers: ['ContainerID', 'Service'],
    data: initTimedOutContainerData
  });
  screen.render();
}

export function addLiveContainerData(data) {
  initLiveContainerData = initLiveContainerData.filter((x) => JSON.stringify(x) !== JSON.stringify(data));
  initLiveContainerData.push(data);
  liveContainersDisplay.setData({
    headers: ['ContainerID', 'Service'],
    data: initLiveContainerData
  });

  screen.render();
}

export function removeLiveContainerData(data) {
  const indexToRemove = initLiveContainerData.findIndex((x) => JSON.stringify(x) === JSON.stringify(data));
  if (indexToRemove !== -1) {
    initLiveContainerData.splice(indexToRemove, 1);
    liveContainersDisplay.setData({
      headers: ['ContainerID', 'Service'],
      data: initLiveContainerData
    });

    screen.render();
  }
}

export function addWebhookErrorData(data) {
  initWebhookErrorData.push(data);
  webhookErrorDisplay.setData({
    headers: ['Service', 'Type', 'URL'],
    data: initWebhookErrorData
  });
  screen.render();
}

export function addResourceUsageData(data) {
  for (let resource of initResourceUsageData) {
    if (resource.x.length === 5) {
      resource.x.splice(0, 1);
    }
    if (resource.y.length === 5) {
      resource.y.splice(0, 1);
    }
  }
  initResourceUsageData[0].x.push(data[0].x);
  initResourceUsageData[0].y.push(data[0].y);
  initResourceUsageData[1].x.push(data[1].x);
  initResourceUsageData[1].y.push(data[1].y);

  resourceUsageDisplay.setData(initResourceUsageData);
  screen.render();
}

export function setStatus(status) {
  statusDisplay.setContent(status ? 'running' : 'stopped');
}
