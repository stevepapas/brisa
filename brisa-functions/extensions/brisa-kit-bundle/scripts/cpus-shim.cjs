// Ensures graphql-codegen works when os.cpus() is empty (some sandboxes).
const os = require('os');
const original = os.cpus.bind(os);
os.cpus = () => {
  const list = original();
  return list.length > 0 ? list : [{ model: 'shim', speed: 0, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } }];
};
