# Taro + HarmonyOS 跨端实施蓝图

## 1. 目标与边界

本文档在上一版总体方案基础上，进一步细化为三部分：

1. `Taro + HarmonyOS` 的项目目录方案
2. 跨端统一接口协议表
3. 核心页面原型结构图

设计目标：

- 以 `Taro` 承载微信小程序主代码
- 以 `HarmonyOS NEXT + ArkTS + ArkUI` 承载鸿蒙原生壳
- 通过 `共享业务内核 + 适配层 + 平台壳` 实现高复用
- 业务规则、协议模型、接口约定尽量统一
- UI 视觉一致，但不强求两端组件实现完全相同

不建议的做法：

- 直接把小程序 UI 逐像素搬到鸿蒙
- 在业务页面内写平台 `if/else`
- 让登录、支付、分享等能力散落在页面逻辑中

---

## 2. 推荐工程结构

## 2.1 Monorepo 顶层目录

```text
cross-platform-app/
├── apps/
│   ├── weapp/                           # 微信小程序主应用（Taro）
│   ├── harmony/                         # HarmonyOS 原生应用（ArkTS）
│   └── admin-web/                       # 可选：运营后台 / 配置台
├── packages/
│   ├── core-types/                      # 统一 DTO / 枚举 / 错误码 / 协议模型
│   ├── core-domain/                     # 领域实体 / 用例 / 规则
│   ├── core-store/                      # 统一状态模型与 selector
│   ├── core-network/                    # 请求封装 / 拦截器 / 重试 / 签名
│   ├── core-auth/                       # 登录态、Token、账户绑定模型
│   ├── core-payment/                    # 支付单、支付状态、支付回调协议
│   ├── core-share/                      # 分享素材、落地页、链路标识
│   ├── core-analytics/                  # 埋点事件模型
│   ├── bridge/                          # 平台能力适配抽象层
│   ├── ui-tokens/                       # 设计 Token：颜色、字号、间距、圆角
│   ├── ui-schema/                       # 页面骨架、组件元信息、表单 schema
│   ├── feature-home/                    # 首页模块
│   ├── feature-account/                 # 账户模块
│   ├── feature-order/                   # 订单模块
│   ├── feature-payment/                 # 支付模块
│   ├── feature-member/                  # 会员模块
│   ├── feature-message/                 # 消息通知模块
│   ├── feature-device/                  # 设备/跨设备模块
│   └── utils/                           # 通用工具
├── services/
│   ├── bff/                             # 平台聚合服务
│   ├── user-service/
│   ├── order-service/
│   ├── payment-service/
│   └── message-service/
├── docs/
│   ├── 架构设计.md
│   ├── API协议.md
│   ├── 页面原型.md
│   └── 测试矩阵.md
├── scripts/
│   ├── build-weapp.*
│   ├── build-harmony.*
│   └── release.*
├── .changeset/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

---

## 2.2 微信小程序应用目录（`apps/weapp`）

```text
apps/weapp/
├── config/
│   ├── dev.ts
│   ├── test.ts
│   └── prod.ts
├── src/
│   ├── app.config.ts
│   ├── app.tsx
│   ├── app.scss
│   ├── pages/
│   │   ├── home/
│   │   │   ├── index.config.ts
│   │   │   ├── index.tsx
│   │   │   ├── index.scss
│   │   │   └── components/
│   │   ├── account/
│   │   ├── login/
│   │   ├── product/
│   │   ├── order/
│   │   ├── checkout/
│   │   ├── payment-result/
│   │   ├── message/
│   │   └── settings/
│   ├── components/
│   │   ├── common/
│   │   ├── form/
│   │   ├── business/
│   │   └── layout/
│   ├── adapters/
│   │   ├── auth.weapp.ts
│   │   ├── payment.weapp.ts
│   │   ├── share.weapp.ts
│   │   ├── storage.weapp.ts
│   │   ├── location.weapp.ts
│   │   └── device.weapp.ts
│   ├── bootstrap/
│   │   ├── register-bridge.ts
│   │   ├── register-store.ts
│   │   └── register-router.ts
│   ├── theme/
│   ├── assets/
│   └── typings/
├── project.config.json
├── package.json
└── tsconfig.json
```

说明：

- `pages` 负责页面路由与容器
- `components/business` 负责小程序端展示组件
- `adapters/*.weapp.ts` 负责把统一桥接接口接到微信 API
- `feature-*` 包中的业务逻辑通过 `src/pages` 注入使用

---

## 2.3 鸿蒙应用目录（`apps/harmony`）

```text
apps/harmony/
├── AppScope/
├── entry/
│   ├── src/main/
│   │   ├── ets/
│   │   │   ├── entryability/
│   │   │   │   └── EntryAbility.ets
│   │   │   ├── pages/
│   │   │   │   ├── HomePage.ets
│   │   │   │   ├── LoginPage.ets
│   │   │   │   ├── ProductPage.ets
│   │   │   │   ├── OrderPage.ets
│   │   │   │   ├── CheckoutPage.ets
│   │   │   │   ├── PaymentResultPage.ets
│   │   │   │   ├── MessagePage.ets
│   │   │   │   └── SettingsPage.ets
│   │   │   ├── components/
│   │   │   │   ├── common/
│   │   │   │   ├── layout/
│   │   │   │   └── business/
│   │   │   ├── adapters/
│   │   │   │   ├── AuthAdapter.ets
│   │   │   │   ├── PaymentAdapter.ets
│   │   │   │   ├── ShareAdapter.ets
│   │   │   │   ├── StorageAdapter.ets
│   │   │   │   ├── DeviceAdapter.ets
│   │   │   │   └── DistributedAdapter.ets
│   │   │   ├── viewmodel/
│   │   │   ├── theme/
│   │   │   ├── constants/
│   │   │   └── utils/
│   │   ├── resources/
│   │   └── module.json5
├── common/
│   └── src/main/ets/
├── build-profile.json5
└── hvigorfile.ts
```

说明：

- 鸿蒙端 UI 必须使用 ArkUI 原生组件实现
- 与微信小程序共享的不是“页面源码”，而是：
  - 领域模型
  - 用例逻辑
  - 接口协议
  - 状态流转规则
  - 埋点模型
- `adapters/*.ets` 负责 ArkTS 与 HarmonyOS Kit 对接

---

## 2.4 `packages` 共享层推荐细化

### `packages/core-types`

```text
core-types/
├── src/
│   ├── dto/
│   │   ├── auth.ts
│   │   ├── payment.ts
│   │   ├── order.ts
│   │   ├── user.ts
│   │   └── share.ts
│   ├── enums/
│   ├── errors/
│   ├── constants/
│   └── index.ts
```

职责：

- 所有跨端对象结构定义唯一出口
- 保证微信端 / 鸿蒙端 / 服务端协议统一

### `packages/bridge`

```text
bridge/
├── src/
│   ├── contracts/
│   │   ├── auth.ts
│   │   ├── payment.ts
│   │   ├── share.ts
│   │   ├── storage.ts
│   │   ├── location.ts
│   │   └── device.ts
│   ├── registry/
│   │   └── index.ts
│   ├── policy/
│   │   ├── capability.ts
│   │   └── downgrade.ts
│   └── index.ts
```

职责：

- 定义平台能力接口
- 提供统一注册与能力发现机制
- 提供降级与兜底规则

### `packages/feature-order`

```text
feature-order/
├── src/
│   ├── usecases/
│   │   ├── create-order.ts
│   │   ├── query-order.ts
│   │   └── cancel-order.ts
│   ├── selectors/
│   ├── validators/
│   ├── mappers/
│   └── index.ts
```

职责：

- 不感知平台
- 只面向统一 repository / bridge contract

---

## 3. 运行时装配方案

## 3.1 启动装配流程

```text
App Launch
  -> 初始化环境变量
  -> 注册平台 Adapter
  -> 初始化 Store
  -> 恢复登录态
  -> 拉取远程配置
  -> 加载首页数据
  -> 进入页面路由
```

## 3.2 平台注入模式

统一桥接接口示意：

```ts
interface PlatformBridge {
  auth: AuthAdapter
  payment: PaymentAdapter
  share: ShareAdapter
  storage: StorageAdapter
  location: LocationAdapter
  device: DeviceAdapter
  analytics: AnalyticsAdapter
}
```

微信端注册：

```text
registerBridge({
  auth: WeappAuthAdapter,
  payment: WeappPaymentAdapter,
  share: WeappShareAdapter,
  ...
})
```

鸿蒙端注册：

```text
registerBridge({
  auth: HarmonyAuthAdapter,
  payment: HarmonyPaymentAdapter,
  share: HarmonyShareAdapter,
  distributed: HarmonyDistributedAdapter,
  ...
})
```

---

## 4. 跨端统一接口协议表

以下协议表分为：

1. 账户鉴权协议
2. 支付协议
3. 分享协议
4. 设备能力协议
5. 页面数据协议

---

## 4.1 账户鉴权协议

### `AuthLoginRequest`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `platform` | `weapp \| harmony` | 是 | 平台标识 |
| `loginType` | `wechat \| huawei \| phone \| guest` | 是 | 登录方式 |
| `code` | `string` | 否 | 微信/华为授权 code |
| `encryptedData` | `string` | 否 | 微信用户敏感数据 |
| `iv` | `string` | 否 | 微信解密参数 |
| `deviceId` | `string` | 否 | 设备标识 |
| `channel` | `string` | 否 | 渠道来源 |

### `AuthLoginResponse`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `accessToken` | `string` | 访问令牌 |
| `refreshToken` | `string` | 刷新令牌 |
| `expiresAt` | `number` | 过期时间戳 |
| `user` | `UserProfile` | 用户资料 |
| `bindInfo` | `BindInfo[]` | 平台账户绑定信息 |
| `newUser` | `boolean` | 是否新用户 |

### `UserProfile`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `userId` | `string` | 统一用户 ID |
| `nickname` | `string` | 昵称 |
| `avatar` | `string` | 头像 |
| `mobile` | `string` | 手机号 |
| `memberLevel` | `string` | 会员等级 |
| `status` | `normal \| disabled` | 状态 |

适配说明：

- 微信：`wx.login` 获取 `code`，服务端换取 `openid/unionid`
- 鸿蒙：通过华为账号或手机号登录，服务端绑定 `harmonyUid`
- 统一以 `userId` 作为业务主身份

---

## 4.2 支付协议

### `CreatePayOrderRequest`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `bizOrderNo` | `string` | 是 | 业务订单号 |
| `platform` | `weapp \| harmony` | 是 | 支付端平台 |
| `payChannel` | `wechatpay \| hms_iap \| wallet \| alipay` | 是 | 支付通道 |
| `amount` | `number` | 是 | 金额，单位分 |
| `subject` | `string` | 是 | 支付标题 |
| `attach` | `Record<string,string>` | 否 | 扩展字段 |

### `CreatePayOrderResponse`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `payOrderNo` | `string` | 支付单号 |
| `payChannel` | `string` | 支付通道 |
| `payParams` | `PayParams` | 平台唤起参数 |
| `expireTime` | `number` | 失效时间 |

### `PayParams`

| 字段 | 类型 | 微信 | 鸿蒙 |
| --- | --- | --- | --- |
| `timeStamp` | `string` | 是 | 否 |
| `nonceStr` | `string` | 是 | 否 |
| `packageValue` | `string` | 是 | 否 |
| `signType` | `string` | 是 | 否 |
| `paySign` | `string` | 是 | 否 |
| `productId` | `string` | 否 | 是 |
| `purchaseToken` | `string` | 否 | 是 |
| `sdkPayload` | `string` | 否 | 是 |

### `PayResult`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `payOrderNo` | `string` | 支付单号 |
| `bizOrderNo` | `string` | 业务订单号 |
| `status` | `success \| failed \| cancel \| pending` | 支付状态 |
| `channelTradeNo` | `string` | 渠道交易号 |
| `message` | `string` | 错误信息 |

适配原则：

- 页面只认 `CreatePayOrderResponse` 和 `PayResult`
- 微信端走 `wx.requestPayment`
- 鸿蒙端走 `IAP/钱包/第三方 SDK`
- 最终支付成功以服务端异步通知为准

---

## 4.3 分享协议

### `ShareContent`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `shareId` | `string` | 是 | 分享链路 ID |
| `type` | `link \| image \| poster \| mini_card` | 是 | 分享类型 |
| `title` | `string` | 是 | 标题 |
| `summary` | `string` | 否 | 摘要 |
| `imageUrl` | `string` | 否 | 封面 |
| `path` | `string` | 否 | 小程序页面路径 |
| `url` | `string` | 否 | H5/落地页链接 |
| `extra` | `Record<string,string>` | 否 | 扩展字段 |

### `ShareResult`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `shareId` | `string` | 分享 ID |
| `status` | `success \| cancel \| fail` | 分享状态 |
| `channel` | `session \| timeline \| system` | 分享渠道 |

适配说明：

- 微信：
  - 会话分享：`onShareAppMessage`
  - 朋友圈：`onShareTimeline`
- 鸿蒙：
  - 系统分享
  - 服务卡片 / 原子化服务入口

降级策略：

- 若平台不支持目标分享类型，则回退到：
  - 图片海报
  - 落地页链接
  - 复制口令

---

## 4.4 设备与环境协议

### `DeviceInfo`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `platform` | `weapp \| harmony` | 平台 |
| `osName` | `string` | 系统名称 |
| `osVersion` | `string` | 系统版本 |
| `deviceModel` | `string` | 设备型号 |
| `screenWidth` | `number` | 屏宽 |
| `screenHeight` | `number` | 屏高 |
| `pixelRatio` | `number` | 像素比 |
| `safeArea` | `SafeArea` | 安全区 |
| `networkType` | `wifi \| 4g \| 5g \| unknown` | 网络 |
| `capabilities` | `CapabilitySet` | 能力集 |

### `CapabilitySet`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `supportWechatPay` | `boolean` | 微信支付 |
| `supportHarmonyIAP` | `boolean` | 鸿蒙支付 |
| `supportShareTimeline` | `boolean` | 朋友圈 |
| `supportAtomicService` | `boolean` | 原子服务 |
| `supportDistributed` | `boolean` | 跨设备协同 |
| `supportBiometric` | `boolean` | 生物认证 |

用途：

- 启动时即生成能力画像
- 页面只根据能力开关展示入口
- 不在页面里写平台名判断

---

## 4.5 通用列表/详情接口协议

### 列表查询请求 `PageQuery`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `pageNo` | `number` | 页码 |
| `pageSize` | `number` | 页大小 |
| `sortBy` | `string` | 排序字段 |
| `sortOrder` | `asc \| desc` | 排序方向 |
| `filters` | `Record<string,string>` | 筛选 |

### 分页响应 `PageResult<T>`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `list` | `T[]` | 数据列表 |
| `pageNo` | `number` | 当前页 |
| `pageSize` | `number` | 页大小 |
| `total` | `number` | 总数 |
| `hasMore` | `boolean` | 是否还有更多 |

说明：

- 微信小程序和鸿蒙页层统一使用分页协议
- 列表页避免一次性全量返回
- 长列表统一要求支持：
  - 首屏骨架
  - 增量分页
  - 错误重试
  - 空态页

---

## 5. 适配层接口定义建议

## 5.1 统一 Bridge Contract

```ts
export interface AuthAdapter {
  login(request: AuthLoginRequest): Promise<AuthLoginResponse>
  logout(): Promise<void>
  getCurrentToken(): Promise<string | null>
}

export interface PaymentAdapter {
  createPayOrder(request: CreatePayOrderRequest): Promise<CreatePayOrderResponse>
  requestPay(params: PayParams): Promise<PayResult>
}

export interface ShareAdapter {
  share(content: ShareContent): Promise<ShareResult>
}

export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
}

export interface DeviceAdapter {
  getDeviceInfo(): Promise<DeviceInfo>
}
```

## 5.2 能力发现接口

```ts
export interface CapabilityPolicy {
  has(name: string): boolean
  require(name: string): void
  fallback(name: string): string | null
}
```

示例：

- `has("atomic_service") === false`
- 自动回退到 `share_link` 或 `open_h5_landing`

---

## 6. 页面原型结构图

以下原型图使用低保真结构表达，用于定义页面区块和交互关系，不代表最终视觉稿。

---

## 6.1 全局信息架构

```text
启动页
  -> 登录/免登录引导
    -> 首页
      -> 搜索
      -> 分类/频道
      -> 商品/服务详情
        -> 下单页
          -> 支付页
            -> 支付结果页
      -> 订单列表
        -> 订单详情
      -> 消息中心
      -> 我的
        -> 会员
        -> 设置
```

---

## 6.2 首页原型

```text
+--------------------------------------------------+
| 顶部状态区 / 导航栏                              |
| [Logo] [搜索框____________] [消息]               |
+--------------------------------------------------+
| 轮播 Banner                                      |
+--------------------------------------------------+
| 快捷入口宫格                                     |
| [分类] [活动] [会员] [订单] [分享] [更多]        |
+--------------------------------------------------+
| 推荐频道 Tab                                     |
| [推荐] [热门] [附近] [新品]                      |
+--------------------------------------------------+
| 内容流 / 商品卡片列表                            |
| +----------------------------------------------+ |
| | 图片 | 标题 | 标签 | 价格 | 操作按钮         | |
| +----------------------------------------------+ |
| +----------------------------------------------+ |
+--------------------------------------------------+
| 底部导航栏                                       |
| [首页] [分类] [订单] [我的]                      |
+--------------------------------------------------+
```

交互说明：

- 微信：首页支持下拉刷新、胶囊区适配
- 鸿蒙：首页支持大屏双列 / 折叠态重排
- 卡片点击进入详情，按钮支持快捷下单/收藏

---

## 6.3 登录页原型

```text
+----------------------------------+
| 品牌插画 / Logo                  |
| 标题：欢迎使用                   |
| 副标题：登录后体验完整服务       |
+----------------------------------+
| [微信授权登录]                   |
| [华为账号登录]                   |
| [手机号登录]                     |
| [游客模式]                       |
+----------------------------------+
| 协议勾选：用户协议 / 隐私政策    |
+----------------------------------+
```

适配说明：

- 微信默认主按钮是 `微信授权登录`
- 鸿蒙默认主按钮是 `华为账号登录` 或 `手机号登录`
- 页面布局一致，主按钮按平台能力切换

---

## 6.4 详情页原型

```text
+--------------------------------------------------+
| 顶部返回 / 标题 / 分享                            |
+--------------------------------------------------+
| 主图 / 视频区                                     |
+--------------------------------------------------+
| 标题                                              |
| 价格 / 会员价 / 标签                              |
| 核心卖点                                          |
+--------------------------------------------------+
| 服务说明 / 规格选择 / 评价入口                    |
+--------------------------------------------------+
| 图文详情 / 推荐内容 / 关联活动                    |
+--------------------------------------------------+
| 底部操作栏                                        |
| [客服] [收藏] [加入购物车] [立即购买]             |
+--------------------------------------------------+
```

跨端差异：

- 微信：分享按钮优先走小程序分享
- 鸿蒙：分享按钮优先走系统分享 / 卡片服务

---

## 6.5 下单页原型

```text
+--------------------------------------------------+
| 收货/服务信息卡                                   |
+--------------------------------------------------+
| 商品清单                                           |
| - 商品 A                                           |
| - 商品 B                                           |
+--------------------------------------------------+
| 优惠券 / 会员权益 / 积分抵扣                       |
+--------------------------------------------------+
| 支付方式选择                                       |
| ( ) 微信支付                                       |
| ( ) 华为支付 / 钱包                                |
| ( ) 其他渠道                                       |
+--------------------------------------------------+
| 价格汇总                                           |
| 原价 / 优惠 / 实付                                 |
+--------------------------------------------------+
| [提交订单并支付]                                   |
+--------------------------------------------------+
```

规则：

- 页面只展示当前能力集中支持的支付方式
- 支付方式列表由 `CapabilityPolicy + 服务端配置` 共同决定

---

## 6.6 支付结果页原型

```text
+----------------------------------+
| 成功 / 失败 图标                 |
| 标题：支付成功 / 支付失败        |
| 订单号：xxxxxxxx                 |
| 金额：￥xx.xx                    |
+----------------------------------+
| [查看订单] [返回首页]            |
| [再次支付]（失败态可见）         |
+----------------------------------+
| 推荐内容 / 继续浏览              |
+----------------------------------+
```

说明：

- 结果页统一读取服务端支付状态
- 不直接以客户端同步回调作为最终状态

---

## 6.7 订单列表页原型

```text
+--------------------------------------------------+
| 顶部 Tab                                          |
| [全部] [待支付] [待使用] [已完成] [退款]          |
+--------------------------------------------------+
| 订单卡片列表                                      |
| +----------------------------------------------+ |
| | 订单号 | 状态                                | |
| | 商品信息 / 金额 / 时间                       | |
| | [去支付] [取消] [查看详情]                   | |
| +----------------------------------------------+ |
+--------------------------------------------------+
```

性能要求：

- 微信：分页 + 触底加载
- 鸿蒙：分页 + LazyForEach

---

## 6.8 我的页原型

```text
+--------------------------------------------------+
| 用户卡片                                          |
| 头像 / 昵称 / 会员等级 / 绑定状态                 |
+--------------------------------------------------+
| 数据面板                                          |
| [优惠券] [积分] [收藏] [历史]                     |
+--------------------------------------------------+
| 功能列表                                          |
| - 订单中心                                        |
| - 消息中心                                        |
| - 会员权益                                        |
| - 地址管理                                        |
| - 设置                                            |
+--------------------------------------------------+
```

鸿蒙增强入口可增加：

- 我的设备
- 跨设备协同
- 原子服务管理

---

## 6.9 设置页原型

```text
+----------------------------------+
| 通知设置                         |
| 隐私设置                         |
| 账号与安全                       |
| 清理缓存                         |
| 关于我们                         |
| 版本信息                         |
+----------------------------------+
```

平台差异：

- 微信：引导用户前往授权设置
- 鸿蒙：可直接调系统通知 / 权限页

---

## 7. 页面与模块映射关系

| 页面 | 业务模块 | 共享层 | 微信适配 | 鸿蒙适配 |
| --- | --- | --- | --- | --- |
| 首页 | `feature-home` | 是 | 是 | 是 |
| 登录页 | `core-auth` | 是 | `wx.login` | `Account Kit` |
| 详情页 | `feature-home` | 是 | 分享能力 | 系统分享 |
| 下单页 | `feature-order` | 是 | 微信支付入口 | IAP/钱包入口 |
| 订单页 | `feature-order` | 是 | 是 | 是 |
| 我的页 | `feature-account` | 是 | 微信账号视图 | 华为账号视图 |
| 设置页 | `feature-account` | 是 | 权限跳转 | 权限跳转 |

---

## 8. 状态管理建议

统一状态分三层：

1. `Session State`
   - Token
   - 用户信息
   - 平台能力集

2. `Page State`
   - 当前 Tab
   - 列表筛选
   - 页面 loading/error/empty

3. `Domain State`
   - 订单列表
   - 商品详情
   - 会员权益
   - 消息状态

建议：

- 微信端：`Zustand` 或 `Redux Toolkit`
- 鸿蒙端：`@State/@Observed/ViewModel`
- 共享层只保留状态模型和事件定义，不强绑 UI 框架

---

## 9. 版本与协议管理建议

建议维护以下文档与规则：

- `api-version`: 接口版本
- `schema-version`: DTO 结构版本
- `feature-version`: 功能版本

版本同步策略：

```text
Core Feature v1.4.0
  -> weapp build 1.4.0+120
  -> harmony build 1.4.0+58
```

要求：

- 同一核心功能必须共享同一个 `feature-version`
- 平台增强项允许 build 不同，但协议版本必须兼容

---

## 10. 直接可拆的研发任务建议

### 第一批基础设施任务

1. 初始化 Monorepo
2. 建立 `packages/core-types`
3. 建立 `packages/bridge/contracts`
4. 完成微信端 Adapter 骨架
5. 完成鸿蒙端 Adapter 骨架
6. 建立统一错误码与分页协议

### 第二批业务落地任务

1. 登录模块双端打通
2. 首页与详情页双端落地
3. 订单创建与支付流程打通
4. 订单列表与结果页落地
5. 我的页与设置页落地

### 第三批平台增强任务

1. 微信分享 / 微信支付增强
2. 鸿蒙原子服务入口
3. 鸿蒙跨设备协同
4. 双端埋点与性能采样

---

## 11. 结论

如果后续按这个蓝图推进，最关键的实施原则只有三条：

1. **共享的是业务内核和协议，不是页面源码本身**
2. **平台差异全部收口到 Bridge Adapter，不进入页面层**
3. **页面结构先统一，平台体验再做增强，不反过来设计**

这样能同时保证：

- 微信小程序快速上线
- 鸿蒙端保留原生能力与体验优势
- 后续新功能不会在双端各写一套

