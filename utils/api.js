import { get, post } from './request.js';

function getDeviceId(deviceName = null) {
  return get('/webman/3rdparty/pan-xunlei-com/index.cgi/drive/v1/tasks?type=user%23runner&device_space=');
}

function getUncompletedTasks(deviceId) {
  /**
   * 获取未完成的任务
   *
   * @returns {Array} 包含任务信息的数组
   */
  const response = get( `/webman/3rdparty/pan-xunlei-com/index.cgi/drive/v1/tasks?space=${encodeURIComponent(deviceId)}&page_token=&filters=%7B%22phase%22%3A%7B%22in%22%3A%22PHASE_TYPE_PENDING%2CPHASE_TYPE_RUNNING%2CPHASE_TYPE_PAUSED%2CPHASE_TYPE_ERROR%22%7D%2C%22type%22%3A%7B%22in%22%3A%22user%23download-url%2Cuser%23download%22%7D%7D&limit=200&device_space=`);
  const tasks = Array.isArray(response.data?.tasks) 
  ? response.data.tasks.map(task => ({
    file_name: task.name,
    name: task.name,
    file_size: parseInt(task.file_size),
    updated_time: task.updated_time,
    progress: task.progress || 0,
    real_path: task.params?.real_path || '',
    speed: parseInt(task.params?.speed || 0),
    created_time: task.created_time,
    origin: task
  })) 
  : [];
  return tasks;
}

function sub

export { getDeviceId, getUncompletedTasks }