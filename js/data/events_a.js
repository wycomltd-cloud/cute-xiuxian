/* events_a.js：可愛吐槽版奇遇；完整保留原版事件、條件與獎勵。 */
(function () {
  'use strict';
  const XG = (window.XG = window.XG || {});
  XG.data = XG.data || {};
  (XG.data.events = XG.data.events || []).push(...[
  {
    "id": "eva_lingquan",
    "title": "靈泉乍現",
    "icon": "泉",
    "w": 12,
    "once": false,
    "hidden": false,
    "trigger": "cultivate",
    "minRealm": 0,
    "text": "石縫突然冒出靈泉，還自帶咕嚕音效。你的經脈精神了，水壺也精神了。",
    "choices": [
      {
        "text": "乖乖吸收，免費真香",
        "out": {
          "cult": 18000,
          "news": "山中靈泉乍現，有緣者飲之，修為見長。"
        }
      },
      {
        "text": "強行衝關，經脈可能抗議",
        "out": {
          "cult": 36000,
          "toxicity": 5,
          "news": "有人強引靈泉衝脈，進境雖快，也傷了經絡。"
        }
      },
      {
        "text": "分給藥圃，靈芝也要喝水",
        "out": {
          "cult": 6000,
          "mat": {
            "herb_lingzhi": 2
          },
          "news": "靈泉灌圃，幾株靈芝一夜瘋長。"
        }
      }
    ]
  },
  {
    "id": "eva_xingdou",
    "title": "夜觀星斗",
    "icon": "星",
    "w": 2,
    "once": true,
    "hidden": true,
    "trigger": "cultivate",
    "minRealm": 0,
    "cond": "night",
    "text": "半夜抬頭，一顆星星亮得像忘記關燈。天上傳來一段玄妙口訣，這次熬夜竟然有收穫。",
    "choices": [
      {
        "text": "接收天機，先不睡了",
        "out": {
          "cult": 72000,
          "lingYu": 1,
          "news": "有散修夜觀星斗，忽悟天機，道行大進。"
        }
      },
      {
        "text": "抄下星圖，拒絕明早失憶",
        "out": {
          "cult": 18000,
          "frag": {
            "gf_zixiao": 2
          },
          "news": "一幅星圖摹到五更，紙上隱有光華流轉。"
        }
      }
    ]
  },
  {
    "id": "eva_lingchao",
    "title": "靈氣潮汐",
    "icon": "潮",
    "w": 10,
    "once": false,
    "hidden": false,
    "trigger": "cultivate",
    "minRealm": 0,
    "text": "靈氣一波波湧來，你的袖子鼓成小包子。天地開放限時喫到飽，問題是經脈能裝多少。",
    "choices": [
      {
        "text": "順著潮汐大口吐納",
        "out": {
          "cult": 36000,
          "news": "靈氣潮汐之夜，趁勢者皆有寸進。"
        }
      },
      {
        "text": "穩住玄關，順便排排毒",
        "out": {
          "cult": 18000,
          "toxicity": -5,
          "news": "潮起潮落，自守玄關者巋然不動。"
        }
      },
      {
        "text": "逆流猛吸，根基壓力山大",
        "out": {
          "cult": 72000,
          "toxicity": 10,
          "news": "有人趁潮汐強行採補，進境雖猛，卻損了根基。"
        }
      }
    ]
  },
  {
    "id": "eva_lingdie",
    "title": "靈蝶引路",
    "icon": "蝶",
    "w": 8,
    "once": false,
    "hidden": false,
    "trigger": "cultivate",
    "minRealm": 1,
    "text": "一隻玉色靈蝶繞你三圈，往山谷飛去。它導航沒有聲音，全靠你看懂牠的小眼神。",
    "choices": [
      {
        "text": "跟上小導遊",
        "out": {
          "cult": 72000,
          "mat": {
            "herb_xuelian": 1
          },
          "news": "靈蝶引路，有人於幽谷中採得雪蓮。"
        }
      },
      {
        "text": "不追了，蒲團比較黏人",
        "out": {
          "cult": 24000,
          "news": "蝶自翩躚，人自打坐，兩不相擾。"
        }
      }
    ]
  },
  {
    "id": "eva_sanri",
    "title": "入定三日",
    "icon": "定",
    "w": 8,
    "once": false,
    "hidden": false,
    "trigger": "cultivate",
    "minRealm": 1,
    "text": "這次入定一睜眼，三天過去了。修為進步不少，只有肚子對你的作息提出嚴正抗議。",
    "choices": [
      {
        "text": "趁熱再跑幾輪周天",
        "out": {
          "cult": 288000,
          "news": "有修士入定三日，醒來修為大漲。"
        }
      },
      {
        "text": "慢慢收功，照顧一下經脈",
        "out": {
          "cult": 144000,
          "toxicity": -3,
          "news": "三日入定，收功時渾身骨節輕響。"
        }
      }
    ]
  },
  {
    "id": "eva_leiwu",
    "title": "驚雷悟道",
    "icon": "雷",
    "w": 6,
    "once": false,
    "hidden": false,
    "trigger": "cultivate",
    "minRealm": 2,
    "text": "雷聲轟隆，你差點連蒲團一起跳起來。電光一閃，居然看懂了一絲雷霆真意。",
    "choices": [
      {
        "text": "嚇都嚇了，順便悟道",
        "out": {
          "cult": 576000,
          "news": "驚雷之夜，有人悟得雷意，氣勢陡增。"
        }
      },
      {
        "text": "先避雷，再談大道",
        "out": {
          "cult": 96000,
          "news": "雷聲滾滾，你自巋然調息，不為外物所動。"
        }
      }
    ]
  },
  {
    "id": "eva_ziqi",
    "title": "紫氣東來",
    "icon": "紫",
    "w": 4,
    "once": false,
    "hidden": false,
    "trigger": "cultivate",
    "minRealm": 5,
    "text": "東方紫氣鋪滿天空，像仙界打翻了葡萄汁。你剛好站在最佳接收位置，連頭髮都飄起來了。",
    "choices": [
      {
        "text": "接住紫氣，全身充電",
        "out": {
          "cult": 93600000,
          "lingYu": 2,
          "news": "紫氣東來三萬裏，有緣者灌頂受之，道行精進。"
        }
      },
      {
        "text": "分給道友，大家一起發光",
        "out": {
          "cult": 46800000,
          "news": "有人將紫氣分潤同道，傳為美談。"
        }
      }
    ]
  },
  {
    "id": "eva_caoyao",
    "title": "山徑採藥",
    "icon": "藥",
    "w": 12,
    "once": false,
    "hidden": false,
    "trigger": "any",
    "minRealm": 0,
    "text": "路旁靈芝亮晶晶，長得很有上進心。你蹲下來看，牠們安靜得像在假裝普通香菇。",
    "choices": [
      {
        "text": "輕輕採，留點根",
        "out": {
          "cult": 6000,
          "mat": {
            "herb_lingzhi": 2
          },
          "news": "山徑靈芝生得好，採藥人滿載而歸。"
        }
      },
      {
        "text": "整窩挖走，山靈會記帳",
        "out": {
          "mat": {
            "herb_lingzhi": 3
          },
          "news": "有人掘盡一處靈芝，山靈頗有微詞。"
        }
      },
      {
        "text": "讓牠們繼續長個子",
        "out": {
          "cult": 12000,
          "news": "留得青山在，採藥人拱手而去。"
        }
      }
    ]
  },
  {
    "id": "eva_zhuozu",
    "title": "溪邊濯足",
    "icon": "溪",
    "w": 12,
    "once": false,
    "hidden": false,
    "trigger": "any",
    "minRealm": 0,
    "text": "走累了，在清溪裡泡泡腳。山風很溫柔，小魚則集體決定搬到下游。",
    "choices": [
      {
        "text": "泡腳小憩，煩惱放假",
        "out": {
          "cult": 12000,
          "toxicity": -3,
          "news": "一溪清水，洗去半日風塵。"
        }
      },
      {
        "text": "捧水洗眼，重新開機",
        "out": {
          "cult": 6000,
          "news": "有人以靈溪水洗目，夜裏視物如晝。"
        }
      }
    ]
  },
  {
    "id": "eva_yedu",
    "title": "夜雨讀書",
    "icon": "書",
    "w": 10,
    "once": false,
    "hidden": false,
    "trigger": "any",
    "minRealm": 0,
    "text": "雨夜翻舊書，殘頁裡藏著一句口訣。原來這本書最有用的部分，差點被你拿去墊桌腳。",
    "choices": [
      {
        "text": "琢磨一下，腦袋加班",
        "out": {
          "cult": 18000,
          "news": "雨夜讀書，殘句中亦有三寸靈光。"
        }
      },
      {
        "text": "抄好收起，這頁不是廢紙",
        "out": {
          "frag": {
            "gf_qingxin": 2
          },
          "news": "殘卷謄罷，墨跡未乾，窗外雨聲漸歇。"
        }
      }
    ]
  },
  {
    "id": "eva_xinyuan",
    "title": "心猿意馬",
    "icon": "猿",
    "w": 10,
    "once": false,
    "hidden": false,
    "trigger": "cultivate",
    "minRealm": 0,
    "text": "剛閉上眼，晚餐、舊事和明天要做的事一起衝進腦袋。你的心猿比靈寵還難管。",
    "choices": [
      {
        "text": "把雜念請出門",
        "out": {
          "cult": 18000,
          "news": "心猿歸正，意馬收繮，此一坐頗有寸進。"
        }
      },
      {
        "text": "神遊一下，反正已經走遠了",
        "out": {
          "cult": 3000,
          "news": "有人打坐時神遊太虛，醒來只道餓矣。"
        }
      }
    ]
  },
  {
    "id": "eva_qiaofu",
    "title": "樵夫指路",
    "icon": "樵",
    "w": 10,
    "once": false,
    "hidden": false,
    "trigger": "any",
    "minRealm": 0,
    "text": "樵夫見你走得像迷路小鴨，熱心指了近路，還遞來半囊山泉。修仙界導航，真人版。",
    "choices": [
      {
        "text": "謝謝導航，水也收下",
        "out": {
          "cult": 12000,
          "lingShi": 20,
          "news": "樵夫一指，省卻半日腳程。"
        }
      },
      {
        "text": "付30靈石，給好評",
        "req": {
          "lingShi": 30
        },
        "out": {
          "cult": 24000,
          "news": "樵夫得了酬謝，逢人便誇你厚道。"
        }
      }
    ]
  },
  {
    "id": "eva_shibao",
    "title": "拾得遺囊",
    "icon": "囊",
    "w": 6,
    "once": false,
    "hidden": false,
    "trigger": "any",
    "minRealm": 1,
    "text": "草叢裡躺著一個儲物袋，禁制已經退休。看起來很有故事，也很有可能有存款。",
    "choices": [
      {
        "text": "打開看看，緣分來了",
        "out": {
          "lingShi": 300,
          "mat": {
            "ore_xuantie": 1
          },
          "cult": 24000,
          "news": "無主遺囊，落入有緣人之手。"
        }
      },
      {
        "text": "等失主，先當保管員",
        "out": {
          "cult": 72000,
          "news": "有人拾金不昧，失主乃一介散修，二人結為道友。"
        }
      }
    ]
  },
  {
    "id": "eva_chapeng",
    "title": "茶棚聽聞",
    "icon": "茶",
    "w": 10,
    "once": false,
    "hidden": false,
    "trigger": "any",
    "minRealm": 1,
    "text": "茶棚裡幾位修士聊得熱火朝天，從坊市行情聊到秘境八卦。你才發現，修仙也要追更新。",
    "choices": [
      {
        "text": "坐下聽，瓜子備好",
        "out": {
          "cult": 24000,
          "news": "茶棚之中多奇聞，有心人自有所得。"
        }
      },
      {
        "text": "花100靈石請一席，解鎖內幕",
        "req": {
          "lingShi": 100
        },
        "out": {
          "cult": 72000,
          "news": "你沽酒一席，換得滿座真言。"
        }
      }
    ]
  },
  {
    "id": "eva_lundao",
    "title": "道友論道",
    "icon": "論",
    "w": 12,
    "once": false,
    "hidden": false,
    "trigger": "any",
    "minRealm": 0,
    "text": "一位道友看你打坐認真，邀你喝茶論道。你端起茶杯，決定暫時不提自己剛纔在打瞌睡。",
    "choices": [
      {
        "text": "喝茶聊天，腦袋開花",
        "out": {
          "cult": 18000,
          "news": "一壺粗茶，竟論出三分真味。"
        }
      },
      {
        "text": "互驗修為，小心別嗆氣",
        "out": {
          "cult": 36000,
          "toxicity": 3,
          "news": "論道變成印證修為，二人各有感悟，也各自嗆了口氣。"
        }
      }
    ]
  },
  {
    "id": "eva_qiuyuan",
    "title": "仗義援手",
    "icon": "援",
    "w": 8,
    "once": false,
    "hidden": false,
    "trigger": "any",
    "minRealm": 1,
    "text": "黑風狼把一位道友逼到崖邊。那道友看見你，眼睛瞬間亮得像終於等到救援按鈕。",
    "choices": [
      {
        "text": "拔劍幫忙，別光顧著看",
        "out": {
          "cult": 72000,
          "mat": {
            "beast_yaodan": 1
          },
          "news": "有人路見不平，劍退黑風狼，救下一位同道。"
        }
      },
      {
        "text": "大聲助威，嗓門也算戰力",
        "out": {
          "cult": 24000,
          "news": "那道友狼狽逃出生天，對你半是感激半是怨懟。"
        }
      },
      {
        "text": "悄悄繞路，這題先跳過",
        "out": {
          "cult": 0,
          "news": "林間呼救聲漸歇，你加快了腳步。"
        }
      }
    ]
  },
  {
    "id": "eva_huanbao",
    "title": "以物易物",
    "icon": "易",
    "w": 8,
    "once": false,
    "hidden": false,
    "trigger": "any",
    "minRealm": 1,
    "text": "道友缺靈芝配藥，想用聚氣丹交換。雙方打開儲物袋，像兩個認真交換點心的小朋友。",
    "choices": [
      {
        "text": "用1株靈芝換1枚丹",
        "req": {
          "mat": {
            "herb_lingzhi": 1
          }
        },
        "out": {
          "pill": {
            "pill_juqi": 1
          },
          "news": "各取所需，皆大歡喜。"
        }
      },
      {
        "text": "加100靈石，多換1枚",
        "req": {
          "mat": {
            "herb_lingzhi": 1
          },
          "lingShi": 100
        },
        "out": {
          "pill": {
            "pill_juqi": 2
          },
          "news": "添頭一加，丹成雙枚。"
        }
      },
      {
        "text": "先不了，靈芝另有安排",
        "out": {
          "cult": 24000,
          "news": "道友也不惱，背起行囊自去了。"
        }
      }
    ]
  },
  {
    "id": "eva_yanjiu",
    "title": "靈宴小聚",
    "icon": "宴",
    "w": 8,
    "once": false,
    "hidden": false,
    "trigger": "any",
    "minRealm": 1,
    "text": "道友打開新釀靈桃酒，整間屋子都香了。你的小酒杯看起來無害，經脈卻已開始緊張。",
    "choices": [
      {
        "text": "開懷喝，真氣可能打結",
        "out": {
          "cult": 72000,
          "toxicity": 4,
          "news": "靈桃酒雖好，貪杯亦亂真氣。"
        }
      },
      {
        "text": "淺嚐就好，留點清醒",
        "out": {
          "cult": 24000,
          "toxicity": 1,
          "news": "三杯即止，賓主盡歡。"
        }
      },
      {
        "text": "我喝茶，負責記住你們的糗事",
        "out": {
          "cult": 12000,
          "news": "滿座皆醉你獨醒，倒顯得不合羣了。"
        }
      }
    ]
  },
  {
    "id": "eva_tiaoxin",
    "title": "宿敵挑釁",
    "icon": "釁",
    "w": 6,
    "once": false,
    "hidden": false,
    "trigger": "any",
    "minRealm": 2,
    "text": "老對頭堵住去路，約你雲臺論劍。開場白背得很熟，顯然在家對鏡子練過。",
    "choices": [
      {
        "text": "接招，擂臺見",
        "out": {
          "cult": 576000,
          "lingShi": 500,
          "news": "雲臺一會，你技高一籌，挫了那人的銳氣。"
        }
      },
      {
        "text": "無視，省點表情",
        "out": {
          "cult": 96000,
          "news": "任你百般挑釁，我自巋然不動。"
        }
      },
      {
        "text": "回嘴，先比口才",
        "out": {
          "cult": 288000,
          "news": "一場脣槍舌劍，圍觀者盡皆歎服。"
        }
      }
    ]
  },
  {
    "id": "eva_shuangxiu",
    "title": "道侶同修",
    "icon": "侶",
    "w": 4,
    "once": false,
    "hidden": true,
    "trigger": "any",
    "minRealm": 2,
    "cond": "fellow_partner",
    "text": "月色正好，道侶邀你到竹樓一起修行。兩人調好氣息，連平常亂跑的靈氣都乖乖排隊。",
    "choices": [
      {
        "text": "一起合氣，修為也成雙",
        "out": {
          "cult": 1152000,
          "news": "神仙眷侶，令人豔羨。"
        }
      },
      {
        "text": "喝茶論道，甜度剛剛好",
        "out": {
          "cult": 576000,
          "toxicity": -3,
          "news": "竹樓夜話，一盞清茶也養人。"
        }
      }
    ]
  },
  {
    "id": "eva_merchant_1",
    "title": "青衫賈人",
    "icon": "賈",
    "w": 4,
    "once": true,
    "hidden": false,
    "trigger": "any",
    "minRealm": 0,
    "text": "青衫商人神祕地掏出殘卷：「墓裡出土的，識貨才懂。」他說得很小聲，價格倒是一點都不低調。",
    "choices": [
      {
        "text": "150靈石買下，聽聽後續",
        "req": {
          "lingShi": 150
        },
        "out": {
          "frag": {
            "gf_wanjian": 1
          },
          "chain": "eva_merchant_2",
          "news": "無名殘卷入手，紙頁間隱有劍鳴。"
        }
      },
      {
        "text": "砍到80，省錢但可能斷緣",
        "req": {
          "lingShi": 80
        },
        "out": {
          "frag": {
            "gf_wanjian": 1
          },
          "news": "賈人雖不悅，終究還是賣了——只是再沒提過下卷。"
        }
      },
      {
        "text": "不買，錢包先保住",
        "out": {
          "cult": 6000,
          "news": "殘卷與賈人一同消失在晨霧裏。"
        }
      }
    ]
  },
  {
    "id": "eva_merchant_2",
    "title": "賈人再訪",
    "icon": "卷",
    "w": 1,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "text": "商人又來了，從擔底摸出中卷：「老客戶嘛，當然先想到你。」說完報出新價格，你的錢包突然想閉關。",
    "choices": [
      {
        "text": "付600靈石，繼續追卷",
        "req": {
          "lingShi": 600
        },
        "out": {
          "frag": {
            "gf_wanjian": 2
          },
          "chain": "eva_merchant_3",
          "news": "殘卷漸全，劍意漸明。"
        }
      },
      {
        "text": "買不起，這集先停更",
        "out": {
          "cult": 12000,
          "news": "賈人嘆息一聲，擔起擔子去了，此後再未出現。"
        }
      }
    ]
  },
  {
    "id": "eva_merchant_3",
    "title": "多寶行商",
    "icon": "寶",
    "w": 1,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "text": "第三次登門，商人終於承認自己來自多寶閣。終卷可以用靈草抵，修仙界也懂彈性付款。",
    "choices": [
      {
        "text": "交3株靈芝，草本結帳",
        "req": {
          "mat": {
            "herb_lingzhi": 3
          }
        },
        "out": {
          "frag": {
            "gf_wanjian": 3
          },
          "lingYu": 2,
          "hiddenEnd": "三卷合一，殘頁自行拼合，現出一行古篆：「劍二十三，留待有緣。」"
        }
      },
      {
        "text": "付2000靈石，一次買斷",
        "req": {
          "lingShi": 2000
        },
        "out": {
          "frag": {
            "gf_wanjian": 3
          },
          "lingYu": 1,
          "hiddenEnd": "三卷合一，殘頁自行拼合，現出一行古篆：「劍二十三，留待有緣。」"
        }
      }
    ]
  },
  {
    "id": "eva_heishi",
    "title": "黑市夜拍",
    "icon": "拍",
    "w": 4,
    "once": false,
    "hidden": false,
    "trigger": "any",
    "minRealm": 2,
    "text": "半夜黑市拍賣，壓軸是妖獸內丹和一顆溫熱靈寵蛋。你的理智說別買，手已經想舉牌了。",
    "choices": [
      {
        "text": "1500靈石拍內丹",
        "req": {
          "lingShi": 1500
        },
        "out": {
          "mat": {
            "beast_yaodan": 2
          },
          "news": "黑市之中，有人一擲千金。"
        }
      },
      {
        "text": "2500靈石帶蛋回家",
        "req": {
          "lingShi": 2500
        },
        "out": {
          "egg": 1,
          "news": "蛋殼微溫，其中似有心跳。"
        }
      },
      {
        "text": "看熱鬧就好，手壓住",
        "out": {
          "cult": 96000,
          "news": "夜拍散場，看客一鬨而散。"
        }
      }
    ]
  },
  {
    "id": "eva_yiyu",
    "title": "以物易玉",
    "icon": "玉",
    "w": 6,
    "once": false,
    "hidden": false,
    "trigger": "any",
    "minRealm": 1,
    "text": "行商上門收玄鐵，豪氣表示可以付靈玉。平常沉得要命的石頭，今天突然變得很順眼。",
    "choices": [
      {
        "text": "用2塊玄鐵換玉",
        "req": {
          "mat": {
            "ore_xuantie": 2
          }
        },
        "out": {
          "lingYu": 2,
          "news": "以物易玉，兩不相虧。"
        }
      },
      {
        "text": "自己留著，未來會用到",
        "out": {
          "cult": 24000,
          "news": "玄鐵沉入箱底，行商悻悻而去。"
        }
      }
    ]
  },
  {
    "id": "eva_shezhang",
    "title": "老賈賒賬",
    "icon": "賒",
    "w": 3,
    "once": false,
    "hidden": true,
    "trigger": "any",
    "cond": "poor",
    "text": "老商人看你錢包空得能聽迴音，笑著遞來丹藥：「先拿著，靈石以後再說。」原來友情也能暫時結帳。",
    "choices": [
      {
        "text": "收下，記住這份人情",
        "out": {
          "pill": {
            "pill_juqi": 1
          },
          "news": "雪中送炭，來日必報。"
        }
      },
      {
        "text": "婉拒，窮也要自己站穩",
        "out": {
          "cult": 12000,
          "lingYu": 1,
          "news": "人窮志不短，賈人對你高看一眼。"
        }
      }
    ]
  },
  {
    "id": "eva_ruhuo_1",
    "title": "丹毒攻心",
    "icon": "毒",
    "w": 4,
    "once": false,
    "hidden": true,
    "trigger": "cultivate",
    "minRealm": 1,
    "cond": "tox50",
    "text": "丹藥喫太勤，丹毒今晚集體開會。真氣逆行，眼前幻象還排隊叫號，經脈急需處理。",
    "choices": [
      {
        "text": "硬壓下去，毒性還會增加",
        "out": {
          "cult": 72000,
          "toxicity": 15,
          "news": "有人強壓丹毒，險些走火入魔。"
        }
      },
      {
        "text": "散功排毒，先保養身體",
        "out": {
          "cult": 0,
          "toxicity": -25,
          "news": "散功半日，方將毒火逼出體外。"
        }
      },
      {
        "text": "傳訊求助，召喚靠譜道友",
        "out": {
          "cult": 24000,
          "chain": "eva_ruhuo_2",
          "news": "你傳訊四方，靜候援手。"
        }
      }
    ]
  },
  {
    "id": "eva_ruhuo_2",
    "title": "雪中送炭",
    "icon": "援",
    "w": 1,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "text": "道友踏月趕來，帶著清毒散守了你整晚。嘴上說順路，手裡卻連熱茶和小毯子都備好了。",
    "choices": [
      {
        "text": "現在服用，讓丹毒下班",
        "out": {
          "cult": 72000,
          "toxicity": -20,
          "news": "患難見真情，此恩沒齒難忘。"
        }
      },
      {
        "text": "丹藥先收著，謝意不打折",
        "out": {
          "pill": {
            "pill_qingdu": 1
          },
          "cult": 24000,
          "news": "丹藥收好，情誼也收好。"
        }
      }
    ]
  },
  {
    "id": "eva_xinmo",
    "title": "心魔低語",
    "icon": "魔",
    "w": 4,
    "once": false,
    "hidden": true,
    "trigger": "cultivate",
    "minRealm": 1,
    "cond": "stuck3d",
    "text": "好幾天沒突破，心魔開始碎念：「不如算了吧。」牠的話術很努力，你聽著卻只覺得牠需要休息。",
    "choices": [
      {
        "text": "守住道心，把心魔靜音",
        "out": {
          "cult": 144000,
          "news": "心魔退散，道心愈堅。"
        }
      },
      {
        "text": "休息三天，腦袋也要放假",
        "out": {
          "cult": 0,
          "toxicity": -5,
          "news": "偷得浮生三日閒，歸來心氣稍平。"
        }
      }
    ]
  },
  {
    "id": "eva_qisou",
    "title": "山道棋叟",
    "icon": "棋",
    "w": 6,
    "once": false,
    "hidden": false,
    "trigger": "any",
    "minRealm": 1,
    "text": "松下老先生擺好棋盤，笑著邀你一局。你看不出他的修為，但看得出他已經等對手等到茶涼了。",
    "choices": [
      {
        "text": "陪下一局，輸贏隨緣",
        "out": {
          "cult": 144000,
          "news": "一局終了，老者撫須：「棋如修行，你悟了麼。」"
        }
      },
      {
        "text": "請教棋理，順便學功法",
        "out": {
          "cult": 72000,
          "frag": {
            "gf_qingxin": 1
          },
          "news": "老者以棋喻道，你似懂非懂，只覺受用無窮。"
        }
      },
      {
        "text": "禮貌告辭，今天腦力不足",
        "out": {
          "cult": 24000,
          "news": "老者望着你的背影，輕輕落下一子。"
        }
      }
    ]
  },
  {
    "id": "eva_zuidao",
    "title": "醉道人",
    "icon": "醉",
    "w": 6,
    "once": false,
    "hidden": false,
    "trigger": "any",
    "minRealm": 2,
    "text": "醉道人躺在溪石上胡言亂語，句句卻都暗合劍理。你陷入沉思：到底是他醉了，還是你平常不夠醒。",
    "choices": [
      {
        "text": "花200靈石請酒，聽進階版",
        "req": {
          "lingShi": 200
        },
        "out": {
          "cult": 576000,
          "news": "一葫蘆濁酒，換來三分劍意。"
        }
      },
      {
        "text": "免費旁聽，耳朵豎起來",
        "out": {
          "cult": 288000,
          "news": "醉話連篇，有心人聽出了門道。"
        }
      },
      {
        "text": "不當回事，錯過也認了",
        "out": {
          "cult": 0,
          "news": "醉道人翻了個身，罵了句「朽木」。"
        }
      }
    ]
  },
  {
    "id": "eva_chuangong",
    "title": "前輩傳功",
    "icon": "傳",
    "w": 2,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "minRealm": 4,
    "text": "古洞裡的前輩想把最後的真元傳給你，只求衣缽有人接。這份託付很重，你連站姿都認真了。",
    "choices": [
      {
        "text": "拜受真元，經脈要撐住",
        "out": {
          "cult": 21600000,
          "meridian": 1,
          "toxicity": 10,
          "news": "前輩含笑而逝，真元盡付有緣人。"
        }
      },
      {
        "text": "拜謝婉辭，心意已領",
        "out": {
          "cult": 5400000,
          "lingYu": 3,
          "news": "前輩頷首：「不受無功之祿，此子可教。」"
        }
      }
    ]
  },
  {
    "id": "eva_mengshou",
    "title": "夢中授業",
    "icon": "夢",
    "w": 3,
    "once": false,
    "hidden": true,
    "trigger": "cultivate",
    "minRealm": 0,
    "cond": "night",
    "text": "夢裡白鬍子老先生教你口訣，醒來竟然全記得。平常背書沒這麼順，夢境課堂的教學品質值得肯定。",
    "choices": [
      {
        "text": "照著練，夢也能補課",
        "out": {
          "cult": 72000,
          "news": "夢中得授真訣，醒來道行精進。"
        }
      },
      {
        "text": "先求穩，夢裡的先不採用",
        "out": {
          "cult": 18000,
          "toxicity": -2,
          "news": "寧可信其無，不可信其有，穩字當頭。"
        }
      }
    ]
  },
  {
    "id": "eva_zhuguo",
    "title": "峭壁朱果",
    "icon": "果",
    "w": 8,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "minRealm": 0,
    "text": "峭壁上的朱果紅得發亮，香味一路飄到鼻尖。果子很好，位置卻顯然沒有替小短腿考慮。",
    "choices": [
      {
        "text": "冒險攀摘，可能傷到經脈",
        "out": {
          "mat": {
            "herb_zhuguo": 2
          },
          "cult": 12000,
          "toxicity": 5,
          "news": "有人於絕壁上採得朱果，掌心磨得鮮血淋漓。"
        }
      },
      {
        "text": "綁繩慢慢摘，安全第一",
        "out": {
          "mat": {
            "herb_zhuguo": 1
          },
          "cult": 6000,
          "news": "繩索三股，取之徐徐，雖少亦穩。"
        }
      },
      {
        "text": "繞路，寶物不包售後",
        "out": {
          "cult": 12000,
          "news": "寶山空回，保命要緊。"
        }
      }
    ]
  },
  {
    "id": "eva_xuantie",
    "title": "深谷玄鐵",
    "icon": "鐵",
    "w": 8,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "minRealm": 1,
    "text": "山谷裡露出玄鐵礦脈，一敲就知道是好東西。一抬才發現，這是對儲物袋和腰力的雙重考驗。",
    "choices": [
      {
        "text": "背3塊回家，肩膀會碎念",
        "out": {
          "mat": {
            "ore_xuantie": 3
          },
          "cult": 24000,
          "toxicity": 2,
          "news": "背石出谷，肩背俱腫，所幸不虛此行。"
        }
      },
      {
        "text": "只取1塊精礦，輕巧有理",
        "out": {
          "mat": {
            "ore_xuantie": 1
          },
          "cult": 72000,
          "news": "取其精華，棄其糟粕，礦脈留存待後日。"
        }
      },
      {
        "text": "賣礦位消息，賺400靈石",
        "out": {
          "lingShi": 400,
          "news": "一條礦脈的消息，換來一袋靈石。"
        }
      }
    ]
  },
  {
    "id": "eva_bingpo",
    "title": "寒潭冰魄",
    "icon": "冰",
    "w": 6,
    "once": false,
    "hidden": false,
    "trigger": "explore",
    "minRealm": 2,
    "text": "寒潭中央亮著幽光，冷氣隔著水面就開始工作。你看著寶物，寶物看起來完全不提供保暖服務。",
    "choices": [
      {
        "text": "下潛取寶，寒氣可能入體",
        "out": {
          "mat": {
            "gem_hanyu": 1
          },
          "cult": 288000,
          "toxicity": 8,
          "news": "寒潭取寶，上岸時脣色都青了。"
        }
      },
      {
        "text": "隔水運氣，寶物先不拿",
        "out": {
          "cult": 288000,
          "news": "隔水溫養真氣，雖未得寶，亦有進益。"
        }
      },
      {
        "text": "看看就好，我怕冷很合理",
        "out": {
          "cult": 96000,
          "news": "潭水深寒，不是有緣人，不敢輕涉。"
        }
      }
    ]
  },
  {
    "id": "eva_leimu",
    "title": "雷火焦木",
    "icon": "木",
    "w": 5,
    "once": false,
    "hidden": false,
    "trigger": "any",
    "minRealm": 3,
    "text": "千年古槐被雷劈黑，樹心卻凝出紫色雷晶。這大概是全山最昂貴的一次烤木頭。",
    "choices": [
      {
        "text": "取出雷晶，小心手麻",
        "out": {
          "mat": {
            "gem_zijing": 1
          },
          "cult": 1260000,
          "news": "天雷淬木成晶，得之者暗藏一分雷威。"
        }
      },
      {
        "text": "搬走整棵，坊市會收",
        "out": {
          "lingShi": 3000,
          "news": "雷木亦是煉器良材，坊市搶着要。"
        }
      }
    ]
  },
  {
    "id": "eva_yaowang",
    "title": "藥王出世",
    "icon": "王",
    "w": 3,
    "once": false,
    "hidden": true,
    "trigger": "any",
    "minRealm": 6,
    "text": "萬年藥王破土發光，四方修士立刻趕來。牠才剛起牀，就被迫參加一場大型爭奪活動。",
    "choices": [
      {
        "text": "出手爭藥，可能結怨受損",
        "out": {
          "mat": {
            "herb_yaowang": 1
          },
          "cult": 108000000,
          "toxicity": 5,
          "news": "藥王之爭，有人技壓羣雄，也結下幾樁樑子。"
        }
      },
      {
        "text": "混亂中拿點小收穫",
        "out": {
          "mat": {
            "herb_xuelian": 2
          },
          "cult": 36000000,
          "news": "亂中取利，見好就收。"
        }
      },
      {
        "text": "遠遠避開，圍觀也要安全",
        "out": {
          "cult": 36000000,
          "news": "懷璧其罪，不沾為妙。"
        }
      }
    ]
  },
  {
    "id": "eva_shibei",
    "title": "山洪古碑",
    "icon": "碑",
    "w": 4,
    "once": true,
    "hidden": false,
    "trigger": "any",
    "minRealm": 1,
    "text": "山洪沖出半截古碑，末尾依稀一個「府」字。你擦了擦泥，感覺像收到一張字很糊的尋寶邀請。",
    "choices": [
      {
        "text": "沿著石碑找入口",
        "out": {
          "cult": 24000,
          "chain": "eva_shishi",
          "news": "古碑之後，似有洞天。"
        }
      },
      {
        "text": "拓下碑文，帶回慢慢看",
        "out": {
          "cult": 72000,
          "frag": {
            "gf_taixuan": 1
          },
          "news": "碑文古奧，拓片似有微光。"
        }
      },
      {
        "text": "沒興趣，先讓泥巴保管",
        "out": {
          "cult": 0,
          "news": "古碑又被泥沙掩去半邊。"
        }
      }
    ]
  },
  {
    "id": "eva_shishi",
    "title": "洞中石室",
    "icon": "室",
    "w": 1,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "text": "碑後藏著石室，前輩枯骨端坐，桌上玉簡發暖，角落禁制發亮。這間屋子的歡迎方式有點考驗禮貌。",
    "choices": [
      {
        "text": "先拜前輩，再拿遺物",
        "out": {
          "cult": 72000,
          "lingYu": 2,
          "chain": "eva_yifu",
          "news": "拜過前輩，方動遺物，禮數週全。"
        }
      },
      {
        "text": "直接拿玉簡，先接收內容",
        "out": {
          "frag": {
            "gf_taixuan": 2
          },
          "cult": 24000,
          "chain": "eva_yifu",
          "news": "玉簡入手微溫，似有餘息。"
        }
      },
      {
        "text": "摸摸禁制，可能被反彈",
        "out": {
          "cult": 0,
          "toxicity": 10,
          "news": "禁制反噬，你吐血退出了石室。"
        }
      }
    ]
  },
  {
    "id": "eva_yifu",
    "title": "遺府傳承",
    "icon": "府",
    "w": 1,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "text": "玉簡留下前輩遺言：畢生收藏盡在此處，盼後人繼承道統。原來這不是空屋參觀，是一場認真的交棒。",
    "choices": [
      {
        "text": "接下傳承，認真練下去",
        "out": {
          "cult": 576000,
          "frag": {
            "gf_taixuan": 2
          },
          "hiddenEnd": "遺府石門緩緩閉合，碑上「府」字之前，隱約又亮了半個「劍」字。"
        }
      },
      {
        "text": "只取財物，傳承留在此地",
        "out": {
          "lingShi": 1500,
          "mat": {
            "ore_xuantie": 2
          },
          "hiddenEnd": "你取了財帛，也把前輩的道統，永遠留在了原地。"
        }
      }
    ]
  },
  {
    "id": "eva_baihu_1",
    "title": "白狐負傷",
    "icon": "狐",
    "w": 5,
    "once": true,
    "hidden": false,
    "trigger": "any",
    "minRealm": 0,
    "text": "草叢裡一隻小白狐傷了後腿，眼睛水汪汪地望著你。牠沒說話，但求助表情已經滿分。",
    "choices": [
      {
        "text": "花1株靈芝幫牠療傷",
        "req": {
          "mat": {
            "herb_lingzhi": 1
          }
        },
        "out": {
          "cult": 12000,
          "chain": "eva_baihu_2",
          "news": "白狐舔舐傷口，深深看了你一眼。"
        }
      },
      {
        "text": "捉去換80靈石",
        "out": {
          "lingShi": 80,
          "news": "白狐哀鳴一聲，被你賣進了獸籠。"
        }
      },
      {
        "text": "先離開，不接這段緣分",
        "out": {
          "cult": 0,
          "news": "草木依舊，狐蹤已渺。"
        }
      }
    ]
  },
  {
    "id": "eva_baihu_2",
    "title": "白狐銜恩",
    "icon": "恩",
    "w": 1,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "text": "白狐叼著帶露雪蓮找上門，放下便轉身走。這位小客人不愛聊天，謝禮倒是包裝得很用心。",
    "choices": [
      {
        "text": "收下謝禮，看看後續",
        "out": {
          "mat": {
            "herb_xuelian": 1
          },
          "cult": 18000,
          "chain": "eva_baihu_3",
          "news": "狐且知恩，何況於人。"
        }
      },
      {
        "text": "送牠回山林，彼此珍重",
        "out": {
          "cult": 36000,
          "lingYu": 1,
          "news": "白狐三顧回首，似有不捨。"
        }
      }
    ]
  },
  {
    "id": "eva_baihu_3",
    "title": "月夜引路",
    "icon": "月",
    "w": 1,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "text": "月圓之夜，小白狐在窗外叫了三聲，帶你找到一顆暖呼呼的蛋。牠的報恩計畫，原來還有孵蛋篇。",
    "choices": [
      {
        "text": "抱回靈蛋，家裡添一員",
        "out": {
          "egg": 1,
          "cult": 36000,
          "hiddenEnd": "白狐化作流光沒入林間，風中只餘一句：「善自護持。」"
        }
      },
      {
        "text": "留在原地，尊重這份緣分",
        "out": {
          "lingYu": 2,
          "cult": 18000,
          "hiddenEnd": "你空着手回來，此後夢裏，總見一雙狐目。"
        }
      }
    ]
  },
  {
    "id": "eva_jianmeng",
    "title": "夜夢劍冢",
    "icon": "冢",
    "w": 3,
    "once": true,
    "hidden": false,
    "trigger": "any",
    "minRealm": 3,
    "text": "你夢見萬劍古冢，碑上寫著「軒轅」。醒來枕邊竟多了一片鐵鏽，這個夢的周邊商品很實在。",
    "choices": [
      {
        "text": "記牢線索，追查劍冢",
        "out": {
          "cult": 1260000,
          "chain": "evb_xuanyuan_1",
          "news": "夢中劍冢，或為前緣指引。"
        }
      },
      {
        "text": "笑笑就好，先換枕套",
        "out": {
          "cult": 420000,
          "news": "日有所思，夜有所夢，不必當真。"
        }
      }
    ]
  },
  {
    "id": "eva_longyin",
    "title": "深潭龍吟",
    "icon": "龍",
    "w": 3,
    "once": true,
    "hidden": false,
    "trigger": "any",
    "minRealm": 5,
    "text": "深潭忽然傳來龍吟，水面翻成一大鍋碧色湯。下面那位顯然不小，你先把袖子拉好。",
    "choices": [
      {
        "text": "循著龍聲往下找",
        "out": {
          "cult": 23400000,
          "chain": "evb_longyuan_1",
          "news": "龍吟出淵，必有異寶現世。"
        }
      },
      {
        "text": "保持距離，尊重巨型住戶",
        "out": {
          "cult": 7800000,
          "news": "龍潭非善地，不去也罷。"
        }
      }
    ]
  },
  {
    "id": "eva_guijia",
    "title": "歸墟龜甲",
    "icon": "甲",
    "w": 3,
    "once": true,
    "hidden": false,
    "trigger": "any",
    "minRealm": 5,
    "text": "海邊撿到半截龜甲，裂紋剛好組成「歸墟」二字。連烏龜留下的線索，都比你的字工整。",
    "choices": [
      {
        "text": "研究龜甲，追查歸墟",
        "out": {
          "cult": 23400000,
          "chain": "evb_gui_xu_1",
          "news": "龜甲所指，正是萬水歸墟之處。"
        }
      },
      {
        "text": "賣給藏家，換8000靈石",
        "out": {
          "lingShi": 8000,
          "news": "一截龜甲賣了高價，買家來歷成謎。"
        }
      }
    ]
  },
  {
    "id": "eva_maose",
    "title": "茅塞頓開",
    "icon": "悟",
    "w": 4,
    "once": false,
    "hidden": true,
    "trigger": "cultivate",
    "minRealm": 1,
    "cond": "stuck3d",
    "text": "你盯著屋簷滴水，突然懂了卡住的那一點。苦思好幾天的問題，最後是漏水替你解的。",
    "choices": [
      {
        "text": "趁現在再練一輪",
        "out": {
          "cult": 288000,
          "news": "困守多時，一朝頓悟。"
        }
      },
      {
        "text": "記下心得，漏水晚點修",
        "out": {
          "cult": 144000,
          "frag": {
            "gf_taixuan": 1
          },
          "news": "滴水穿石之理，錄之於卷，常看常新。"
        }
      }
    ]
  },
  {
    "id": "eva_yidugongdu",
    "title": "以毒攻毒",
    "icon": "藥",
    "w": 3,
    "once": false,
    "hidden": true,
    "trigger": "cultivate",
    "minRealm": 2,
    "cond": "tox50",
    "text": "丹毒纏身，郎中推薦腐心草以毒攻毒。你看著那株草，突然很想問他：真的不是在加菜嗎。",
    "choices": [
      {
        "text": "吞下腐心草，丹毒仍可能增加",
        "out": {
          "cult": 1152000,
          "toxicity": 15,
          "news": "以毒攻毒，險中求進——此番賭贏了。"
        }
      },
      {
        "text": "閉關專心排毒",
        "out": {
          "cult": 0,
          "toxicity": -30,
          "news": "死關三日，毒盡而出。"
        }
      },
      {
        "text": "婉拒偏方，先照老方法練",
        "out": {
          "cult": 288000,
          "news": "江湖郎中，安知不是賣假藥的。"
        }
      }
    ]
  },
  {
    "id": "eva_zhalu",
    "title": "炸爐悟道",
    "icon": "爐",
    "w": 3,
    "once": false,
    "hidden": true,
    "trigger": "any",
    "minRealm": 1,
    "cond": "explode5",
    "text": "丹爐又炸了，你和屋頂短暫對望。清理灰燼時，竟悟到火性和劍意相通，學費雖貴但總算有上課。",
    "choices": [
      {
        "text": "蹲著悟道，別浪費爆炸",
        "out": {
          "cult": 72000,
          "frag": {
            "gf_taixuan": 2
          },
          "news": "炸爐五次，炸出一番道理，也算不虧。"
        }
      },
      {
        "text": "掃丹房，灰裡可能有東西",
        "out": {
          "mat": {
            "herb_lingzhi": 1
          },
          "cult": 24000,
          "news": "灰燼裏翻檢，竟有殘存的藥材。"
        }
      }
    ]
  },
  {
    "id": "eva_guren",
    "title": "故人識君",
    "icon": "緣",
    "w": 3,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "minRealm": 1,
    "cond": "reincarn1",
    "text": "街上老奶奶盯著你看，說你前世幫過她。你想不起來，心裡卻暖了一下，輪回也沒把人情洗掉。",
    "choices": [
      {
        "text": "認下這段前緣",
        "out": {
          "rootWash": 1,
          "cult": 144000,
          "news": "前世因，今生果，老嫗以一匣舊物相贈。"
        }
      },
      {
        "text": "說聲可能認錯了",
        "out": {
          "lingYu": 2,
          "cult": 72000,
          "news": "老嫗怔怔良久，蹣跚而去。"
        }
      }
    ]
  },
  {
    "id": "eva_mingzhen",
    "title": "名震一方",
    "icon": "名",
    "w": 2,
    "once": true,
    "hidden": true,
    "trigger": "any",
    "minRealm": 6,
    "cond": "power10m",
    "text": "你的名氣傳開，道友帶禮物登門，把半間屋子堆滿。修為長了，接待和收納能力也得跟著突破。",
    "choices": [
      {
        "text": "開門待客，禮物排隊放",
        "out": {
          "lingShi": 50000,
          "lingYu": 3,
          "cult": 108000000,
          "news": "高朋滿座，蓬蓽生輝。"
        }
      },
      {
        "text": "謝客清修，把安靜留給自己",
        "out": {
          "cult": 216000000,
          "lingYu": 1,
          "news": "盛名之下，你選了清淨。"
        }
      }
    ]
  }
]);
})();
