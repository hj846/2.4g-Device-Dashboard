# NEXUS 多品牌设备中心

Windows 桌面设备看板，使用 Electron、node-hid 和 Windows 蓝牙接口读取设备状态。

## 界面与使用

- 薄荷绿、暗夜绿、极光紫、曜石玻璃四种动态玻璃主题，支持本地图片壁纸。
- 主设备展示与横向设备列表，已连接状态显示绿色圆点，设备卡片显示电池图标。
- 精确匹配产品图库和同型号配色；缺图时按类别显示写实通用图。点击主展示图可导入真实图片，按品牌、型号和类型保存在本机，重启后保留。
- 普通窗口固定为 1225 × 768，支持最大化与还原，禁止拖动边框缩放。
- 点击系统托盘 N 图标查看设备电量。关闭主窗口收起到托盘，通过托盘菜单或面板“退出”彻底关闭。

## 设备支持与限制

已实现雷柏 VT3S V2、狼蛛 F75、雷蛇 Basilisk X HyperSpeed、迈从 K87 V3 的对应电量协议，另提供通用 HID 枚举、品牌识别、USB 有线识别和 Windows 蓝牙状态读取。协议按型号适配，不代表整个品牌全部型号均支持电量读取。

赛睿 Arctis Nova 5 的 1038:2232 接收器适配已实现并通过模拟报文验证，尚未实机确认。墨刃 Bold TKL HE 按明确设备名称识别为有线键盘；无法仅凭通用 USB 名称确认品牌。详见 [适配说明](resources/NOVA5-BOLD-SUPPORT.md)。

启动电量查询限制为三轮，之后按设备活动触发并节流；闲置时不连续主动查询。HID 与蓝牙枚举分别执行，后台枚举间隔为 15 秒，设备插拔可触发刷新。无法读取的电量与信号显示未知；有线设备不显示电量与信号。

雷柏信号等级来自实验字段的近远距离标定，不是经过确认的 dBm / RSSI。接收器被系统枚举也不等于外设在线。当前不提供真实 DPI 写入。

## 开发与打包

在 Windows 上使用 Node.js，执行：

```sh
cd desktop-demo
npm ci
npm test
npm start
npm run build:win
```

打包输出：`release/NEXUS-win32-x64/NEXUS.exe`。分发时需保留整个目录，包括 `resources/app.asar.unpacked` 下的原生模块和 PowerShell 脚本。依赖和打包产物不提交到 Git。

界面与集成检查可在 desktop-demo 下运行：

```sh
npx electron check-showcase.cjs
npx electron check-custom-artwork.cjs
npx electron check-tray.cjs
npx electron check-window.cjs
```

界面检查使用模拟设备，不代替实机协议验证。设备数据处理测试运行 `npm test`。

## 素材与许可

厂商图片与标识归各自权利方所有。协议来源见 [第三方说明](desktop-demo/THIRD-PARTY-NOTICES.txt)，HarmonyOS Sans 许可见 [字体许可](desktop-demo/assets/fonts/LICENSE.txt)。通用图的生成方式和提示词见 [资源记录](resources/GENERIC-ARTWORK.md)。本机设备采集记录和下载的驱动研究缓存不提交。
