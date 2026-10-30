/* bus.js：全局事件總線（契約 §4，標準事件見契約表格，可自定義新事件但不得重名改義） */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});

  XG.bus = {
    _map: {}, // { 事件名: [回調...] }

    // 訂閱事件，返回取消訂閱函數
    on(evt, fn) {
      (this._map[evt] = this._map[evt] || []).push(fn);
      const self = this;
      return function () { self.off(evt, fn); };
    },

    // 取消訂閱某個回調
    off(evt, fn) {
      const list = this._map[evt];
      if (!list) return;
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
      if (!list.length) delete this._map[evt];
    },

    // 發佈事件；逐個調用回調，單個回調異常不影響其他訂閱者
    emit(evt, payload) {
      const list = this._map[evt];
      if (!list) return;
      // slice 拷貝，防止回調中 on/off 導致遍歷錯位
      list.slice().forEach(function (fn) {
        try {
          fn(payload);
        } catch (e) {
          console.error('[bus] 事件 ' + evt + ' 的回調執行出錯', e);
        }
      });
    },
  };
})();
