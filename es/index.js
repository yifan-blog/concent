import _startup from './core/startup';
import _load from './core/load';
import _register from './core/register';
import _r from './core/r';
import _registerToDefault from './core/register-to-default';
import _registerSingleClassToDefault from './core/register-single-class-to-default';
import _configure from './core/configure';
import _call from './core/call';
import _setGlobalState from './core/set-global-state';
import _setState from './core/set-state';
import _getState from './core/get-state';
import _emit from './core/emit';
import _emitWith from './core/emit-with';
import _off from './core/off';
import _connect from './core/connect';
import _dispatch from './core/dispatch';
import _ccContext from './cc-context';
import _createDispatcher from './core/create-dispatcher';
import _CcFragment from './component/CcFragment';

export const startup = _startup;
export const load = _load;
export const run = _load;
export const register = _register;
export const r = _r;
export const registerToDefault = _registerToDefault;
export const registerSingleClassToDefault = _registerSingleClassToDefault;
export const configure = _configure;
export const call = _call;
export const setGlobalState = _setGlobalState;
export const setState = _setState;
export const getState = _getState;
export const emit = _emit;
export const emitWith = _emitWith;
export const off = _off;
export const connect = _connect;
export const dispatch = _dispatch;
export const ccContext = _ccContext;
export const createDispatcher = _createDispatcher;
export const CcFragment = _CcFragment;

const defaultExport = {
  emit,
  emitWith,
  off,
  connect,
  dispatch,
  startup,
  load,
  run,
  register,
  r,
  registerToDefault,
  registerSingleClassToDefault,
  configure,
  call,
  setGlobalState,
  setState,
  getState,
  ccContext,
  createDispatcher,
  CcFragment,
}

if (window) {
  window.cc = defaultExport;
}

export default defaultExport;
