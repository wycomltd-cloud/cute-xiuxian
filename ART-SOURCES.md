# v2.0.2 宗門庭院美術

生成方法：內建image_gen工具，非CLI；原創AI美術。五張圖全數以透明背景輸出，複製原始PNG至專案使用，沒有重新繪製或裁切原本男女角色插畫。

| 檔案 | 主題 |
|---|---|
| assets/sects/jian.png | 青綠瓦簷、劍架、聽劍庭 |
| assets/sects/fu.png | 金色瓦簷、符幡、卷軸 |
| assets/sects/zhen.png | 紫色星紋、星球、前庭陣法 |
| assets/sects/dan.png | 草藥、丹爐、藥罐、青綠庭院 |
| assets/sects/ti.png | 紅金瓦簷、石獅、練功石鎖與銅鐘 |

## 最終提示詞組

首張劍宗：Use case: illustration-story. Asset type: transparent foreground/environment overlay for an existing cute Chinese cultivation game, landscape 1536x1024. Create one beautiful highly detailed painterly 3D chibi fantasy Chinese SWORD SECT COURTYARD architectural foreground, no characters, no text. It will be composited on top of the reference-style game scene, framing the existing seated hero in the center without covering the hero. IMPORTANT ALPHA COMPOSITION: the entire central huge rectangular opening from x=18% to 82%, y=12% to 83% must be genuinely transparent, with no paint, no mist, no colors, no characters, no decoration crossing it. Build an architectural courtyard around that enormous transparent opening: elegant teal tiled pavilion eaves only across the top 0-12%, tall slender jade-green pillars at outer left/right 0-18% and 82-100%, distant layered sword academy roofs visible on outer edges, training swords and sword stands on the far-left and far-right, tiny stone lion, bonsai, green grass and cream peach blossoms at the corners. Lower 83-100% is a wide ivory stone training courtyard floor with delicate engraved sword motifs and a few side flowerpots, keeping the middle opening clear above the floor. Design should read as a full immersive courtyard environment and architectural proscenium, not a decorative picture border. Spacious, coherent perspective matching a front-facing eye-level seated hero scene, luminous warm daylight, crisp readable details, cute cozy premium mobile game art, beautiful hand-painted materials, no soft-focus blur. The transparency is a giant open doorway/courtyard space through which the existing hero and original distant mountains remain visible. No baked checkerboard. No letters, no logos, no UI, no central subject.

其餘四宗以劍宗圖為編輯參考，模板如下（TITLE、DETAILS按各宗替換）：

Use case: precise-object-edit. Edit the provided transparent architectural game environment overlay into a TITLE. Preserve the EXACT 1536x1024 landscape canvas, perspective, scale, positions of side pillars and floor, and especially the enormous central transparent opening. The complete rectangular zone x=18%-82%, y=12%-76% must stay genuinely alpha-transparent and completely empty for an existing seated game hero. Do not add any object into that opening. Keep the same premium detailed cute painterly fantasy Chinese cultivation-game style, crisp texture, no soft focus blur. Change the school-specific architecture and surrounding objects to: DETAILS. Roof only at top edges, detailed side scenery only on outer 18% left/right, courtyard floor below 78% height. No people, no animals, no readable text, no UI, no logo, no watermark. This is a seamless environmental architectural layer, not a UI picture frame. All portions that were transparent in the central opening must remain transparent; no black paint or checkerboard. Preserve the subject opening much more than any ornamental flourish.

- fu TITLE: TALISMAN SECT ACADEMY courtyard. DETAILS: warm ivory sandstone and honey-gold tiled eaves, hanging red-and-gold paper talisman strips and seal medallions with abstract motifs rather than readable text, small stacks of scrolls at extreme sides, glowing amber lanterns, scholarly peaceful atmosphere.
- zhen TITLE: STAR ARRAY SECT courtyard. DETAILS: lavender and midnight violet stone, pearl gold trim, star-pattern roof medallions, small floating geometric constellation rings and star spheres at extreme sides, clearly visible intricate magical array engraving on the bottom foreground floor, lilac blossoms and crystal lanterns.
- dan TITLE: HERBAL ALCHEMY SECT courtyard. DETAILS: fresh jade-green tiled eaves, pale cream stone, lush medicinal herb planters, two cute polished bronze alchemy cauldrons at extreme outer edges, shelves of tiny ceramic medicine jars on extreme sides, green leaves, white flowers, warm sunlight, very cozy herbal academy.
- ti TITLE: GOLDEN BODY MARTIAL SECT courtyard. DETAILS: warm terracotta and golden-bronze tiled eaves, robust creamy stone columns, bronze training bells and stone training weights at extreme sides, robust guardian stone lions, red-orange foliage, welcoming disciplined martial training academy.
