# tasks.md

> 占位。分批次任务清单（Batch / T-*）产物将写入此文件。

## 任务拆解节点

## Batch 1 · 互斥校验对齐与操作拦截（需求4补强）
- [ ] T-01 梳理并确认互斥玩法状态字段来源，定义互斥条目常量
    - 文件：src/renderer/modules/LiveModule/submodules/RoundSingModule/services/action.ts、src/renderer/store/appSlice.ts
    - 前置：无
    - 验收：在 action.ts 中新增类型化互斥条目常量，完整覆盖以下玩法并标注状态字段来源：已开启轮唱PK、跨厅PK、魔法团战、全麦PK、黑叶投票、1V1通话、KTV合唱、PP小游戏、蒙面、投屏、心动时刻、甩地雷、抢皇冠；其中心动时刻/甩地雷/抢皇冠的字段名经全局搜索确认存在于实际状态模块。
- [ ] T-02 openRoundSing 接入 checkGameCanStart 复用
    - 文件：src/renderer/modules/LiveModule/submodules/RoundSingModule/services/action.ts、src/renderer/modules/PPModule/shared/checkGameCanStart.ts
    - 前置：T-01
    - 验收：openRoundSing 在发起前调用 checkGameCanStart，返回不可开始时中止发起流程并 Toast 提示；原有已开启轮唱PK/跨厅PK/魔法团战/全麦PK/黑叶投票的拦截结果保持不变。
- [ ] T-03 openRoundSing 接入 KTV 合唱拦截
    - 文件：src/renderer/modules/LiveModule/submodules/RoundSingModule/services/action.ts
    - 前置：T-02
    - 验收：KTV 合唱进行中调用 openRoundSing 时，调用已存在能力 showKtvSingToast() 并中止发起，不发起 /singLoop/start 请求。
- [ ] T-04 openRoundSing 接入 1V1 通话状态拦截
    - 文件：src/renderer/modules/LiveModule/submodules/RoundSingModule/services/action.ts
    - 前置：T-03
    - 验收：app.doreBusinessType === DoreBusinessType.OneVsOne 时，openRoundSing 中止发起并 Toast 提示。
- [ ] T-05 openRoundSing 接入心动时刻/甩地雷/抢皇冠拦截
    - 文件：src/renderer/modules/LiveModule/submodules/RoundSingModule/services/action.ts
    - 前置：T-03
    - 验收：心动时刻、甩地雷、抢皇冠任一玩法状态活跃时（按 T-01 确认字段判断），openRoundSing 中止发起并 Toast 提示。
- [ ] T-06 演唱中下麦/抱下麦/最小化操作拦截
    - 文件：src/renderer/modules/LiveModule/services/actions.ts、src/renderer/modules/LiveModule/submodules/SeatModule/
    - 前置：T-05
    - 验收：轮唱PK演唱中（isMeSinging）或作为发起者（isMeRoundSingInitiator）时，下麦/抱下麦/最小化操作被前端拦截并 Toast 提示；若后端已兜底，则前端以注释明确不重复拦截并说明依据。

## Batch 2 · 权限口径对齐（需求1）
- [ ] T-07 新增按房间类型/身份判定入口可见性的 selector
    - 文件：src/renderer/modules/LiveModule/submodules/RoundSingModule/services/store.ts
    - 前置：产品确认：按"点唱厅/官方厅白名单/签约主播/麦上用户"差异化显隐
    - 验收：新增 selectCanShowRoundSingEntry，组合判断房间类型（selectIsAmusementSingRoom、getLiveRoomType）、后端身份字段、现有权限 key；未配置差异化条件时返回值与 selectHasRoundSingPermission 一致，不改变现有入口行为。
- [ ] T-08 LiveTool 轮唱PK工具项改用新 selector 控制显隐
    - 文件：src/renderer/modules/LiveModule/submodules/LiveToolModule/hooks/useLiveTool.tsx
    - 前置：T-07
    - 验收：useLiveTool 中轮唱PK工具项可见性由 selectCanShowRoundSingEntry 决定；不符合房间/身份条件时工具项不展示，现有权限过滤（hasAnyPermission）仍生效。

## Batch 3 · 多入口外显扩展（需求1，需产品确认点位）
- [ ] T-09 公屏游戏卡片渲染分支
    - 文件：src/renderer/modules/LiveModule/submodules/PublicScreenModule/views/index.tsx
    - 前置：T-05；产品确认：公屏游戏卡片入口为硬性需求
    - 验收：公屏消息命中轮唱PK玩法时渲染对应卡片样式，卡片右下角图标为 assets/images/sing_loop/entry.png；非轮唱PK消息渲染行为不变。
- [ ] T-10 点歌台音乐玩法 TAB
    - 文件：src/renderer/modules/LiveModule/submodules/SingModule/views/SingPanel/SingPanelContent.tsx
    - 前置：T-05；产品确认：点歌台 TAB 入口为硬性需求
    - 验收：新增音乐玩法 TAB 默认排序第二位，支持图片、名称、描述文案；点击 TAB 展示轮唱PK入口并复用 openRoundSing 发起校验。
- [ ] T-11 键盘面板/输入栏玩法 TAB
    - 文件：src/renderer/modules/LiveModule/submodules/PublicScreenModule/views/FooterContainer.tsx
    - 前置：T-05；产品确认：键盘面板 TAB 入口为硬性需求
    - 验收：新增玩法 TAB 控件并支持图片+名称；上新红点按设备本地存储统计点击次数（参照 useLiveTool 中 newFlag + localStorage 模式）。
- [ ] T-12 房间信息流横版轮唱PK样式
    - 文件：src/renderer/modules/LiveModule/submodules/RoomFlowInfoModule/views/
    - 前置：T-05；产品确认：房间信息流入口为硬性需求
    - 验收：房间信息流中轮唱PK横幅展示最多5位麦上用户头像，复用轮唱PK麦位数据源；非轮唱信息流样式不变。

## Batch 4 · 演唱环节增强（需求3补充）
- [ ] T-13 新增"为Ta打Call"快捷送礼按钮
    - 文件：src/renderer/modules/LiveModule/submodules/RoundSingModule/views/Header/PhaseSinging.tsx、src/renderer/modules/LiveModule/submodules/RoundSingModule/components/
    - 前置：产品确认：快捷送礼为硬性需求
    - 验收：PhaseSinging 中 PopularityScore 同侧渲染文案为"为Ta打Call"的送礼按钮，点击调起现有送礼能力并发送默认礼物，发送成功后按钮状态更新。
- [ ] T-14 抢唱/应战按钮防抖
    - 文件：src/renderer/modules/LiveModule/submodules/RoundSingModule/components/ActionButton/index.tsx、src/renderer/modules/LiveModule/submodules/RoundSingModule/hooks/useSingLoopBusiness.ts
    - 前置：无
    - 验收：快速连续点击抢唱/应战按钮只触发一次请求；grab/respond 的 loading 标志为 true 期间按钮不响应重复点击。

## Batch 5 · 麦位场景收敛（需求2）
- [ ] T-15 轮唱场景声浪兜底
    - 文件：src/renderer/modules/LiveModule/submodules/SeatModule/components/UserSeat/index.tsx
    - 前置：无
    - 验收：轮唱PK进行中（isRoundSingActive）且麦位用户未佩戴声浪装扮（materialUrl 为空/缺失）时，声纹动画使用点唱房默认声浪素材；非轮唱场景行为不变。
- [ ] T-16 轮唱期间隐藏密友连线/离开中标签
    - 文件：src/renderer/modules/LiveModule/submodules/SeatModule/components/UserSeat/index.tsx（含 UserSeatStatus 相关子文件）
    - 前置：T-15
    - 验收：轮唱PK进行中（isRoundSingActive）时，密友连线组件与"离开中"标签不渲染；非轮唱场景保持原状。

## Batch 6 · 存量逻辑回归验证（需求2/3）
- [ ] T-17 验证轮唱布局下送礼弹道偏移
    - 文件：src/renderer/modules/LiveModule/submodules/GiftEffectModule/views/index.tsx、src/renderer/modules/LiveModule/submodules/SeatModule/views/index.tsx
    - 前置：T-16
    - 验收：轮唱PK布局下点击送礼，弹道条 top 计算（middleTopContainerSize.height - ContainerTop + 48）结果正确，无偏移/遮挡；普通直播布局回归无变化。
- [ ] T-18 验证轮唱布局下进场横幅偏移
    - 文件：src/renderer/modules/LiveModule/views/index.tsx、src/renderer/modules/LiveModule/submodules/RoundSingModule/views/RoundSingPanel.tsx
    - 前置：T-16
    - 验收：轮唱PK进行中 BroadcastModule 下移 top-[200px]，进场横幅不遮挡评委席区域；轮唱结束时恢复原位置。
- [ ] T-19 验证音高线渲染性能
    - 文件：src/renderer/modules/LiveModule/submodules/RoundSingModule/components/PitchLine/index.tsx
    - 前置：T-16
    - 验收：弱机型上演唱环节音高线 Canvas 渲染无明显卡顿，HISTORY_LIMIT=500 下 rAF 帧率保持稳定，并记录性能基线数据。
- [ ] T-20 验证弱网资源未就绪与多端互顶
    - 文件：src/renderer/modules/LiveModule/submodules/RoundSingModule/hooks/useSingLoopPlayer.ts、src/renderer/modules/LiveModule/submodules/RoundSingModule/hooks/useResourceDownload.ts、src/renderer/modules/LiveModule/submodules/RoundSingModule/hooks/useSingLoopPush.ts
    - 前置：T-16
    - 验收：模拟资源未就绪、应战超时、多端同时开启轮唱等场景，行为符合"不播放不阻塞、服务端超时兜底进评分、多端 finalize 互顶"。
