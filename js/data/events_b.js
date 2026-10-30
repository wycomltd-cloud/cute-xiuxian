/* events_b.js：可愛吐槽版奇遇；完整保留原版事件、條件與獎勵。 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.data = XG.data || {};
  (XG.data.events = XG.data.events || []).push(...[
  {
    "id": "evb_qingyun_01",
    "title": "山澗靈泉",
    "icon": "💧",
    "w": 12,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "qingyun",
    "minRealm": 0,
    "text": "雲霧裡冒出清亮靈泉，泉底閃著光。你認真確認了一下：這次不是自己渴到眼花。",
    "choices": [
      {
        "text": "捧起來喝，補充靈氣",
        "out": {
          "cult": 15000,
          "news": "你於青雲山飲得靈泉，修為精進不少。"
        }
      },
      {
        "text": "裝泉水去賣",
        "out": {
          "lingShi": 800
        }
      },
      {
        "text": "灌瓶珍藏，順便收茶材",
        "out": {
          "mat": {
            "sp_qingyun_tea": 2
          }
        }
      }
    ]
  },
  {
    "id": "evb_qingyun_02",
    "title": "崖壁劍痕",
    "icon": "🪨",
    "w": 10,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "qingyun",
    "minRealm": 0,
    "text": "崖壁劍痕一道比一道帥，留下劍意的前輩顯然很會展示。你看完自己的木劍，決定先別比造型。",
    "choices": [
      {
        "text": "面壁參悟，給腦袋磨劍",
        "out": {
          "cult": 36000
        }
      },
      {
        "text": "拓下劍痕，帶回研究",
        "out": {
          "cult": 6000,
          "frag": {
            "gf_wanjian": 1
          }
        }
      },
      {
        "text": "焚香一拜，向前輩致敬",
        "out": {
          "cult": 6000,
          "news": "你遙拜前輩劍痕，心中劍道漸明。"
        }
      }
    ]
  },
  {
    "id": "evb_qingyun_03",
    "title": "樵夫指路",
    "icon": "🪓",
    "w": 10,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "qingyun",
    "minRealm": 0,
    "text": "老樵夫背柴下山，指了條通往仙緣的小路。你看看他的笑容，再看看地圖，果然本地人比紙可靠。",
    "choices": [
      {
        "text": "花200靈石送乾糧致謝",
        "req": {
          "lingShi": 200
        },
        "out": {
          "cult": 36000,
          "news": "一飯之恩，老樵指點你尋得一處靈穴。"
        }
      },
      {
        "text": "道謝後自己探索",
        "out": {
          "cult": 15000
        }
      }
    ]
  },
  {
    "id": "evb_luoxia_01",
    "title": "霞光淬體",
    "icon": "🌅",
    "w": 12,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "luoxia",
    "minRealm": 1,
    "text": "晚霞像一牀暖毯鋪進山谷，靈氣開始自己跑周天。你還沒努力，天地先替你暖身了。",
    "choices": [
      {
        "text": "坐著曬霞，認真充電",
        "out": {
          "cult": 144000,
          "news": "你於落霞谷沐霞修行，霞光淬體，道行精進。"
        }
      },
      {
        "text": "採點霞晶當伴手禮",
        "out": {
          "mat": {
            "sp_luoxia_jing": 2
          }
        }
      },
      {
        "text": "慢慢看晚霞散去",
        "out": {
          "cult": 60000,
          "lingYu": 1
        }
      }
    ]
  },
  {
    "id": "evb_luoxia_02",
    "title": "谷底熊羆",
    "icon": "🐻",
    "w": 10,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "luoxia",
    "minRealm": 1,
    "text": "大熊守著百年黃精，站起來吼得理直氣壯。你突然覺得，山裡的採購流程比坊市複雜。",
    "choices": [
      {
        "text": "正面打贏牠",
        "out": {
          "cult": 144000,
          "mat": {
            "beast_xiongdan": 1
          }
        }
      },
      {
        "text": "調虎離山，這次是調熊",
        "out": {
          "cult": 24000,
          "mat": {
            "herb_huangjing": 2
          }
        }
      },
      {
        "text": "繞路，不和熊談所有權",
        "out": {
          "cult": 12000
        }
      }
    ]
  },
  {
    "id": "evb_luoxia_03",
    "title": "紫晶礦脈",
    "icon": "⛏️",
    "w": 9,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "luoxia",
    "minRealm": 1,
    "text": "斷崖露出紫晶礦脈，霞光一照亮得很有身價。你摩拳擦掌，礦工魂暫時壓過了仙人魂。",
    "choices": [
      {
        "text": "自己挖，汗水全包",
        "out": {
          "mat": {
            "gem_zijing": 2
          }
        }
      },
      {
        "text": "花800僱礦工，合作分帳",
        "req": {
          "lingShi": 800
        },
        "out": {
          "lingShi": 2400,
          "mat": {
            "gem_zijing": 1
          },
          "news": "你僱礦工開採紫晶，分賬之餘還小賺一筆。"
        }
      },
      {
        "text": "記好位置，下次再來",
        "out": {
          "cult": 24000
        }
      }
    ]
  },
  {
    "id": "evb_cangwu_01",
    "title": "荒祠野祭",
    "icon": "⛩️",
    "w": 12,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "cangwu",
    "minRealm": 1,
    "text": "荒草裡藏著小祠堂，神像褪了色，供酒卻還新鮮。看來這裡雖然偏遠，仍有人負責補貨。",
    "choices": [
      {
        "text": "花500靈石修香火",
        "req": {
          "lingShi": 500
        },
        "out": {
          "cult": 60000,
          "news": "你重修荒祠香火，夜有神人入夢致謝。"
        }
      },
      {
        "text": "四處找找遺留物",
        "out": {
          "lingShi": 1500,
          "mat": {
            "beast_gu": 2
          }
        }
      },
      {
        "text": "禮貌繞路，今天不打擾",
        "out": {
          "cult": 12000
        }
      }
    ]
  },
  {
    "id": "evb_cangwu_02",
    "title": "狼羣夜嚎",
    "icon": "🐺",
    "w": 10,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "cangwu",
    "minRealm": 1,
    "text": "蒼梧夜裡亮起一圈綠眼睛，狼羣越走越近。你本來想看星星，現在只想讓牠們保持社交距離。",
    "choices": [
      {
        "text": "拔劍迎戰",
        "out": {
          "cult": 144000,
          "mat": {
            "beast_yaodan": 1
          }
        }
      },
      {
        "text": "點火慢慢撤退",
        "out": {
          "cult": 24000
        }
      }
    ]
  },
  {
    "id": "evb_cangwu_03",
    "title": "瘴谷幽蘭",
    "icon": "🌫️",
    "w": 8,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "cangwu",
    "minRealm": 1,
    "text": "毒瘴裡開著一株幽蘭，香味好聞，周圍空氣卻不太友善。漂亮事物也會有不好走的採訪路線。",
    "choices": [
      {
        "text": "護體強闖，丹毒可能增加",
        "req": {
          "realmIdx": 1
        },
        "out": {
          "cult": 144000,
          "toxicity": 10
        }
      },
      {
        "text": "找空隙採集特產",
        "out": {
          "cult": 24000,
          "mat": {
            "sp_cangwu_wood": 2
          }
        }
      },
      {
        "text": "不進去，鼻子聞到就好",
        "out": {
          "cult": 12000
        }
      }
    ]
  },
  {
    "id": "evb_wanyao_01",
    "title": "魔修截道",
    "icon": "🗡️",
    "w": 12,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "wanyao",
    "minRealm": 2,
    "text": "魔修攔路要買路錢，臺詞古老但氣勢很足。你覺得他應該換個標語，至少別跟山下那位一模一樣。",
    "choices": [
      {
        "text": "付2萬靈石，買路通行",
        "req": {
          "lingShi": 20000
        },
        "out": {
          "cult": 96000,
          "news": "你重金買路，魔修竟對你拱手，自認同道。"
        }
      },
      {
        "text": "拔劍，這條路大家的",
        "out": {
          "cult": 576000,
          "mat": {
            "beast_yaodan": 1
          }
        }
      },
      {
        "text": "掉頭，換條免費路",
        "out": {
          "cult": 48000
        }
      }
    ]
  },
  {
    "id": "evb_wanyao_02",
    "title": "白骨祭壇",
    "icon": "💀",
    "w": 9,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "wanyao",
    "minRealm": 2,
    "text": "白骨祭壇中央供著一顆黑魔珠，看起來很會惹麻煩。你的小本本上立刻多了「別亂摸」三個字。",
    "choices": [
      {
        "text": "打碎魔珠，可能受毒氣影響",
        "out": {
          "cult": 576000,
          "toxicity": 15,
          "news": "你毀去妖嶺祭壇，方圓百里陰氣為之一清。"
        }
      },
      {
        "text": "取走魔珠，毒性更重",
        "req": {
          "realmIdx": 3
        },
        "out": {
          "cult": 240000,
          "toxicity": 20,
          "mat": {
            "sp_yaoling_guo": 1
          }
        }
      },
      {
        "text": "悄悄退場，不碰奇怪擺飾",
        "out": {
          "cult": 48000
        }
      }
    ]
  },
  {
    "id": "evb_wanyao_03",
    "title": "嶺底魔泉",
    "icon": "🌑",
    "w": 8,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "wanyao",
    "minRealm": 2,
    "text": "黑泉咕嚕冒泡，靈氣濃得像特調。成分表沒有寫，但你的經脈已經先亮黃燈了。",
    "choices": [
      {
        "text": "硬喝黑泉，丹毒增加",
        "out": {
          "cult": 1150000,
          "toxicity": 25
        }
      },
      {
        "text": "取水封存，先別入口",
        "out": {
          "mat": {
            "sp_yaoling_guo": 2
          }
        }
      },
      {
        "text": "用符封泉，保護過路人",
        "out": {
          "cult": 240000,
          "news": "你封住魔泉，路過散修紛紛稱頌。"
        }
      }
    ]
  },
  {
    "id": "evb_beihai_01",
    "title": "冰下故人",
    "icon": "🧊",
    "w": 10,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "beihai",
    "minRealm": 3,
    "text": "玄冰裡封著古修，手裡玉簡還泛著暖光。你站在旁邊，忽然不太敢說自己覺得冷。",
    "choices": [
      {
        "text": "破冰取玉簡",
        "req": {
          "realmIdx": 3
        },
        "out": {
          "cult": 1050000,
          "frag": {
            "gf_xuanbing": 1
          }
        }
      },
      {
        "text": "向前輩恭敬一拜",
        "out": {
          "cult": 2520000,
          "news": "你向冰中古修一拜，冥冥中似有劍意入體。"
        }
      },
      {
        "text": "不打擾前輩長眠",
        "out": {
          "cult": 210000
        }
      }
    ]
  },
  {
    "id": "evb_beihai_02",
    "title": "雪魄蓮開",
    "icon": "❄️",
    "w": 9,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "beihai",
    "minRealm": 3,
    "text": "風雪停下，雪蓮在微光裡慢慢開花。你吸吸鼻子，決定今天的鼻紅也算可愛的一部分。",
    "choices": [
      {
        "text": "小心採蓮",
        "out": {
          "cult": 420000,
          "mat": {
            "sp_beihai_sui": 2
          }
        }
      },
      {
        "text": "守著花悟道，順便搓手",
        "out": {
          "cult": 2520000
        }
      }
    ]
  },
  {
    "id": "evb_beihai_03",
    "title": "寒淵裂隙",
    "icon": "🌨️",
    "w": 8,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "beihai",
    "minRealm": 3,
    "text": "冰原裂開一道深淵，底下藍光忽明忽暗。你探頭看了一眼，膝蓋表示它有自己的意見。",
    "choices": [
      {
        "text": "綁好繩索往下探",
        "req": {
          "realmIdx": 4
        },
        "out": {
          "cult": 1050000,
          "mat": {
            "ore_hantie": 2
          }
        }
      },
      {
        "text": "先丟石頭問候",
        "out": {
          "cult": 420000
        }
      },
      {
        "text": "繞著走，腿軟也能前進",
        "out": {
          "cult": 210000
        }
      }
    ]
  },
  {
    "id": "evb_fentian_01",
    "title": "地火噴湧",
    "icon": "🔥",
    "w": 11,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "fentian",
    "minRealm": 4,
    "text": "地火突然噴上天，碎石變成赤晶。你後退半步，這座山谷的歡迎煙火有點太熱情。",
    "choices": [
      {
        "text": "冒險撿赤晶",
        "out": {
          "cult": 1800000,
          "mat": {
            "ore_chijing": 2
          }
        }
      },
      {
        "text": "借地火煉體",
        "out": {
          "cult": 10800000
        }
      },
      {
        "text": "遠遠觀察，眉毛要保住",
        "out": {
          "cult": 900000
        }
      }
    ]
  },
  {
    "id": "evb_fentian_02",
    "title": "火鴉巢穴",
    "icon": "🦅",
    "w": 9,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "fentian",
    "minRealm": 4,
    "text": "火鴉巢裡的小鳥睡得香，羽毛還帶小火苗。這間育兒房連暖氣都不用裝。",
    "choices": [
      {
        "text": "取一枚火羽",
        "out": {
          "cult": 1800000,
          "mat": {
            "sp_fentian_huo": 2
          }
        }
      },
      {
        "text": "取卵，準備被火鴉追",
        "out": {
          "cult": 900000,
          "egg": 1,
          "news": "你自火鴉巢中竊得一卵，鴉羣追襲三百里。"
        }
      },
      {
        "text": "輕聲離開，別吵醒寶寶",
        "out": {
          "cult": 900000
        }
      }
    ]
  },
  {
    "id": "evb_fentian_03",
    "title": "熔岩鍛骨",
    "icon": "♨️",
    "w": 8,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "fentian",
    "minRealm": 4,
    "text": "熔岩湖旁赤石燙得發亮，裡頭藏著火行精粹。修行和烤腳之間，好像只差一點勇氣。",
    "choices": [
      {
        "text": "赤腳煉骨，身體可能受損",
        "req": {
          "realmIdx": 4
        },
        "out": {
          "cult": 21600000,
          "toxicity": 10
        }
      },
      {
        "text": "撿火精石，腳先別碰",
        "out": {
          "mat": {
            "ore_chijing": 1,
            "sp_fentian_huo": 1
          }
        }
      },
      {
        "text": "湖邊調息，保持距離",
        "out": {
          "cult": 1800000
        }
      }
    ]
  },
  {
    "id": "evb_youming_01",
    "title": "鬼火引路",
    "icon": "👻",
    "w": 11,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "youming",
    "minRealm": 5,
    "text": "幾點綠色鬼火繞著你轉，再往迷霧裡飄。你決定先把「免費導覽」和「可疑導航」都列入可能。",
    "choices": [
      {
        "text": "跟著鬼火走",
        "out": {
          "cult": 46800000
        }
      },
      {
        "text": "揮劍驅散鬼火",
        "out": {
          "cult": 19500000
        }
      },
      {
        "text": "原地等，看看牠們急不急",
        "out": {
          "cult": 3900000
        }
      }
    ]
  },
  {
    "id": "evb_youming_02",
    "title": "沉船遺寶",
    "icon": "⚓",
    "w": 9,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "youming",
    "minRealm": 5,
    "text": "淺灘底下一艘沉船，箱子竟然還完整。海水收了多年保管費，今天終於有人來開箱了。",
    "choices": [
      {
        "text": "開箱看看寶物",
        "out": {
          "lingShi": 1000000,
          "mat": {
            "gem_mingzhu": 1
          }
        }
      },
      {
        "text": "只取金銀，簡單明確",
        "out": {
          "lingShi": 1500000
        }
      },
      {
        "text": "焚香祭奠，先向前人致意",
        "out": {
          "cult": 19500000,
          "news": "你祭奠沉船亡魂，夜半聞澗中有人道謝。"
        }
      }
    ]
  },
  {
    "id": "evb_youming_03",
    "title": "鮫人泣珠",
    "icon": "🧜",
    "w": 7,
    "once": true,
    "hidden": false,
    "trigger": "explore",
    "mapId": "youming",
    "minRealm": 5,
    "text": "鮫人坐在礁石上哭，眼淚落下就成了珍珠。你心疼她，也很努力不去心算珍珠的價格。",
    "choices": [
      {
        "text": "上前安慰，先聽她說",
        "out": {
          "cult": 7800000,
          "chain": "evb_youming_04"
        }
      },
      {
        "text": "奪珠離開，會引起風浪",
        "out": {
          "cult": 3900000,
          "mat": {
            "gem_mingzhu": 2
          },
          "news": "你奪鮫人珠，澗中三日風浪不止。"
        }
      }
    ]
  },
  {
    "id": "evb_youming_04",
    "title": "鮫綃之贈",
    "icon": "🌊",
    "w": 0,
    "once": true,
    "hidden": false,
    "trigger": "explore",
    "mapId": "youming",
    "minRealm": 5,
    "text": "鮫人破涕為笑，送你不怕水的鮫綃。她說善心值得回禮，你想著：今天帶回家的不只防水布。",
    "choices": [
      {
        "text": "認真道謝，把禮物收好",
        "out": {
          "cult": 19500000,
          "lingYu": 5,
          "mat": {
            "sp_youming_hua": 2
          }
        }
      }
    ]
  },
  {
    "id": "evb_longyuan_01",
    "title": "淵底龍吟",
    "icon": "🐉",
    "w": 10,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "longyuan",
    "minRealm": 6,
    "text": "深淵裡傳來長長龍吟，水面泛起金圈。你懷疑下方住戶正在練嗓，還是先安靜一點。",
    "choices": [
      {
        "text": "在岸邊吐納",
        "out": {
          "cult": 216000000
        }
      },
      {
        "text": "獻200萬靈石祭淵",
        "req": {
          "lingShi": 2000000
        },
        "out": {
          "cult": 90000000,
          "mat": {
            "sp_longyuan_lin": 2
          }
        }
      },
      {
        "text": "不久留，讓龍繼續練",
        "out": {
          "cult": 18000000
        }
      }
    ]
  },
  {
    "id": "evb_longyuan_02",
    "title": "龍宮殘殿",
    "icon": "🏯",
    "w": 8,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "longyuan",
    "minRealm": 6,
    "text": "水晶龍宮殘殿沉在深處，半毀仍然豪華。你看著柱子，再想起自己的洞府，裝潢夢又長大了。",
    "choices": [
      {
        "text": "進殿尋寶",
        "out": {
          "lingShi": 7000000,
          "mat": {
            "beast_longlin": 1
          }
        }
      },
      {
        "text": "向殿中前人一拜",
        "out": {
          "cult": 90000000,
          "news": "你拜謁龍宮殘殿，淵底龍吟似柔和了幾分。"
        }
      }
    ]
  },
  {
    "id": "evb_longyuan_03",
    "title": "逆鱗之觸",
    "icon": "🐲",
    "w": 6,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "longyuan",
    "minRealm": 6,
    "text": "巨大逆鱗插在礁石裡，碰一下手就麻。這件寶物的防盜系統，實在是樸實又有效。",
    "choices": [
      {
        "text": "全力拔出逆鱗",
        "req": {
          "realmIdx": 7
        },
        "out": {
          "cult": 216000000,
          "mat": {
            "beast_longlin": 2
          }
        }
      },
      {
        "text": "拓下鱗紋，學習也很好",
        "out": {
          "cult": 36000000,
          "frag": {
            "gf_longxiang": 1
          }
        }
      },
      {
        "text": "不碰了，手指有用",
        "out": {
          "cult": 18000000
        }
      }
    ]
  },
  {
    "id": "evb_guixu_01",
    "title": "墟海歸流",
    "icon": "🌊",
    "w": 10,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "guixu",
    "minRealm": 7,
    "text": "萬水匯入海眼，連星光也一起捲進去。天地這臺大攪拌機，攪的居然是大道。",
    "choices": [
      {
        "text": "臨流悟道",
        "out": {
          "cult": 900000000
        }
      },
      {
        "text": "取一瓢水，順帶收殘璧",
        "out": {
          "cult": 150000000,
          "mat": {
            "sp_guixu_bi": 2
          }
        }
      }
    ]
  },
  {
    "id": "evb_guixu_02",
    "title": "上古艦骸",
    "icon": "⛵",
    "w": 8,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "guixu",
    "minRealm": 7,
    "text": "上古巨艦擱在海眼旁，材料看不懂，符文更看不懂。你唯一確定的是：這船的保養費不會低。",
    "choices": [
      {
        "text": "登艦探索",
        "req": {
          "realmIdx": 8
        },
        "out": {
          "cult": 375000000,
          "mat": {
            "gem_xinghui": 1
          }
        }
      },
      {
        "text": "抄符文，回去做功課",
        "out": {
          "cult": 150000000,
          "frag": {
            "gf_cangling": 1
          }
        }
      },
      {
        "text": "保持距離，先不登船",
        "out": {
          "cult": 75000000
        }
      }
    ]
  },
  {
    "id": "evb_guixu_03",
    "title": "無底之谷",
    "icon": "🕳️",
    "w": 6,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "mapId": "guixu",
    "minRealm": 7,
    "text": "海底深谷看不到底，藍光慢慢浮上來。你覺得這景色很美，也很希望自己的膽子能再長大一號。",
    "choices": [
      {
        "text": "縱身下潛，考驗神識",
        "req": {
          "realmIdx": 8
        },
        "out": {
          "cult": 1800000000,
          "news": "你下潛歸墟深谷萬丈，神識幾近枯竭，歸來時已非吳下阿蒙。"
        }
      },
      {
        "text": "投石測深，等迴音",
        "out": {
          "cult": 150000000,
          "news": "你投石入歸墟深谷，三年之後仍無聞其底。"
        }
      },
      {
        "text": "岸邊觀悟，不急著跳",
        "out": {
          "cult": 75000000
        }
      }
    ]
  },
  {
    "id": "evb_xuanyuan_1",
    "title": "劍冢現世",
    "icon": "⚔️",
    "w": 2,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "minRealm": 4,
    "text": "萬裏劍鳴把夜色叫醒，軒轅劍冢破土而出。你跟著劍氣走來，感覺收到一場規格很高的面試通知。",
    "choices": [
      {
        "text": "整好衣服進劍冢",
        "out": {
          "chain": "evb_xuanyuan_2"
        }
      },
      {
        "text": "先不進去，面試太突然",
        "out": {
          "cult": 4500000,
          "news": "你夜遇劍冢而不入，同道皆嘆你失之交臂。"
        }
      }
    ]
  },
  {
    "id": "evb_xuanyuan_2",
    "title": "萬劍朝宗",
    "icon": "🗡️",
    "w": 0,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "minRealm": 4,
    "text": "萬柄劍懸在半空，劍尖整整齊齊朝向你。這場考覈沒有主考官，因為每一把都很像。",
    "choices": [
      {
        "text": "用劍心回應考驗",
        "req": {
          "realmIdx": 4
        },
        "out": {
          "chain": "evb_xuanyuan_3"
        }
      },
      {
        "text": "硬取古劍，可能被震退",
        "out": {
          "cult": 1800000,
          "news": "你強取冢中古劍，萬劍齊鳴，你被劍氣震退百里。"
        }
      },
      {
        "text": "鞠躬退出，下次準備好再來",
        "out": {
          "cult": 4500000
        }
      }
    ]
  },
  {
    "id": "evb_xuanyuan_3",
    "title": "軒轅一劍",
    "icon": "👑",
    "w": 0,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "minRealm": 4,
    "text": "萬劍分開，古樸長劍浮現，兩面刻滿日月山川。你屏住呼吸，這份氣場連你的呆毛都站直了。",
    "choices": [
      {
        "text": "執劍受傳承",
        "out": {
          "cult": 21600000,
          "lingYu": 60,
          "frag": {
            "gf_xuanyuan": 2
          },
          "hiddenEnd": "你執軒轅劍而立，萬劍齊俯首。此劍不屬塵世，只留下一縷劍意與劍訣殘篇，伴你踏上登仙之途。"
        }
      },
      {
        "text": "拜別神劍，記住這一刻",
        "out": {
          "cult": 10800000,
          "lingYu": 20,
          "news": "你拜別軒轅劍冢，劍氣入體，修為大漲。"
        }
      }
    ]
  },
  {
    "id": "evb_longyuan_1",
    "title": "龍吟於淵",
    "icon": "🐉",
    "w": 2,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "minRealm": 5,
    "text": "龍吟從地下深處傳來，霧氣裡有龐大影子慢慢遊動。你把小包背好，準備拜訪一位很大的鄰居。",
    "choices": [
      {
        "text": "沿深淵往下走",
        "out": {
          "chain": "evb_longyuan_2"
        }
      },
      {
        "text": "岸邊觀望，先打個招呼",
        "out": {
          "cult": 19500000
        }
      }
    ]
  },
  {
    "id": "evb_longyuan_2",
    "title": "驪珠之託",
    "icon": "🔮",
    "w": 0,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "minRealm": 5,
    "text": "蒼老應龍想把驪珠託付給有緣人。牠低下頭，你才發現自己整個人還沒珠子氣勢大。",
    "choices": [
      {
        "text": "恭敬接下驪珠",
        "out": {
          "chain": "evb_longyuan_3"
        }
      },
      {
        "text": "婉辭贈珠，心意領受",
        "out": {
          "cult": 46800000,
          "news": "你謝絕應龍贈珠，龍目之中流露讚許之色。"
        }
      }
    ]
  },
  {
    "id": "evb_longyuan_3",
    "title": "龍血淬體",
    "icon": "🩸",
    "w": 0,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "minRealm": 5,
    "text": "應龍引你進龍穴，以龍血替你淬體。經脈像重新開河，頭上金光亮到不用再帶燈。",
    "choices": [
      {
        "text": "接受淬體，認真謝恩",
        "out": {
          "cult": 93600000,
          "lingYu": 40,
          "egg": 1,
          "hiddenEnd": "龍血淬體之後，你舉手投足皆有龍威。應龍含笑而逝，只留下一枚龍蛋，待你有緣孵化。"
        }
      },
      {
        "text": "功成拜別，帶著龍氣回家",
        "out": {
          "cult": 46800000,
          "mat": {
            "beast_longlin": 1
          },
          "news": "你自龍淵歸來，周身隱有龍氣繚繞。"
        }
      }
    ]
  },
  {
    "id": "evb_gui_xu_1",
    "title": "海眼吞星",
    "icon": "🌌",
    "w": 2,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "minRealm": 7,
    "text": "夜海上星光傾瀉，萬流匯向歸墟。你的小船晃了一下，出發前沒想到會遇到宇宙級景點。",
    "choices": [
      {
        "text": "駕舟進海眼",
        "out": {
          "chain": "evb_gui_xu_2"
        }
      },
      {
        "text": "先在遠處感嘆一下",
        "out": {
          "cult": 375000000
        }
      }
    ]
  },
  {
    "id": "evb_gui_xu_2",
    "title": "墟中老人",
    "icon": "🧓",
    "w": 0,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "minRealm": 7,
    "text": "歸墟深處，老人坐著釣魚，笑問你從哪裡來。你看看腳下無光深淵，決定先不問這裡有沒有魚。",
    "choices": [
      {
        "text": "坐下陪老人論道",
        "out": {
          "chain": "evb_gui_xu_3"
        }
      },
      {
        "text": "問問前輩的來歷",
        "out": {
          "cult": 900000000,
          "news": "老人笑而不答，只道：墟中人，墟外事，一問便錯。"
        }
      },
      {
        "text": "不打擾釣客，安靜離開",
        "out": {
          "cult": 375000000
        }
      }
    ]
  },
  {
    "id": "evb_gui_xu_3",
    "title": "歸墟之眼",
    "icon": "👁️",
    "w": 0,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "minRealm": 7,
    "text": "老人指著海眼說萬水歸此、萬法亦然。你忽然懂了，原來大道不是越裝越滿，而是終於看見同一條線。",
    "choices": [
      {
        "text": "頓悟後向前輩一拜",
        "out": {
          "cult": 1800000000,
          "lingYu": 80,
          "frag": {
            "gf_guixu": 2
          },
          "hiddenEnd": "你在歸墟之眼了悟萬法歸一。再回首時，老人與釣石俱已不見，唯有一部殘訣靜靜躺在掌心。"
        }
      },
      {
        "text": "默默記住這份領悟",
        "out": {
          "cult": 900000000,
          "lingYu": 30
        }
      }
    ]
  },
  {
    "id": "evb_saodiweng_1",
    "title": "掃地老翁",
    "icon": "🧹",
    "w": 2,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "minRealm": 1,
    "text": "掃地老翁笑問：「地掃好了，你的心呢？」你低頭看看乾淨石階，突然覺得自己的心裡可能還堆著落葉。",
    "choices": [
      {
        "text": "上前聊聊，請教心事",
        "out": {
          "cult": 60000,
          "lingYu": 5,
          "news": "老翁與你談玄半日，臨別只說了一句：好好修行。"
        }
      },
      {
        "text": "花5000靈石表心意",
        "req": {
          "lingShi": 5000
        },
        "out": {
          "cult": 144000,
          "news": "老翁堅辭不受，反贈你一句口訣，細品之下竟是上古道音。"
        }
      },
      {
        "text": "安靜離開，回去整理自己",
        "out": {
          "cult": 12000,
          "news": "你走出很遠再回首，山門前空無一人，落葉堆積如初。"
        }
      }
    ]
  },
  {
    "id": "evb_swordtalk_1",
    "title": "劍語錚錚",
    "icon": "⚔️",
    "w": 2,
    "once": true,
    "hidden": true,
    "trigger": "explore",
    "minRealm": 2,
    "text": "鏽劍忽然開口：「三百年了，總算來個會喘氣的。」你嚇了一跳，牠卻比你更高興，顯然憋了很久。",
    "choices": [
      {
        "text": "陪牠論劍，耳朵準備好",
        "out": {
          "cult": 240000,
          "news": "鏽劍與你論劍一夜，臨別嘟囔：這小子，比上一任主人順眼。"
        }
      },
      {
        "text": "問問鏽劍的過去",
        "out": {
          "cult": 96000,
          "frag": {
            "gf_wanjian": 1
          },
          "news": "鏽劍自述乃古劍派鎮派之劍，劍派已亡，唯它不肯鏽蝕劍心。"
        }
      },
      {
        "text": "拔劍帶走，接受全程碎念",
        "req": {
          "realmIdx": 4
        },
        "out": {
          "cult": 240000,
          "lingYu": 15,
          "news": "鏽劍跟你走了，一路嘮叨個沒完。"
        }
      }
    ]
  },
  {
    "id": "evb_lanke_1",
    "title": "爛柯棋局",
    "icon": "♟️",
    "w": 2,
    "once": true,
    "hidden": true,
    "trigger": "explore",
    "minRealm": 3,
    "text": "兩位老先生下棋，棋盤像把星空縮小。你本想只看一下，卻忘了修仙界的「一下」常常很有彈性。",
    "choices": [
      {
        "text": "看到終局，留意時間飛走",
        "out": {
          "cult": 2520000,
          "news": "你看完一局棋，回山方知已過三日，斧柯盡爛。"
        }
      },
      {
        "text": "請教一招，學完就走",
        "out": {
          "cult": 1050000,
          "lingYu": 5
        }
      },
      {
        "text": "不打擾，觀眾席先空著",
        "out": {
          "cult": 210000
        }
      }
    ]
  },
  {
    "id": "evb_gudong_1",
    "title": "古洞遺府",
    "icon": "⛰️",
    "w": 9,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "minRealm": 1,
    "text": "藤蔓後有座古洞，石門半掩。你撥開葉子，像拆開一份包裝用了幾百年的神祕禮物。",
    "choices": [
      {
        "text": "推門探索",
        "out": {
          "cult": 60000,
          "mat": {
            "ore_xuantie": 1
          }
        }
      },
      {
        "text": "先查虛實，謹慎拆封",
        "out": {
          "cult": 24000,
          "lingShi": 3000
        }
      }
    ]
  },
  {
    "id": "evb_canye_1",
    "title": "天降殘頁",
    "icon": "📜",
    "w": 8,
    "once": false,
    "hidden": false,
    "trigger": "any",
    "minRealm": 1,
    "text": "一陣怪風吹來半頁古紙，剛好落在膝上。這次天地快遞沒有簽收單，但內容看起來很值錢。",
    "choices": [
      {
        "text": "小心收好，別拿來擦桌",
        "out": {
          "cult": 12000,
          "frag": {
            "gf_qingxin": 1
          }
        }
      },
      {
        "text": "就地參悟，趁字還看得懂",
        "out": {
          "cult": 60000
        }
      }
    ]
  },
  {
    "id": "evb_lingyao_1",
    "title": "靈藥逢春",
    "icon": "🌿",
    "w": 9,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "minRealm": 0,
    "text": "靈草在石縫裡晃著小葉子，露珠亮得很精神。你蹲下來欣賞，忍不住覺得牠比自己還會早起。",
    "choices": [
      {
        "text": "採一株帶走",
        "out": {
          "cult": 6000,
          "mat": {
            "herb_lingzhi": 1
          }
        }
      },
      {
        "text": "連土移栽，整盆搬家",
        "out": {
          "mat": {
            "herb_lingzhi": 2
          }
        }
      }
    ]
  },
  {
    "id": "evb_kuangmai_1",
    "title": "礦脈露頭",
    "icon": "⛏️",
    "w": 9,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "minRealm": 1,
    "text": "山角崩開，露出烏亮礦脈。你敲了敲，清脆的聲音聽起來像儲物袋在說歡迎光臨。",
    "choices": [
      {
        "text": "就地開採，袖子捲起來",
        "out": {
          "mat": {
            "ore_xuantie": 2
          }
        }
      },
      {
        "text": "記錄位置，出售礦脈情報",
        "out": {
          "cult": 24000,
          "lingShi": 2000
        }
      }
    ]
  },
  {
    "id": "evb_yishou_1",
    "title": "異獸攔路",
    "icon": "🐅",
    "w": 9,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "minRealm": 2,
    "text": "異獸蹲在路中，眼睛像兩顆小銅鈴。你看牠，牠看你，誰也不肯先承認是在擋路。",
    "choices": [
      {
        "text": "打贏牠，爭取通行",
        "out": {
          "cult": 240000,
          "mat": {
            "beast_yaodan": 1
          }
        }
      },
      {
        "text": "花1萬靈石投食引開",
        "req": {
          "lingShi": 10000
        },
        "out": {
          "cult": 96000
        }
      },
      {
        "text": "繞道，把路留給牠",
        "out": {
          "cult": 48000
        }
      }
    ]
  },
  {
    "id": "evb_xinggong_1",
    "title": "星宮垂影",
    "icon": "✨",
    "w": 5,
    "once": false,
    "hidden": false,
    "trigger": "cultivate",
    "minRealm": 3,
    "cond": "night",
    "text": "子夜星光穿窗，剛好落在眉心。你本來想睡了，沒想到天空還替你安排了一堂夜間進修。",
    "choices": [
      {
        "text": "接引星輝，今晚加課",
        "out": {
          "cult": 2520000,
          "news": "你夜引星輝淬神，神識為之一清。"
        }
      },
      {
        "text": "安穩吸納，慢慢變亮",
        "out": {
          "cult": 1050000
        }
      }
    ]
  },
  {
    "id": "evb_dandu_1",
    "title": "丹毒攻心",
    "icon": "☠️",
    "w": 6,
    "once": false,
    "hidden": false,
    "trigger": "cultivate",
    "minRealm": 1,
    "cond": "tox50",
    "text": "前幾天喫的丹藥，今天用丹毒的形式回訪。經脈裡黑氣亂跑，你決定下次至少先看清服用時機。",
    "choices": [
      {
        "text": "強壓丹毒，毒性會加重",
        "out": {
          "cult": 60000,
          "toxicity": 10
        }
      },
      {
        "text": "閉關排毒，讓身體休整",
        "out": {
          "cult": 12000,
          "toxicity": -30,
          "news": "你閉關三日，排出丹毒，只覺周身一輕。"
        }
      }
    ]
  },
  {
    "id": "evb_haishi_1",
    "title": "海市一瞥",
    "icon": "🏮",
    "w": 4,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "minRealm": 2,
    "cond": "rich",
    "text": "海天間升起華麗市集，寶物多得眼睛不夠用。它隨時會消失，錢包卻很希望你別那麼有行動力。",
    "choices": [
      {
        "text": "花50萬進去淘寶",
        "req": {
          "lingShi": 500000
        },
        "out": {
          "egg": 1,
          "mat": {
            "gem_mingzhu": 1
          }
        }
      },
      {
        "text": "只看不買，定力展示",
        "out": {
          "cult": 96000,
          "news": "你在海市門前站了半晌，囊中雖豐，終究不捨。"
        }
      }
    ]
  },
  {
    "id": "evb_gujiu_1",
    "title": "故舊相贈",
    "icon": "🎁",
    "w": 6,
    "once": false,
    "hidden": false,
    "trigger": "any",
    "minRealm": 0,
    "cond": "poor",
    "text": "老朋友見你錢袋空，硬塞一包靈石，說還記得你當年請的那杯酒。有些帳，朋友記的都是好。",
    "choices": [
      {
        "text": "感激收下，改天換我請",
        "out": {
          "lingShi": 2000,
          "news": "落魄之時見故人，你暗誓他日必報。"
        }
      },
      {
        "text": "婉言謝絕，這回自己扛",
        "out": {
          "cult": 6000,
          "news": "你謝絕故舊之贈，對方大笑而去，逢人便誇你骨氣。"
        }
      }
    ]
  }
]);
})();
