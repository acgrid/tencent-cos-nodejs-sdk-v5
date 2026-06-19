# cos-nodejs-sdk-v5

腾讯云 COS Nodejs SDK（[XML API](https://cloud.tencent.com/document/product/436/7751)）

[releases and changelog](https://github.com/tencentyun/cos-nodejs-sdk-v5/releases)

## install

[npm 地址](https://www.npmjs.com/package/cos-nodejs-sdk-v5)

```
npm i cos-nodejs-sdk-v5 --save
```

## demo

```javascript
// 引入模块
var COS = require('cos-nodejs-sdk-v5');
// 创建实例
var cos = new COS({
  SecretId: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  SecretKey: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
});

// 存储桶名称，由bucketname-appid 组成，appid必须填入，可以在COS控制台查看存储桶名称。 https://console.cloud.tencent.com/cos5/bucket
var Bucket = 'test-1250000000';
// 存储桶Region可以在COS控制台指定存储桶的概览页查看 https://console.cloud.tencent.com/cos5/bucket/
// 关于地域的详情见 https://cloud.tencent.com/document/product/436/6224
var Region = 'ap-guangzhou';

// 高级上传
cos.uploadFile(
  {
    Bucket: Bucket,
    Region: Region,
    Key: '1.zip',
    FilePath: './1.zip', // 本地文件地址，需自行替换
    SliceSize: 1024 * 1024 * 5, // 触发分块上传的阈值，超过5MB使用分块上传，非必须
  },
  function (err, data) {
    console.log(err, data);
  }
);
```

## 说明文档

[使用例子](demo/demo.js)

[快速入门](https://cloud.tencent.com/document/product/436/8629)

[接口文档](https://cloud.tencent.com/document/product/436/12264)

## 本分支依赖迁移说明

### 迁移动机

本分支用于维护一个长期未同步上游的 fork。原 SDK 仍依赖已经停止维护的 `request` 包，同时部分依赖版本较旧，安全扫描和现代 Node.js 环境下都会带来维护压力。本次迁移的主要目标是保留原有 COS SDK 行为，尽量降低业务侧改动成本，同时移除废弃依赖并补齐可重复运行的测试环境。

### 主要改动

- 将运行时 HTTP 请求依赖从 `request` 迁移到 `@cypress/request`。
- 更新 `conf`、`fast-xml-parser`、`mime-types`、`mocha`、`qcloud-cos-sts` 等依赖版本，并将 Node.js 运行要求提升到 `>= 16`。
- 新增 `test-sts` 脚本和 `test/sts-server.js`，用于本地启动测试用 STS 服务，复用 `SecretId`、`SecretKey`、`Bucket`、`Region` 等环境变量。
- 将依赖外部特殊环境的测试改为显式 opt-in，例如自定义域名、日志、跨地域复制、外部 retry fixture；默认测试仍覆盖公开 COS 常规路径。
- 增加本地 retry fault-injection 测试，覆盖临时 `500` 和 `ECONNRESET` 后重试成功的行为。
- 修复旧式 `AppId` 参数兼容问题：当短 bucket 名本身以数字结尾时，仍会正确拼接显式传入的 `AppId`。

### 测试手册

以下测试说明面向源码仓库 checkout，不属于安装后的 npm 包运行时功能。

运行主测试前需要准备一组真实 COS 测试环境变量。请使用专门的测试桶，不要使用生产桶。

```bash
export SecretId='AKID...'
export SecretKey='...'
export Bucket='your-test-bucket-1250000000'
export Region='ap-guangzhou'
export Uin='1000xxxxxxxx'
export nodejssdkStsUrl='http://127.0.0.1:3000'
```

如果没有现成的 STS 测试服务，可以先在另一个终端启动本地 STS server：

```bash
export SecretId='AKID...'
export SecretKey='...'
export Bucket='your-test-bucket-1250000000'
export Region='ap-guangzhou'
export STS_PORT=3000

npm run test-sts
```

然后在测试终端运行：

```bash
export nodejssdkStsUrl='http://127.0.0.1:3000'
npm test
```

可选的环境变量如下：

- `NO_PROXY` / `no_proxy`：用于绕过代理访问 COS、CI、STS 和 localhost。
- `COS_RUN_BUCKET_DOMAIN_TESTS=1`：运行自定义域名测试，需要配置可用且已备案/审核通过的域名。
- `COS_BUCKET_DOMAIN_REST` / `COS_BUCKET_DOMAIN_WEBSITE`：自定义域名测试使用的域名。
- `COS_RUN_BUCKET_LOGGING_TESTS=1`：运行日志测试，需要目标桶和日志写入权限配置。
- `COS_LOGGING_TARGET_BUCKET`：日志测试的目标桶，未设置时使用当前测试桶。
- `COS_RUN_BUCKET_REPLICATION_TESTS=1`：运行跨地域复制测试，需要源桶和目标桶版本控制、角色和权限配置。
- `COS_REPLICATION_BUCKET` / `COS_REPLICATION_REGION`：跨地域复制测试的目标桶和目标地域。
- `COS_RUN_RETRY_TESTS=1`：运行历史外部 retry fixture 测试。
- `COS_RETRY_BUCKET` / `COS_RETRY_REGION`：历史 retry fixture 的桶和地域；默认值仍是上游旧测试桶。

### 测试结果与注意事项

本次迁移使用真实 COS 测试桶和本地 STS 服务做过完整验证，主测试套件最终结果为：

```text
259 passing
48 pending
```

测试过程中遇到并处理了以下边界情况：旧的公开 retry fixture bucket 无访问权限，改为默认跳过并补充本地故障注入测试；自定义域名、日志、跨地域复制、回源等 bucket 级功能需要额外云上配置，因此提供环境变量开关；不同网络和代理绕过环境下，连接失败可能表现为 `ECONNREFUSED`、`ECONNRESET`、`ESOCKETTIMEDOUT` 或 `ETIMEDOUT`，测试已按等价失败场景处理。

基于以上验证，本分支对 `request` 到 `@cypress/request` 的迁移有较高信心，适合公开发布这个兼容性修复版本。但这不是腾讯云官方发布版本，且测试环境无法覆盖所有私有 COS/CSP、自建代理、特殊网络和历史 retry fixture 场景。请在自己的业务环境中回归验证后使用，风险自负。
