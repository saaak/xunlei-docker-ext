export function parseDeviceId(response, deviceName = null) {
  let deviceId = null;

  const tasks = response.tasks || [];
  
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