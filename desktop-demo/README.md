# NEXUS 多品牌设备看板 · 桌面测试 Demo

Windows 10/11：解压整个 `NEXUS-win32-x64` 文件夹，然后双击其中的 `NEXUS.exe`。请保留文件夹内的 `resources`、`locales` 和 DLL 文件；它们是程序运行的一部分。

这版使用 Electron、已确认的界面设计及本地模拟设备适配器。设备清单分别声明品牌、型号和能力；主进程根据适配器提供状态，通过预加载桥接层送到界面。点击卡片可查看详情，已连接鼠标可切换模拟 DPI。状态在程序关闭后重置。

当前不会访问真实 HID 设备。后续要接入真实品牌设备，需要逐款验证 VID/PID、设备通信协议和可读取能力，再替换对应模拟适配器。

源码入口：`main.cjs`、`preload.cjs`、`device-service.cjs`、`renderer.js`。
