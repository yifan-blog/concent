import React, { Component, Fragment } from 'react';
import {
  MODULE_DEFAULT, CC_FRAGMENT_PREFIX, CURSOR_KEY, CCSYNC_KEY,
  MODULE_GLOBAL, STATE_FOR_ALL_CC_INSTANCES_OF_ONE_MODULE,
  EFFECT_AVAILABLE, EFFECT_STOPPED
} from '../support/constant';
import ccContext from '../cc-context';
import * as util from '../support/util';
import getFeatureStrAndStpMapping from '../core/base/get-feature-str-and-stpmapping';
import * as ev from '../core/event';
import * as ccRef from '../core/ref';
import * as base from '../core/base';
import extractStateByCcsync from '../core/state/extract-state-by-ccsync';
import watchKeyForRef from '../core/watch/watch-key-for-ref';
import getWatchSpec from '../core/watch/get-watch-spec';
import computeValueForRef from '../core/computed/compute-value-for-ref';
import getComputedSpec from '../core/computed/get-computed-spec';

const { ccClassKey_ccClassContext_, fragmentFeature_classKey_,
  store: { getState, getPrevState }, moduleName_stateKeys_, reducer: { _reducerModule_fnNames_ }
} = ccContext;
const okeys = util.okeys;

let seq = 0;
//虽然CcFragment实例默认属于$$default模块，但是它的state是独立的，
function getStateModule() {
  seq++;
  return Symbol(`__for_cc_fragment_state_${seq}__`);
}

/**
 * 根据connect参数动态的把CcFragment划为某个ccClassKey的实例，同时计算出stateToPropMapping值
 * @param connectSpec 形如: {foo:'*', bar:['b1', 'b2']}
 */
function getFragmentClassKeyAndStpMapping(connectSpec) {
  if (!util.isObjectNotNull(connectSpec)) {//代表没有connect到store任何模块的CcFragment
    return { ccClassKey: `${CC_FRAGMENT_PREFIX}_0`, stateToPropMapping: null };
  }

  const { featureStr, stateToPropMapping } = getFeatureStrAndStpMapping(connectSpec);
  let ccClassKey = fragmentFeature_classKey_[featureStr];
  if (ccClassKey) {
    return { ccClassKey, stateToPropMapping };
  } else {
    const oldFragmentNameCount = ccContext.fragmentNameCount;
    const fragmentNameCount = oldFragmentNameCount + 1;
    ccContext.fragmentNameCount = fragmentNameCount;
    ccClassKey = `${CC_FRAGMENT_PREFIX}_${fragmentNameCount}`;
    fragmentFeature_classKey_[featureStr] = ccClassKey;
    return { ccClassKey, stateToPropMapping };
  }
}

let idSeq = 0;
function getEId() {
  idSeq++;
  return Symbol(`__autoGen_${idSeq}__`);
}

export default class CcFragment extends Component {
  constructor(props, context) {
    super(props, context);

    let { ccKey, connect: connectSpec = {}, state = {}, module } = props;
    // 自动赋值connect
    if (module && !connectSpec[module]) connectSpec[module] = '*';

    const { ccClassKey, stateToPropMapping } = getFragmentClassKeyAndStpMapping(connectSpec);

    let ccUniqueKey = '', isCcUniqueKeyAutoGenerated = false;
    if (ccKey) {// for CcFragment, if user supply ccKey to props, ccUniqueKey will equal ccKey
      ccUniqueKey = ccKey;
    } else {
      const { ccKey: ck, ccUniqueKey: cuk, isCcUniqueKeyAutoGenerated: ag } = base.computeCcUniqueKey(false, ccClassKey, ccKey, true);
      ccUniqueKey = cuk;
      isCcUniqueKeyAutoGenerated = ag;
      ccKey = ck;
    }
    const outProps = props.props || props;//把最外层的props传递给用户

    //计算fragment所属的模块
    let fragmentModule = module || okeys(connectSpec)[0] || MODULE_DEFAULT;

    base.buildCcClassContext(ccClassKey, fragmentModule, [], [], [], [], stateToPropMapping, true);
    ccRef.setRef(this, false, ccClassKey, ccKey, ccUniqueKey, {}, true);

    // for CcFragment, just put ccClassKey to module's cc class keys
    const { moduleName_ccClassKeys_ } = ccContext;
    const ccClassKeys = util.safeGetArrayFromObject(moduleName_ccClassKeys_, fragmentModule);
    if (!ccClassKeys.includes(ccClassKey)) ccClassKeys.push(ccClassKey);

    const ctx = ccClassKey_ccClassContext_[ccClassKey];
    const connectedComputed = ctx.connectedComputed || {};
    const connectedState = ctx.connectedState || {};

    const moduleState = connectedState[fragmentModule] || {};
    const moduleComputed = connectedComputed[fragmentModule] || {};

    const reactForceUpdateRef = this.forceUpdate.bind(this);
    const reactSetStateRef = this.setState.bind(this);

    const refConnectedComputed = {};
    const refComputed = {};
    okeys(connectSpec).forEach(moduleName => {
      refConnectedComputed[moduleName] = {};
    });
    const ccState = {
      stateModule: getStateModule(), module: fragmentModule, ccClassKey, ccKey, ccUniqueKey, isCcUniqueKeyAutoGenerated,
      stateToPropMapping, renderCount: 0, initTime: Date.now(), connect: connectSpec
    };

    this.cc = {
      // onUrlChanged: null,
      prevState: state,
      ccState,
      refConnectedComputed,
      refComputed,
      watch: null,
      watchSpec: null,
      computed: null,
      computedSpec: null,
      reactForceUpdate: (cb) => {
        ccState.renderCount += 1;
        //方便用户直接绑定forceUpdate
        if (typeof cb !== 'function') reactForceUpdateRef();
        else reactForceUpdateRef(cb);
      },
      reactSetState: (state, cb) => {
        ccState.renderCount += 1;
        reactSetStateRef(state, cb);
        // reactSetStateRef(state, () => {
        //   if (typeof cb !== 'function') reactForceUpdateRef();
        //   else reactForceUpdateRef(cb);
        // });
      }
    };

    // hook implement fo CcFragment
    const __hookMeta = {
      isCcFragmentMounted: false,
      useStateCount: 0,
      useStateCursor: 0,
      stateArr: [],
      useEffectCount: 0,
      useEffectCursor: 0,
      effectCbArr: [],
      effectSeeAoa: [],// shouldEffectExecute array of array
      effectSeeResult: [],// collect every effect fn's shouldExecute result
      effectCbReturnArr: [],
    };
    this.__hookMeta = __hookMeta;
    const hook = {
      useState: initialState => {
        let cursor = __hookMeta.useStateCursor;
        const stateArr = __hookMeta.stateArr;
        __hookMeta.useStateCursor++;
        if (__hookMeta.isCcFragmentMounted === false) {//render CcFragment before componentDidMount
          __hookMeta.useStateCount++;
          stateArr[cursor] = initialState;
        } else {
          cursor = cursor % __hookMeta.useStateCount;
        }

        const setter = e => {
          if (e.currentTarget && e.type) {
            __sync({ [CURSOR_KEY]: cursor }, e);
          } else {
            stateArr[cursor] = e;
            this.cc.reactForceUpdate();
          }
        }
        return [stateArr[cursor], setter];
      },
      useEffect: (cb, shouldEffectExecute) => {
        let cursor = __hookMeta.useEffectCursor;
        __hookMeta.useEffectCursor++;
        if (__hookMeta.isCcFragmentMounted === false) {
          __hookMeta.effectCbArr.push(cb);
          __hookMeta.effectSeeAoa.push(shouldEffectExecute);
          __hookMeta.useEffectCount++;
        } else {
          // if code running jump into this block, CcFragment already mounted, and now compute result for didUpdate
          cursor = cursor % __hookMeta.useEffectCount;
          if (Array.isArray(shouldEffectExecute)) {
            const len = shouldEffectExecute.length;
            if (len == 0) {
              __hookMeta.effectSeeResult[cursor] = false;// effect fn will been executed only in didMount
            } else {// compare prevSee and curSee
              let effectSeeResult = false;
              const prevSeeArr = __hookMeta.effectSeeAoa[cursor];
              if (!prevSeeArr) {
                effectSeeResult = true;
              } else {
                for (let i = 0; i < len; i++) {
                  if (shouldEffectExecute[i] !== prevSeeArr[i]) {
                    effectSeeResult = true;
                    break;
                  }
                }
              }
              __hookMeta.effectSeeAoa[cursor] = shouldEffectExecute;
              __hookMeta.effectSeeResult[cursor] = effectSeeResult;
              if (effectSeeResult) __hookMeta.effectCbArr[cursor] = cb;
            }
          } else {
            __hookMeta.effectSeeResult[cursor] = true;// effect fn will always been executed in didMount and didUpdate
            __hookMeta.effectSeeAoa[cursor] = shouldEffectExecute;
            __hookMeta.effectCbArr[cursor] = cb;
          }
        }
      }
    };

    const dispatcher = ccRef.getDispatcherRef();
    this.state = state;

    const __sync = (spec, e) => {
      if (spec[CURSOR_KEY] !== undefined) {//来自hook生成的setter调用
        const _cursor = spec[CURSOR_KEY];
        __hookMeta.stateArr[_cursor] = e.currentTarget.value;
        this.cc.reactForceUpdate();
        return;
      }

      const mockE = base.buildMockEvent(spec, e, STATE_FOR_ALL_CC_INSTANCES_OF_ONE_MODULE);
      if (!mockE) return;//参数无效

      const currentTarget = mockE.currentTarget;
      const dataset = currentTarget.dataset;

      if (e && e.stopPropagation) e.stopPropagation();
      if (dataset.ccsync.includes('/')) {// syncModuleState 同步模块的state状态
        dispatcher.$$sync(mockE);
      } else {// syncLocalState 同步本地的state状态
        const { state } = extractStateByCcsync(dataset.ccsync, currentTarget.value, dataset.ccint, this.state, mockE.isToggleBool);
        __fragmentParams.setState(state);
      }
    };

    const effectItems = [];// {fn:function, status:0, eId:'', immediate:true}
    const eid_effectReturnCb_ = {};// fn
    const attchModuleToCcsync = (ccsync) => {
      let _ccsync = ccsync;
      if (!_ccsync.includes('/')) _ccsync = `${this.cc.ccState.module}/ccsync`;
      return _ccsync;
    }

    this.__staticEffectMeta = {
      effectItems,
      eid_effectReturnCb_,
    };

    let isWatchDefined = false;
    let isComputedDefined = false;
    const __fragmentParams = {
      isCcFragment: true,
      refComputed,
      refConnectedComputed,
      connectedComputed,
      connectedState,
      moduleState,
      moduleComputed,
      // 新增defineEffect相关的支持
      defineEffect: (fn, stateKeys, eId, immediate = true) => {
        if (typeof fn !== 'function') throw new Error('type of defineEffect first param must be function');
        if (stateKeys !== null && stateKeys !== undefined) {
          if (!Array.isArray(stateKeys)) throw new Error('type of defineEffect second param must be one of them(array, null, undefined)');
        }

        const _fn = fn.bind(this, this.__fragmentParams, outProps);
        const _eId = eId || getEId();
        const effectItem = { fn: _fn, stateKeys, status: EFFECT_AVAILABLE, eId: _eId, immediate };
        effectItems.push(effectItem);
      },
      stopEffect: (eId) => {
        const target = effectItems.find(v => v.eId === eId);
        if (target) target.status = EFFECT_STOPPED;
      },
      resumeEffect: (eId) => {
        const target = effectItems.find(v => v.eId === eId);
        if (target) target.status = EFFECT_AVAILABLE;
      },
      removeEffect: (eId) => {
        const targetIdx = effectItems.findIndex(v => v.eId === eId);
        if (targetIdx >= 0) effectItems.splice(targetIdx, 1);
      },
      stopAllEffect: () => {
        effectItems.forEach(v => v.status = EFFECT_STOPPED);
      },
      resumeAllEffect: () => {
        effectItems.forEach(v => v.status = EFFECT_AVAILABLE);
      },
      removeAllEffect: () => {
        effectItems.length = 0;
      },
      defineWatch: (watch) => {
        if (isWatchDefined) throw new Error('defineWatch can only been one time');
        const watchSpec = getWatchSpec(watch, this.__fragmentParams);
        this.cc.watch = watch;
        this.cc.watchSpec = watchSpec;
      },
      defineComputed: (computed) => {
        if (isComputedDefined) throw new Error('defineComputed can only been one time');
        const computedSpec = getComputedSpec(computed, this.__fragmentParams);
        this.cc.computed = computed;
        this.cc.computedSpec = computedSpec;
      },
      settings: {},
      reducer: {},
      lazyReducer:{},
      // ------ end ------

      //对布尔值自动取反
      syncBool: (e, delay = -1, idt = '') => {
        if (typeof e === 'string') return __sync.bind(null, { [CCSYNC_KEY]: e, type: 'bool', delay, idt });
        __sync({ type: 'bool' }, e);
      },
      syncmBool: (e, delay = -1, idt = '') => {
        if (typeof e === 'string') {
          const _ccsync = attchModuleToCcsync(e);
          return __sync.bind(null, { [CCSYNC_KEY]: _ccsync, type: 'bool', delay, idt });
        }
        __sync({ type: 'bool' }, e);
      },
      //if <Input onChange={(value:string, value2:string)=>void} />
      // <Input onChange={ctx.sync} /> not work!!!
      // <Input onChange={ctx.sync('foo/f1')} /> ok
      // only <input data-ccsync="foo/f1" onChange={ctx.sync} /> ok
      // only <input onChange={ctx.sync('foo/f1')} /> ok
      sync: (e, val, delay = -1, idt = '') => {
        if (typeof e === 'string') return __sync.bind(null, { [CCSYNC_KEY]: e, type: 'val', val, delay, idt });
        __sync({ type: 'val' }, e);//allow <input data-ccsync="foo/f1" onChange={ctx.sync} />
      },
      syncm: (e, val, delay = -1, idt = '') => {
        if (typeof e === 'string') {
          const _ccsync = attchModuleToCcsync(e);
          return __sync.bind(null, { [CCSYNC_KEY]: _ccsync, type: 'val', val, delay, idt });
        }
        __sync({ type: 'val' }, e);
      },

      //因为val可以是任意类型值，所以不再需要提供setInt
      set: (ccsync, val, delay, idt) => {
        __sync({ [CCSYNC_KEY]: ccsync, type: 'val', val, delay, idt });
      },
      //自动包含模块的set
      setm: (ccsync, val, delay, idt) => {
        const _ccsync = attchModuleToCcsync(ccsync);
        __sync({ [CCSYNC_KEY]: _ccsync, type: 'val', val, delay, idt });
      },
      //对布尔值自动取反
      setBool:(ccsync, delay = -1, idt = '')=>{
        __sync({ [CCSYNC_KEY]:ccsync, type: 'bool', delay, idt });
      },
      //自动包含模块的setToggle
      setmBool:(ccsync, delay = -1, idt = '')=>{
        const _ccsync = attchModuleToCcsync(ccsync);
        __sync({ [CCSYNC_KEY]:_ccsync, type: 'bool', delay, idt });
      },

      // <Input onChange={ctx.syncInt} /> not work!!!
      // <Input onChange={ctx.syncInt('foo/bar')} /> ok
      // <input onChange={ctx.syncInt('foo/bar')} /> ok
      // <input data-ccsync="foo/f1" onChange={ctx.syncInt('foo/fq')} /> ok
      syncInt: (e, delay = -1, idt = '') => {
        if (typeof e === 'string') return __sync.bind(null, { [CCSYNC_KEY]: e, type: 'int', delay, idt });
        __sync({ type: 'int' }, e);//<input data-ccsync="foo/f1" onChange={ctx.syncInt} />
      },
      syncmInt: (e, delay = -1, idt = '') => {
        if (typeof e === 'string') {
          const _ccsync = attchModuleToCcsync(e);
          return __sync.bind(null, { [CCSYNC_KEY]: _ccsync, type: 'int', delay, idt });
        }
        __sync({ type: 'int' }, e);//<input data-ccsync="foo/f1" onChange={ctx.syncInt} />
      },

      onUrlChanged: (cb) => {
        this.cc.onUrlChanged = cb.bind(this);
      },
      hook,
      emit: (event, ...args) => {
        ev.findEventHandlersToPerform(event, { identity: null }, ...args);
      },
      emitIdentity: (event, identity, ...args) => {
        ev.findEventHandlersToPerform(event, { identity }, ...args);
      },
      on: (event, handler) => {
        ev.bindEventHandlerToCcContext(this.cc.ccState.module, ccClassKey, ccUniqueKey, event, null, handler);
      },
      onIdentity: (event, identity, handler) => {
        ev.bindEventHandlerToCcContext(this.cc.ccState.module, ccClassKey, ccUniqueKey, event, identity, handler);
      },
      dispatch: (paramObj, payloadWhenFirstParamIsString, userInputDelay, userInputIdentity) => {
        const d = dispatcher.__$$getDispatchHandler(this.state, false, ccKey, ccUniqueKey, ccClassKey, STATE_FOR_ALL_CC_INSTANCES_OF_ONE_MODULE, this.cc.ccState.module, null, null, null, -1)
        d(paramObj, payloadWhenFirstParamIsString, userInputDelay, userInputIdentity);
      },
      lazyDispatch: (paramObj, payloadWhenFirstParamIsString, userInputDelay, userInputIdentity) => {
        const d = dispatcher.__$$getDispatchHandler(this.state, true, ccKey, ccUniqueKey, ccClassKey, STATE_FOR_ALL_CC_INSTANCES_OF_ONE_MODULE, this.cc.ccState.module, null, null, null, -1)
        d(paramObj, payloadWhenFirstParamIsString, userInputDelay, userInputIdentity);
      },
      callDispatch: (...args) => this.__fragmentParams.dispatch.bind(this, ...args),
      callLazyDispatch: (...args) => this.__fragmentParams.lazyDispatch.bind(this, ...args),
      effect: dispatcher.__$$getEffectHandler(ccKey),
      xeffect: dispatcher.__$$getXEffectHandler(ccKey),
      setModuleState: (module, state, delay, identity) => {
        let _module = module, _state = state, _delay = delay, _identity = identity;
        if (typeof module === 'object') {
          _module = this.cc.ccState.module;
          _state = module; 
          _delay = state; 
          _identity = delay;
        }
        dispatcher.$$changeState(_state, {
          ccKey, module:_module, stateFor: STATE_FOR_ALL_CC_INSTANCES_OF_ONE_MODULE, delay:_delay, identity:_identity
        });
      },
      setGlobalState: (state, delay, identity) => {
        this.__fragmentParams.setModuleState(MODULE_GLOBAL, state, delay, identity);
      },
      state,
      props,
      outProps,
      setState: (state, cb) => {
        const thisCc = this.cc;
        const thisState = this.state;
        const { stateModule, connect } = thisCc.ccState;
        computeValueForRef(stateModule, thisCc.computedSpec, thisCc.refComputed, thisCc.refConnectedComputed, thisState, state, __fragmentParams, true);
        const shouldCurrentRefUpdate = watchKeyForRef(stateModule, thisCc.watchSpec, connect, thisState, state, this.__fragmentParams);
        if (shouldCurrentRefUpdate) this.cc.reactSetState(state, cb);
      },
      forceUpdate: (cb) => {
        this.__fragmentParams.setState(this.state, cb);
      },
    };
    this.__fragmentParams = __fragmentParams;
  }

  componentWillMount() {
    const { setup, bindCtxToMethod } = this.props;
    const ctx = this.__fragmentParams;

    const reducer = ctx.reducer;
    const lazyReducer = ctx.lazyReducer;
    const thisCc = this.cc;
    const thisState = this.state;
    const { stateModule, connect } = thisCc.ccState;
    const dispatch = this.__fragmentParams.dispatch;
    const lazyDispatch = this.__fragmentParams.lazyDispatch;
    const connectModules = okeys(connect);

    //向实例的reducer里绑定方法，key:{module} value:{reducerFn}
    connectModules.forEach(m => {
      const refReducerFnObj = util.safeGetObjectFromObject(reducer, m);
      const refLazyReducerFnObj = util.safeGetObjectFromObject(lazyReducer, m);
      const fnNames = _reducerModule_fnNames_[m] || [];
      fnNames.forEach(fnName => {
        refReducerFnObj[fnName] = (payload, delay, idt) => dispatch(`${m}/${fnName}`, payload, delay, idt);
        refLazyReducerFnObj[fnName] = (payload, delay, idt) => lazyDispatch(`${m}/${fnName}`, payload, delay, idt);
      });
    });

    //先调用setup，setup可能会定义computed,watch，同时也可能调用ctx.reducer,所以setup放在fill reducer之后，分析computedSpec之前
    if (setup) {
      if (typeof setup !== 'function') throw new Error('type of setup must be function');
      const settingsObj = setup(this.__fragmentParams) || {};
      if (!util.isPlainJsonObject(settingsObj)) throw new Error('type of setup return result must be an plain json object');
      const globalBindCtx = ccContext.bindCtxToMethod;

      //优先读自己的，再读全局的
      if (bindCtxToMethod === true || (globalBindCtx === true && bindCtxToMethod !== false)) {
        okeys(settingsObj).forEach(name => {
          const settingValue = settingsObj[name];
          if (typeof settingValue === 'function') settingsObj[name] = settingValue.bind(this, ctx);
        });
      }
      ctx.settings = settingsObj;
    }

    const computedSpec = thisCc.computedSpec;
    //触发计算computed
    if (computedSpec) {
      const refComputed = thisCc.refComputed, refConnectedComputed = thisCc.refConnectedComputed;
      //这里操作的是moduleState，最后一个参数置为true，让无模块的stateKey的计算值能写到refComputed里,
      computeValueForRef(stateModule, computedSpec, refComputed, refConnectedComputed, thisState, thisState, this.__fragmentParams, true);
      connectModules.forEach(m => {
        const mState = getState(m);
        computeValueForRef(m, computedSpec, refComputed, refConnectedComputed, mState, mState, this.__fragmentParams);
      });
    }
  }
  executeHookEffect(callByDidMount) {
    const ctx = this.__fragmentParams;
    const { effectCbArr, effectCbReturnArr } = this.__hookMeta;
    if (callByDidMount) {
      this.__hookMeta.isCcFragmentMounted = true;
      effectCbArr.forEach(cb => {
        const cbReturn = cb(ctx);
        if (typeof cbReturn === 'function') {
          effectCbReturnArr.push(cbReturn);
        } else {
          effectCbReturnArr.push(null);
        }
      });
    } else {
      const { effectSeeResult } = this.__hookMeta;
      effectCbArr.forEach((cb, idx) => {
        const shouldEffectExecute = effectSeeResult[idx];
        if (shouldEffectExecute) {
          const cbReturn = cb(ctx);
          if (typeof cbReturn === 'function') {
            effectCbReturnArr[idx] = cbReturn;
          }
        }
      });
    }
  }
  executeSetupEffect(callByDidMount) {
    const { effectItems, eid_effectReturnCb_ } = this.__staticEffectMeta;
    const ctx = this.__fragmentParams;

    if (callByDidMount) {
      effectItems.forEach(item => {
        if (item.immediate === false) return;
        const cb = item.fn(ctx);
        if (cb) eid_effectReturnCb_[item.eId] = cb;
      });
    } else {//callByDidUpdate
      const prevState = this.cc.prevState;
      const curState = this.state;
      effectItems.forEach(item => {
        const { status, stateKeys, fn, eId } = item;
        if (status === EFFECT_STOPPED) return;
        if (stateKeys) {
          const keysLen = stateKeys.length;
          if (keysLen === 0) return;
          let shouldEffectExecute = false;
          for (let i = 0; i < keysLen; i++) {
            const key = stateKeys[i];
            let targetCurState, targetPrevState, targetKey;
            if (key.includes('/')) {
              const [module, unmoduledKey] = key.split('/');
              const prevState = getPrevState(module);
              if (!prevState) {
                util.justWarning(`key[${key}] is invalid, its module[${module}] has not been declared in store!`);
                continue;
              }
              if (!moduleName_stateKeys_[module].includes(unmoduledKey)) {
                util.justWarning(`key[${key}] is invalid, its unmoduledKey[${unmoduledKey}] has not been declared in state!`);
                continue;
              }
              targetCurState = getState(module);
              targetPrevState = prevState;
              targetKey = unmoduledKey;
            } else {
              targetCurState = curState;
              targetPrevState = prevState;
              targetKey = key;
            }

            if (targetPrevState[targetKey] !== targetCurState[targetKey]) {
              shouldEffectExecute = true;
              break;
            }
          }
          if (shouldEffectExecute) {
            const cb = fn(ctx);
            if (cb) eid_effectReturnCb_[eId] = cb;
          }
        } else {
          const cb = fn(ctx);
          if (cb) eid_effectReturnCb_[eId] = cb;
        }
      });
    }
  }
  componentDidMount() {
    this.executeSetupEffect(true);
    this.executeHookEffect(true);
  }
  shouldComponentUpdate(_, nextState) {
    const curState = this.state;
    this.cc.prevState = curState;
    return curState !== nextState;
  }
  componentDidUpdate() {
    this.executeSetupEffect();
    this.executeHookEffect();
    this.cc.prevState = this.state;//!!!  重置prevState，防止其他模块的更新操作再次执行executeSetupEffect时，判断shouldEffectExecute失效
  }
  componentWillUnmount() {
    const ctx = this.__fragmentParams;
    this.__hookMeta.effectCbReturnArr.forEach(cb => {
      if (typeof cb === 'function') cb(ctx);
    });
    const eid_effectReturnCb_ = this.__staticEffectMeta.eid_effectReturnCb_;
    okeys(eid_effectReturnCb_).forEach(eId => {
      const cb = eid_effectReturnCb_[eId];
      if (typeof cb === 'function') cb(ctx);
    });

    const { ccUniqueKey, ccClassKey } = this.cc.ccState;
    ev.offEventHandlersByCcUniqueKey(ccUniqueKey);
    ccRef.unsetRef(ccClassKey, ccUniqueKey);
    if (super.componentWillUnmount) super.componentWillUnmount();
  }
  render() {
    const { children, render } = this.props
    const view = render || children;
    if (typeof view === 'function') {
      this.__fragmentParams.state = this.state;//注意这里，一定要每次都取最新的
      return view(this.__fragmentParams) || React.createElement(Fragment);
    } else {
      if (React.isValidElement(view)) {
        util.justWarning(`you are trying to specify a react dom to be CcFragment's children, it will never been rendered again no matter how your state changed!!!`);
      }
      return view;
    }
  }

}
