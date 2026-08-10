# MultiRoleGame: 多角色独立对话工作页技术方案

## 1. 愿景与范围

### 1.1 愿景
打造一个独立的「多角色独立对话工作页」Menu Tab，通过游戏化俯视视角（Top-Down）的办公室场景，将枯燥的 AI Agent 协作过程可视化、趣味化。用户（作为“老板”）可以在此创建角色、分配 SKILL、编排工作，并通过右侧对话窗口观察或介入 AI 多角色讨论。

### 1.2 MVP 范围 (Phase 1)
本次阶段的核心目标是搭建场景的“骨架”，实现可视化的基础，具体包括：
*   **俯视 2D 场景**：使用 PixiJS 渲染一个风格统一的办公室场景，基于已生成的素材（地板瓷砖、办公家具、工位等）。
*   **角色管理**：
    *   在右侧面板创建、编辑、删除角色（关联 BMad 角色或自定义 SKILL）。
    *   将角色实例化并放置到场景中的预设工位。
*   **状态气泡 (Status Bubbles)**：在角色头顶动态显示其当前状态（如 `IDLE`, `WORKING`, `THINKING`, `SUCCESS` 等），状态可通过右侧面板手动模拟或由后续逻辑驱动。
*   **基础交互**：支持点击场景中的角色，在右侧面板查看其属性（Name, SKILL, Status）。

### 1.3 暂不包含 (Out of Scope)
*   **真实 AI 对话**：MVP 阶段的角色状态为静态模拟，不接入真实的 LLM 对话流。
*   **复杂动画**：角色的移动、走路、坐下等 Spine 动画将在后续阶段实现。
*   **自动任务派发**：工作流节点到游戏场景任务的自动映射和流转。

---

## 2. 技术选型与方案对比

| 维度 | 最终选择 | 备选方案 | 决策理由 |
|---|---|---|---|
| **渲染引擎** | **PixiJS v8** | React Three Fiber, Phaser | 1. 与 React 集成简单（通过 `@pixi/react`）。<br>2. 2D 俯视视角实现直观，性能极佳。<br>3. 符合 MVP 轻量化诉求。 |
| **UI 集成库** | **@pixi/react** | ReactPixiFiber | 官方/主流的 React Renderer，API 设计现代，社区活跃。 |
| **素材来源** | **AI 生成（已完成）** | OpenGameArt, Kenney | 已生成俯视扁平卡通风素材，视觉自由度高，无版权风险。 |
| **状态管理** | **Zustand** | Redux Toolkit, Jotai | 与现有项目保持一致，轻量且 API 友好。 |
| **坐标系统** | **正交网格 (Orthogonal Grid)** | — | 俯视视角下无需等距投影变换，网格坐标即屏幕像素，逻辑最简。 |

---

## 3. 架构设计

### 3.1 整体架构图
```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        MultiRoleGame Page (React)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────┐   ┌─────────────────────────────┐  │
│  │   Left: Top-Down Scene          │   │   Right: Control Panel     │  │
│  │   (PixiJS Application)          │   │   (Standard React/Antd UI)  │  │
│  │                                 │   │                           │  │
│  │  ┌───────────────────────────┐  │   │  ┌─────────────────────┐  │  │
│  │  │ SceneContainer (Canvas)   │  │   │  │ Role List & Config  │  │  │
│  │  │                           │  │   │  │ - Create/Edit/Delete│  │  │
│  │  │  ┌─────────────────────┐  │  │   │  │ - Assign to Seat   │  │  │
│  │  │  │  Office Tiles      │  │  │   │  └─────────────────────┘  │  │
│  │  │  │  (Floor, Walls)    │  │  │   │                           │  │
│  │  │  └─────────────────────┘  │  │   │  ┌─────────────────────┐  │  │
│  │  │                           │  │   │  │ Chat/Dialog Window│  │  │
│  │  │  ┌─────────────────────┐  │  │   │  │ - Group Chat UI    │  │  │
│  │  │  │ Seats & Characters │  │  │   │  │ - Message Log      │  │  │
│  │  │  │ (With Status Bubbles)│  │  │   │  └─────────────────────┘  │  │
│  │  │  └─────────────────────┘  │  │   │                           │  │
│  │  └───────────────────────────┘  │   │                           │  │
│  └─────────────────────────────────┘   └─────────────────────────────┘  │
│                                                                         │
│              └──────────────┬───────────────┘                           │
│                             │ State & Events Bridge                     │
│                             ▼                                           │
│              ┌──────────────────────────────┐                          │
│              │  MultiRoleGame Store (Zustand) │                          │
│              │  - characters                 │                          │
│              │  - seats                     │                          │
│              │  - chatHistory               │                          │
│              │  - selectedRoleId            │                          │
│              └──────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 核心数据模型

```typescript
// src/stores/multiRoleGame.ts

export interface Character {
  id: string;
  name: string;
  skillDescription: string; // SKILL or BMad Agent description
  status: CharacterStatus;
  currentSeatId: string | null;
  // AI generated 素材 URL
  avatarTextureUrl?: string; 
}

export type CharacterStatus = 
  | 'idle' 
  | 'working' 
  | 'thinking' 
  | 'success' 
  | 'error';

export interface Seat {
  id: string;
  // 逻辑网格坐标 (orthogonal grid，俯视视角下直接映射屏幕像素)
  gridX: number;
  gridY: number;
  // 占用的角色 ID
  occupiedBy: string | null;
}

export interface ChatMessage {
  id: string;
  roleId: string | 'system' | 'user';
  content: string;
  timestamp: number;
}

// Zustand Store State
export interface MultiRoleGameState {
  characters: Character[];
  seats: Seat[];
  chatHistory: ChatMessage[];
  selectedCharacterId: string | null;
  
  // Actions
  createCharacter: (data: Omit<Character, 'id'>) => void;
  updateCharacterStatus: (id: string, status: CharacterStatus) => void;
  assignCharacterToSeat: (characterId: string, seatId: string) => void;
  selectCharacter: (id: string | null) => void;
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
}
```

---

## 4. 核心模块实现拆解

### 4.1 场景渲染层 (PixiJS)
负责所有 2D 图形的绘制和交互。所有素材来自 `assets/` 目录（详见第 6 节）。

*   **`SceneContainer.tsx`**: 顶层 PixiJS 容器，初始化 Application，管理场景生命周期。
*   **`OfficeBackground.tsx`**: 渲染地板层。优先使用 `完整场景分离地板.png`（地板透明版）作为家具层基底，或用 `地形地板.png` 作为模块化地形拼图。
*   **`SeatComponent.tsx`**: 渲染单个工位（桌子 + 椅子精灵，从 `办公套件.png` 切片），监听点击事件用于角色分配。
*   **`CharacterSprite.tsx`**: 渲染角色精灵，加载 `avatarTextureUrl`。这是后续实现 Spine/动画的切入点。
*   **`StatusBubble.tsx`**: 一个容器组件，渲染在角色精灵上方。根据 `status` 属性动态改变背景色和图标（Idle: 灰色，Working: 蓝色动效，Success: 绿色，Error: 红色）。

**坐标映射实现**：
俯视视角下无需等距投影变换，网格坐标直接线性映射为屏幕像素。在 `SceneContainer` 中提供工具函数 `gridToScreen(gridX, gridY)`：
```typescript
const TILE_SIZE = 64; // 单个网格单元的像素尺寸（正方形）

function gridToScreen(gridX: number, gridY: number): { x: number, y: number } {
  return {
    x: gridX * TILE_SIZE,
    y: gridY * TILE_SIZE,
  };
}
```

**精灵切片（Sprite Sheet Slicing）**：
`办公套件.png`（2848×1600）是透明背景的独立物件集合。需在加载后用 `Texture.rectangle` 定义每个物件的 UV 矩形，建立 `ASSET_REGISTRY`（如 `{ desk: {x,y,w,h}, chair: {...}, plant: {...} }`），供 `SeatComponent` 等按 key 取用。建议在 Phase 1 先用整张 `完整场景不分离.png` 作为静态背景跑通流程，再在 Phase 2 切片做动态工位。

### 4.2 控制面板层 (React UI)
负责用户与系统的交互。

*   **`RoleListPanel.tsx`**: 左侧/右侧的角色列表。
    *   使用 Ant Design 的 `List` 组件。
    *   每个列表项显示角色头像、名称、当前状态（用 `Tag` 组件）。
    *   支持拖拽角色卡片到场景中的工位（或通过点击“分配”按钮）。
*   **`RoleConfigModal.tsx`**: 点击“创建/编辑角色”弹出的模态框。
    *   包含名称输入、SKILL 描述编辑（支持从现有 BMad 角色选择或自定义）。
*   **`ChatWindow.tsx`**: 底部或右侧的对话窗口。
    *   显示 `chatHistory` 消息流。
    *   提供输入框和发送按钮。
    *   支持选择对话对象（单聊或多人）。

### 4.3 状态桥接层 (State Bridge)
连接 React UI 和 PixiJS 场景的纽带。

*   所有状态变更通过 Zustand Store Actions 触发。
*   PixiJS 组件（如 `CharacterSprite`）通过 `useStore` Hook 订阅 `characters` 状态。
*   React UI 组件同样订阅 Store。
*   当用户在 UI 中点击“分配角色到工位”时，调用 `assignCharacterToSeat` action，PixiJS 场景中的 `CharacterSprite` 会自动更新其位置。

---

## 5. 实施路线图 (Phased Plan)

### Phase 1: MVP (预计 1-2 周)
*   **Objective**: 跑通渲染流程，实现角色与场景的基本联动。
*   **Tasks**:
    1.  **项目初始化**: `npm install pixi.js @pixi/react`，配置 Vite 对 `assets/` 的静态资源访问。
    2.  **场景搭建**:
        *   实现 `SceneContainer`，先用整张 `完整场景不分离.png` 作为静态背景跑通渲染。
        *   在背景上叠加 3-5 个预设工位坐标（`Seat` 数据，先不渲染家具精灵，仅作为可点击热区）。
    3.  **状态管理**:
        *   创建 `multiRoleGame` Zustand Store。
        *   实现左侧角色列表 UI (`RoleListPanel`)，可创建静态“测试角色”。
    4.  **联动**:
        *   实现将角色“分配”到工位的逻辑。
        *   角色精灵（先用彩色圆形占位）出现在工位上。
    5.  **状态气泡**:
        *   在角色上方显示一个静态气泡，可通过面板按钮模拟改变状态（Idle -> Working -> Success）。

### Phase 2: 视觉打磨与对话集成 (预计 2-3 周)
*   **Objective**: 提升视觉质感，接入真实对话流程。
*   **Tasks**:
    1.  **素材切片与分层**:
        *   对 `办公套件.png` 做精灵切片，建立 `ASSET_REGISTRY`。
        *   用 `完整场景分离地板.png` 替换静态背景，实现「地板层 + 家具层 + 角色层」三层合成（角色可被家具正确遮挡）。
        *   按需用 `地形地板.png` 模块拼出可扩展的办公区域。
    2.  **动画实现**:
        *   为角色添加基础的 Idle 动画（如轻微呼吸效果）。
        *   实现角色移动的缓动动画（Tweening）。
        *   丰富状态气泡的动画效果（如 Working 时的加载圈）。
    3.  **Chat 集成**:
        *   完善 `ChatWindow` 组件。
        *   实现“老板”与单个角色的单聊。
        *   实现“群聊”模式，支持用户输入指令，多个角色 AI 轮流回复。
    4.  **交互优化**:
        *   点击场景中的角色，UI 面板自动选中并高亮显示。
        *   拖放（Drag & Drop）分配角色。

### Phase 3: 业务融合与高级特性 (长期)
*   **Objective**: 实现游戏场景与现有 Workflow 引擎的深度融合。
*   **Tasks**:
    1.  **任务自动流转**:
        *   将主流程图中的节点执行状态（RUNNING, SUCCESS）映射到游戏场景中。
        *   当某个 BMad 角色节点开始执行时，游戏场景中对应角色自动变为 `working` 状态。
    2.  **复杂 AI 交互**:
        *   实现 AI Agent 之间的“私聊”或“讨论”，无需用户介入。
        *   增加角色的自主行为（如思考时踱步）。
    3.  **全局状态可视化**:
        *   在场景中增加“任务进度条”或“时间线”UI 元素。
        *   实现完整的模拟经营 Dashboard。

---

## 6. 素材清单（已生成）

素材已通过 AI 生成并存放于 [assets/](file:///Users/lizhi/Desktop/work/workflow/ai-workflow/assets) 目录，均为 **俯视 top-down 扁平卡通风**，单张尺寸 2848×1600。

| 文件 | 用途 | 说明 |
|---|---|---|
| [完整场景不分离.png](file:///Users/lizhi/Desktop/work/workflow/ai-workflow/assets/完整场景不分离.png) | MVP 静态背景 | 完整办公场景（地板 + 家具合成为一张图），含桌椅/盆栽/文件柜/打印机/沙发/隔断/窗户/空调/饮水机，浅灰网格地砖。Phase 1 直接整张铺底。 |
| [完整场景分离地板.png](file:///Users/lizhi/Desktop/work/workflow/ai-workflow/assets/完整场景分离地板.png) | Phase 2 分层合成 | 与上图相同的家具布局，但地板区域透明，便于在地板层与家具层之间插入角色层，实现正确遮挡。 |
| [办公套件.png](file:///Users/lizhi/Desktop/work/workflow/ai-workflow/assets/办公套件.png) | 精灵切片源 | 透明背景的独立物件集合（桌椅组合/植物/办公设备/前台/角色等），Phase 2 切片为单个 Sprite 供动态工位使用。 |
| [地形地板.png](file:///Users/lizhi/Desktop/work/workflow/ai-workflow/assets/地形地板.png) | 可扩展地形模块 | 低多边形块状立体风（带阴影），含瓷砖/台阶/平台/墙面基座模块，用于后续拼出可扩展办公区域。注意：风格略异于扁平卡通场景，接入前需评估统一性。 |

**风格统一性说明**：
`完整场景*` 与 `办公套件.png` 为同一套扁平卡通风，可无缝配合；`地形地板.png` 为低多边形块状风，作为可扩展地形时需确认两者混排的视觉协调，否则仅在独立区域使用。

**角色精灵缺口**：
当前素材含静态角色贴图，但缺少多状态动画帧（Idle/Working/Thinking）。Phase 2 接入动画前需补充角色 Sprite Sheet（每个状态至少 2-4 帧循环），或改用程序化动效（缩放/位移/Tint）模拟。

---

## 7. 风险评估与应对

| 风险点 | 等级 | 应对方案 |
|---|---|---|
| **React 与 PixiJS 通信性能** | 🟢 Low | `@pixi/react` 通过自定义 Reconciler 处理，理论性能优秀。MVP 阶段需测试 50+ 精灵同屏时的帧率。 |
| **精灵切片工作量** | 🟡 Medium | `办公套件.png` 物件多，需逐个标定 UV 矩形。建议先只切 MVP 所需的「桌椅组合」一类，其余按需补充；可写一个可视化切片工具辅助。 |
| **地形地板风格不一致** | 🟡 Medium | `地形地板.png` 与主场景风格不同。若混排不协调，仅在「扩展区/走廊」使用，主办公区坚持用 `完整场景*` 系列。 |
| **角色动画帧缺失** | 🟡 Medium | Phase 2 前需补齐角色 Sprite Sheet，或降级为程序化动效（缩放呼吸 + Tint 状态色），避免阻塞对话集成。 |
| **项目周期** | 🟢 Low | 素材已就绪，省去最大不确定性。Phase 1 用整张背景跑通，风险可控。 |
