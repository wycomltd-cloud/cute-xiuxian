/* save.js：存檔 API（契約 §8：save/load/reset/export/import；定時器與頁面鉤子由 main.js 負責） */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});

  // 默認值深合併（讀檔容錯）：以默認結構為骨架，用存檔值覆蓋；
  // 存檔缺失的鍵補默認值，存檔多出的鍵原樣保留（兼容舊檔與未來擴展）
  function mergeDeep(def, saved) {
    if (Array.isArray(def)) {
      return Array.isArray(saved) ? XG.util.deepClone(saved) : XG.util.deepClone(def);
    }
    if (def !== null && typeof def === 'object') {
      const src = (saved !== null && typeof saved === 'object' && !Array.isArray(saved)) ? saved : {};
      const out = {};
      for (const k of Object.keys(def)) out[k] = mergeDeep(def[k], src[k]);
      for (const k of Object.keys(src)) {
        if (!(k in def)) out[k] = XG.util.deepClone(src[k]);
      }
      return out;
    }
    return saved === undefined ? def : saved;
  }

  // JSON 字符串 → base64（encodeURIComponent 技巧處理中文 UTF-8）
  function encode64(json) {
    return btoa(unescape(encodeURIComponent(json)));
  }

  // base64 → JSON 字符串（encode64 的逆過程）
  function decode64(b64) {
    return decodeURIComponent(escape(atob(b64)));
  }

  XG.save = {
    // 序列化 state → localStorage（同時刷新 lastSeen 供離線結算）
    save() {
      try {
        XG.state.lastSeen = Date.now();
        localStorage.setItem(XG.cfg.SAVE_KEY, JSON.stringify(XG.state));
      } catch (e) {
        console.error('[save] 存檔失敗', e);
      }
    },

    // 讀檔並做默認值深合併（容錯缺字段），返回 bool 是否有檔
    load() {
      let raw = null;
      try {
        raw = localStorage.getItem(XG.cfg.SAVE_KEY);
      } catch (e) {
        console.error('[save] 讀取存檔失敗', e);
      }
      if (!raw) return false; // 無存檔，保留 state.js 建立的默認新檔
      try {
        const obj = JSON.parse(raw);
        XG.state = mergeDeep(XG.newState(), obj);
        if (XG.character) XG.character.normalize();
        return true;
      } catch (e) {
        console.error('[save] 存檔損壞，已重開新檔', e);
        XG.state = XG.newState();
        return false;
      }
    },

    // 清檔重開（刪除本地存檔並重置為默認狀態；是否刷新頁面由調用方決定）
    reset() {
      try {
        localStorage.removeItem(XG.cfg.SAVE_KEY);
      } catch (e) {
        console.error('[save] 清檔失敗', e);
      }
      XG.state = XG.newState();
      XG.bus.emit('res:changed');
    },

    // 導出存檔為 base64 字符串（UTF-8 安全）
    export() {
      try {
        return encode64(JSON.stringify(XG.state));
      } catch (e) {
        console.error('[save] 導出失敗', e);
        return '';
      }
    },

    // 導入 base64 存檔，返回 {ok, err?}
    import(str) {
      try {
        const obj = JSON.parse(decode64(String(str || '').trim()));
        if (!obj || typeof obj !== 'object' || typeof obj.ver === 'undefined') {
          return { ok: false, err: '存檔格式不正確' };
        }
        XG.state = mergeDeep(XG.newState(), obj);
        if (XG.character) XG.character.normalize();
        this.save();
        XG.bus.emit('res:changed');
        return { ok: true };
      } catch (e) {
        return { ok: false, err: '存檔解析失敗：' + e.message };
      }
    },
  };
})();
