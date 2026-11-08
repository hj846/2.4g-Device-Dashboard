# Nova 5 / Bold TKL HE 适配记录

实现日期：2026-11-08。此次没有连接这两台实机；测试使用模拟 HID 描述符和协议报文，不能代替实机验证。

## SteelSeries Arctis Nova 5 Wireless

- USB 接收器 VID/PID：1038:2232；状态端点：interface 3、usagePage FFC0、usage 1。
- 只发送状态读取命令 00 B0；回复命令 B0，至少 16 字节。byte 1 为 2 表示离线；电量 byte 3（0–100）；byte 4 为 1 表示充电。
- 启动最多查询三轮，间隔至少 15 秒；随后保留缓存并被动监听有效状态包。未得到回复时不把接收器存在当作耳机在线，也不推算电量。两分钟未取得新样本时标注上次确认在线。
- 无 RSSI 协议证据，信号保持未知。此实现仅主动查询 2232 型号；不向 5X/5P 或未知固件 PID 试发命令。
- 蓝牙连接沿用 Windows 蓝牙读取路径；系统不提供电量时显示未知，不能保证所有蓝牙固件暴露电量。
- 协议事实来源：[设备定义](https://github.com/Sapd/HeadsetControl/blob/master/lib/devices/steelseries_arctis_nova_5.hpp)、[通用状态读取](https://github.com/Sapd/HeadsetControl/blob/master/lib/devices/protocols/steelseries_protocol.hpp)。代码独立实现读取与校验，没有导入其音效设置逻辑。
- [上游音频异常反馈](https://github.com/Sapd/HeadsetControl/issues/452)：尚不能保证主动查询对所有固件均无音频影响，故没有增加持续轮询。
- 展示图来自 [SteelSeries 官方产品页](https://steelseries.com/gaming-headsets/arctis-nova-5)，原图 URL、SHA-256 见 manifest。

## Mork Blade Bold TKL HE

- 通过明确的产品名称 Bold TKL / Bold TKL HE 与品牌名称识别。识别为 USB 有线键盘，电量和信号不适用，不向键盘写入查询命令。
- [官方网页驱动](https://www.morkblade.games/)包含多个芯片 VID/PID，但未建立每一对与 Bold TKL 的可靠唯一对应关系，因此不将整组芯片 ID 硬编码为该型号。若固件仅报告 USB Keyboard，需补充实机描述符或厂商型号信息后才能可靠识别。
- Logo 沿用已提取的官网图标。产品图由用户提供的宣传图经内置 imagegen 做透明抠图，属于参考图衍生展示素材，非厂商原始透明文件；微小文字细节可能存在差异。
- 抠图提示：提取左侧两把白银色键盘，保留原始方向、角度、比例、按键布局及背面 Bold 字样，去掉黑背景与外围广告文字，输出透明 PNG；不重新设计产品。文件：morkblade/Bold TKL HE/White-cutout.png。

品牌及产品图片权利归原权利方。实机验证尚未完成，现阶段不宣称全固件、全连接方式覆盖。
