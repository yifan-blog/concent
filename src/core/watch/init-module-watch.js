import ccContext from '../../cc-context';
import * as checker from '../checker';
import * as util from '../../support/util';
import { CATE_MODULE } from '../../support/constant';
import configureDepFns from '../base/configure-dep-fns';
import findDepFnsToExecute from '../base/find-dep-fns-to-execute';
import pickDepFns from '../base/pick-dep-fns';

const { isPlainJsonObject, safeGetObjectFromObject } = util;
const callInfo = { payload: null, renderKey: '', delay: -1 };

/**
 * 设置watch值，过滤掉一些无效的key
 */
export default function (module, moduleWatch, append = false) {
  if (!isPlainJsonObject(moduleWatch)) {
    throw new Error(`StartUpOption.watch.${module}'s value is not a plain json object!`);
  }
  checker.checkModuleName(module, false, `watch.${module} is invalid`);

  const rootWatchDep = ccContext.watch.getRootWatchDep();
  const rootWatchRaw = ccContext.watch.getRootWatchRaw();
  const rootComputedValue = ccContext.computed.getRootComputedValue();

  if (append) {
    const ori = rootWatchRaw[module];
    if (ori) Object.assign(ori, moduleWatch);
    else rootWatchRaw[module] = moduleWatch;
  } else {
    rootWatchRaw[module] = moduleWatch;
  }

  const getState = ccContext.store.getState;
  const moduleState = getState(module);
  configureDepFns(CATE_MODULE, { module, state: moduleState, dep: rootWatchDep }, moduleWatch);

  const d = ccContext.getDispatcher();
  const deltaCommittedState = Object.assign({}, moduleState);
  const curDepWatchFns = (committedState, isFirstCall) => pickDepFns(isFirstCall, CATE_MODULE, 'watch', rootWatchDep, module, moduleState, committedState);
  const moduleComputedValue = safeGetObjectFromObject(rootComputedValue, module);
  
  findDepFnsToExecute(
    d && d.ctx, module, d && d.ctx.module, moduleState, curDepWatchFns,
    moduleState, moduleState, deltaCommittedState, callInfo, true,
    'watch', CATE_MODULE, moduleComputedValue,
  );

}