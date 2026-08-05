# tasks.md

> 占位。分批次任务清单（Batch / T-*）产物将写入此文件。

## 任务拆解节点

## Batch 1 · 各端基础配置、Schema与工具方法定义
- [ ] T-01 更新Groot黑叶点亮组件配置Schema，新增占领者相关字段
    - 文件：groot/src/components/light/schema/blackLeafLight.schema.ts
    - 前置：无
    - 验收：1. Schema中新增statRange字段，枚举值1=普通/2=全局，默认值1；2. 新增lightDimension字段，枚举值1=个人/2=CP赛/3=多人赛，默认值1，配置为仅statRange=2时生效；3. 新增previewMockEnabled布尔字段，默认值false；4. lightPointConfigs数组元素下新增occupierConfig嵌套结构，包含showOccupier（布尔，默认true）、style（枚举'small'/'large'，默认'large'）、scale（数值，默认值对齐Figma UI规范）、width（数值，默认昵称宽度对齐Figma）、top（数值，默认距上值对齐Figma）、left（数值，默认距左值对齐Figma）、nicknameColor（字符串，默认色值对齐Figma）；5. 原有普通模式下的所有Schema字段、默认值、校验规则保持不变，无删除或修改。
- [ ] T-02 更新BMS任务条件字段常量，新增名次筛选配置项
    - 文件：bms/src/constants/taskConditionFields.ts
    - 前置：无
    - 验收：1. 新增startRank、endRank两个可选字段定义，字段类型为正整数；2. 两个字段配置为默认收起在九宫格筛选列表，需勾选后展示输入框；3. 字段tooltip配置：startRank提示文案为“开始名次≤x”，endRank提示文案为“x≤结束名次”；4. 原有任务条件字段定义、配置保持不变，无破坏性变更。
- [ ] T-03 H5侧补充个人主页跳转导航工具方法
    - 文件：h5/src/utils/navigation.ts
    - 前置：无
    - 验收：1. 新增navigateToUserProfile方法，接收userId为必填参数；2. 方法跳转逻辑与现有用户个人主页跳转规则完全一致，路由路径、参数传递符合现有规范；3. 文件内原有导航方法、导出项保持不变，无逻辑修改。

## Batch 2 · 纯逻辑层校验规则实现
- [ ] T-04 实现BMS任务条件名次字段全链路校验逻辑
    - 文件：bms/src/pages/task-manage/validators/taskCondition.validator.ts
    - 前置：T-02
    - 验收：1. 校验逻辑严格按优先级执行：P0（名次字段均为空时直接返回校验通过）→P1（非空时校验值为正整数且startRank≤endRank，不满足返回提示“开始名次m与结束名次n，必须是正整数且m≤n”）→P2（任务未启用/不在生效期时直接返回校验通过）→P3（生效期内对比历史值，不一致返回提示“开始名次m&结束名次n，在任务生效期间不支持修改”）；2. 联动校验：配置名次且维度为CP赛时，校验用户限制已选“cp赛报名成功用户”并关联有效CP赛程；配置名次且维度为多人赛时，校验用户限制已选“多人赛报名成功用户”并关联有效多人赛程，不满足返回对应错误提示；3. 原有任务条件校验逻辑、错误提示保持不变，无回归。

## Batch 3 · Groot配置面板表单与预览交互实现
- [ ] T-05 改造Groot黑叶点亮配置面板，新增统计范围与全局配置表单
    - 文件：groot/src/components/light/BlackLeafLightConfig.vue
    - 前置：T-01
    - 验收：1. 新增「统计范围」单选组件，选项为“普通”“全局（全站第一个获得积分者占领）”，默认选中“普通”，双向绑定statRange字段；2. statRange=普通时隐藏所有全局配置项，原有普通模式配置项、交互与改动前完全一致；3. statRange=全局时展示「点亮维度」单选（选项个人/CP赛/多人赛，默认个人，双向绑定lightDimension），选CP赛时提示“获得点亮积分任务的用户限制需关联CP赛赛程”，选多人赛时提示“获得点亮积分任务的用户限制需关联多人赛赛程”；4. 新增「预览已点亮状态（mock数据）」开关，默认关闭，双向绑定previewMockEnabled字段；5. statRange=全局时每个点亮项新增「占领者配置」模块，包含是否显示占领者开关、样式选择、缩放/昵称宽度/距上/距左数值输入框、昵称颜色取色器，分别绑定occupierConfig对应字段；6. 所有配置项修改实时同步到Schema，原有保存逻辑自动携带新增字段提交，无破坏。
- [ ] T-06 实现Groot占领者配置预览组件基础渲染能力
    - 文件：groot/src/components/light/preview/OccupierPreview.vue
    - 前置：T-01
    - 验收：1. 组件接收lightPointConfig、previewMockEnabled两个props；2. previewMockEnabled=false（未点亮）时，渲染问号占位头像+「虚位以待」文案，透明度、图标资源对齐Figma规范，文案颜色绑定nicknameColor配置；3. previewMockEnabled=true时，渲染mock占领者信息（默认占位头像、固定mock昵称），按occupierConfig的style、scale、width、top、left、nicknameColor渲染样式；4. 占领者元素z-index高于同容器点亮积分图标；5. showOccupier=false时不渲染占领者元素。
- [ ] T-07 实现Groot预览区占领者拖拽交互与边界限制
    - 文件：groot/src/components/light/preview/OccupierPreview.vue
    - 前置：T-06
    - 验收：1. 占领者元素支持鼠标拖拽调整位置，拖拽过程实时更新top、left配置值，同步表单数值输入框显示；2. 拖拽范围严格限制在点亮图标四周固定可移动区域（边界值对齐Figma），元素不可拖出区域；3. 手动输入top/left值超出范围时，自动修正到最近边界值；4. 拖拽过程无卡顿，元素位置与配置值实时一致。

## Batch 4 · BMS任务条件表单UI与提交联动实现
- [ ] T-08 改造BMS任务条件配置表单，新增名次字段与联动逻辑
    - 文件：bms/src/pages/task-manage/components/TaskConditionForm.vue
    - 前置：T-02、T-04
    - 验收：1. 九宫格筛选列表新增「开始名次」「结束名次」可选项，默认未勾选、不展示输入框；2. 勾选字段后展示正整数输入框，悬浮时展示对应tooltip文案（与常量配置一致）；3. 点击保存时调用T04实现的校验逻辑，校验不通过阻断保存并弹出对应toast；4. 页面初始化时调用fetchTaskConditionDetail接口拉取历史配置，回填startRank、endRank值；5. 名次区间非空时，任务完成逻辑自动调整为“仅允许第m~n名主体完成1次”，忽略重复次数配置；6. 原有表单项、交互、提交、回填逻辑保持不变，无回归。

## Batch 5 · H5活动端占领者组件与渲染逻辑实现
- [ ] T-09 实现H5占领者展示基础组件，支持多维度渲染与交互
    - 文件：h5/src/components/activity/light/OccupierDisplay.vue
    - 前置：T-03
    - 验收：1. 组件接收occupierConfig、lightDimension、occupierData（允许为空）三个props；2. occupierData为空（未占领）时，渲染问号占位头像+「虚位以待」文案，透明度对齐UI规范，文案颜色取nicknameColor配置；3. occupierData存在时按维度渲染：个人维度展示单用户头像+昵称，CP维度展示双方头像+CP昵称，多人维度展示所有队员头像+队伍昵称；4. 样式严格按occupierConfig渲染（大小、缩放、宽度、偏移、颜色），元素z-index高于同级点亮图标；5. 点击用户头像调用navigateToUserProfile方法跳转对应用户主页；6. showOccupier=false时不渲染组件。
- [ ] T-10 改造H5黑叶点亮渲染器，新增全局模式分支与接口拉取逻辑
    - 文件：h5/src/components/activity/light/BlackLeafLightRenderer.vue
    - 前置：T-09
    - 验收：1. 读取statRange配置，值为1（普通）时完全复用原有个人点亮逻辑，无任何改动；2. 值为2（全局）时，在组件初始化、进入视口、任务完成触发刷新三个时机调用fetchGlobalLightOccupiers接口，传入activityId、componentId、当前页lightPointIds、lightDimension参数；3. 接口返回后将对应占领者数据传入OccupierDisplay组件渲染；4. 全局模式下点亮次数组件按原有运营配置显隐，无特殊修改；5. 接口请求失败时降级展示未占领占位状态，不影响点亮图标本身渲染交互；6. 原有普通模式的渲染、交互、埋点逻辑保持不变，无回归。

## Batch 6 · 单元测试覆盖与回归验证
- [ ] T-11 Groot侧改动点单元测试覆盖与回归验证
    - 文件：groot/src/components/light/schema/__tests__/blackLeafLight.schema.spec.ts、groot/src/components/light/__tests__/BlackLeafLightConfig.spec.ts、groot/src/components/light/preview/__tests__/OccupierPreview.spec.ts
    - 前置：T-05、T-06、T-07
    - 验收：1. 覆盖Schema新增字段默认值、类型校验测试用例；2. 覆盖配置面板显隐逻辑、提示文案、字段绑定测试用例；3. 覆盖预览组件渲染逻辑、样式绑定、z-index配置测试用例；4. 覆盖拖拽交互范围限制、数值同步测试用例；5. 原有普通模式配置逻辑的所有存量测试用例100%通过，无回归；6. 新增用例100%通过。
- [ ] T-12 BMS侧改动点单元测试覆盖与回归验证
    - 文件：bms/src/constants/__tests__/taskConditionFields.spec.ts、bms/src/pages/task-manage/validators/__tests__/taskCondition.validator.spec.ts、bms/src/pages/task-manage/components/__tests__/TaskConditionForm.spec.ts
    - 前置：T-08
    - 验收：1. 覆盖名次字段配置、tooltip文案测试用例；2. 覆盖校验逻辑全部分支（空值规则、正整数校验、生效期修改限制、维度联动校验）测试用例；3. 覆盖表单字段显隐、提交校验、历史回填、名次联动逻辑测试用例；4. 原有任务条件配置的所有存量测试用例100%通过，无回归；5. 新增用例100%通过。
- [ ] T-13 H5侧改动点单元测试覆盖与回归验证
    - 文件：h5/src/utils/__tests__/navigation.spec.ts、h5/src/components/activity/light/__tests__/OccupierDisplay.spec.ts、h5/src/components/activity/light/__tests__/BlackLeafLightRenderer.spec.ts
    - 前置：T-09、T-10
    - 验收：1. 覆盖个人主页跳转方法的参数校验、跳转逻辑测试用例；2. 覆盖占领者组件多维度渲染、占位态、样式绑定、点击交互测试用例；3. 覆盖渲染器分支逻辑、接口调用时机、数据传递、降级逻辑、点亮次数显隐测试用例；4. 原有普通点亮组件的所有存量测试用例100%通过，无回归；5. 新增用例100%通过。
