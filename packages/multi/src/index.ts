import axon from 'axon';
import { createDataStore as createStore } from './dataStoreProxy';

export function createDataStore(port: number) {
  const socket = axon.socket('req');
  socket.connect(port);

  return createStore(socket);
}
