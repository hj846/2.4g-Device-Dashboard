# 通用产品展示图

使用内置 image_gen 工具生成（透明背景），2026-11-08。这是类别示意图，不是对应型号的真实产品照片。

最终文件：desktop-demo/assets/products/generic/{mouse,keyboard,headset,speaker}.png。

共同提示词：
Use case: product-mockup. Create a premium photorealistic product cutout for a desktop peripheral dashboard: [subject]. Single isolated object, centered with generous margin, entirely visible. Realistic industrial materials, soft studio lighting and subtle edge highlights readable against light and dark backgrounds. No brand, logo, text, decorations, scene, floor, pedestal, glow or cast shadow. True transparent background. This is a generic category placeholder, not a specific branded model.

各图片 subject：
+- mouse: one wireless computer mouse, satin graphite body, scroll wheel, three-quarter top view
- keyboard: one compact tenkeyless mechanical computer keyboard, neutral charcoal keycaps, three-quarter elevated view, entire keyboard visible
- headset: one over-ear wireless gaming headset, graphite headband and soft fabric ear cushions, short boom microphone, three-quarter front view
- speaker: one compact desktop loudspeaker, graphite cabinet with two realistic circular drivers, three-quarter front view

用户图片通过系统文件选择器导入，解码并保存为 PNG 数据，最长边 1600px，源文件限制 32MB。本地持久化目录为 Electron userData/product-artwork，按规范化品牌、型号和类型关联，独立于安装目录。点击主展示图替换图片；官方多配色图片通过独立按钮切换。
