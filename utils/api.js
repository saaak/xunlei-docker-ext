import { get, post } from './request.js';

function getDeviceId(deviceName = null) {
  return get('/webman/3rdparty/pan-xunlei-com/index.cgi/drive/v1/tasks?type=user%23runner&device_space=');
}

function getUncompletedTasks(deviceId) {
  return get( `/webman/3rdparty/pan-xunlei-com/index.cgi/drive/v1/tasks?space=${encodeURIComponent(deviceId)}&page_token=&filters=%7B%22phase%22%3A%7B%22in%22%3A%22PHASE_TYPE_PENDING%2CPHASE_TYPE_RUNNING%2CPHASE_TYPE_PAUSED%2CPHASE_TYPE_ERROR%22%7D%2C%22type%22%3A%7B%22in%22%3A%22user%23download-url%2Cuser%23download%22%7D%7D&limit=200&device_space=`);
}

function getCompletedTasks(deviceId) {
  return get(`/webman/3rdparty/pan-xunlei-com/index.cgi/drive/v1/tasks?space={${encodeURIComponent(deviceId)}&page_token=&filters=%7B%22phase%22%3A%7B%22in%22%3A%22PHASE_TYPE_COMPLETE%22%7D%2C%22type%22%3A%7B%22in%22%3A%22user%23download-url%2Cuser%23download%22%7D%7D&limit=200&device_space=`);
}

function extractFileList(url) {
  return post('/webman/3rdparty/pan-xunlei-com/index.cgi/drive/v1/resource/list?device_space=',
    { urls: url}
  )
}

function createFolder(createFolderBody) {
  return post(`/webman/3rdparty/pan-xunlei-com/index.cgi/drive/v1/files?device_space=`, createFolderBody);     
}

function submitTask(taskBody) {
  return post(`/webman/3rdparty/pan-xunlei-com/index.cgi/drive/v1/task?device_space=`, taskBody);
}

export { getDeviceId, getUncompletedTasks, extractFileList, createFolder, submitTask }