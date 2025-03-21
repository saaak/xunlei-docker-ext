export function parseDeviceId(response) {
  let deviceId = null;

  if (response.status === 500) {
    throw new Error('Not logged in to Xunlei account');
  }
  
  if (response.data?.error_code === 403) {
    throw new Error('Pan auth invalid');
  }

  const tasks = response.data?.tasks || [];
  
  if (tasks.length === 0) {
    throw new Error('No remote device is bound');
  }

  if (deviceName) {
    const device = tasks.find(task => task.name === deviceName);
    if (!device) {
      throw new Error(`Device ${deviceName} not found`);
    }
    deviceId = device.params?.target;
  } else {
    if (tasks.length > 1) {
      console.warn(`Multiple devices found, using first one: ${tasks[0].device_name}`);
    }
    deviceId = tasks[0].params?.target;
  }
  return deviceId;
}