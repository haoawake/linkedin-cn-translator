# LinkLingo — 领英翻译

一个面向 LinkedIn 网页版个人档案的 Chrome 扩展。打开 `linkedin.com/in/...` 后，会自动把英文档案正文翻译成简体中文，并支持一键还原原文。

## 功能

- 自动识别 LinkedIn 个人档案页正文
- 英文自动翻译为简体中文
- 支持 LinkedIn SPA 页面切换和动态加载内容
- 跳过导航、按钮、URL、邮箱以及大部分姓名/短专有名词
- 翻译请求缓存、并发限制与失败重试
- 一键还原英文
- 可关闭自动翻译
- 可选：悬停中文时显示英文原文
- Windows / macOS 上的 Chrome 均可使用

## 安装

### Windows

1. 下载 Release 里的 `LinkLingo.zip` 并解压。
2. Chrome 打开 `chrome://extensions/`。
3. 开启右上角「开发者模式」。
4. 点击「加载已解压的扩展程序」。
5. 选择刚才解压出来的文件夹。
6. 打开或刷新任意 LinkedIn 档案页。

### macOS

1. 下载 Release 里的 `LinkLingo.zip`，双击解压。
2. Chrome 打开 `chrome://extensions/`。
3. 开启右上角「开发者模式」。
4. 点击「加载已解压的扩展程序」。
5. 选择解压后的 `LinkLingo` 文件夹。
6. 打开或刷新任意 LinkedIn 档案页。

> Chrome 的扩展目录不能随意删除或移动；移动后需要重新「加载已解压的扩展程序」。

## 翻译服务

默认使用 Google Translate 的无需 API Key 网页端点：

`https://translate.googleapis.com/translate_a/single`

这是非正式接口，适合个人使用和原型场景，但可能受到频率限制，也不保证长期稳定。如果要发布到 Chrome Web Store 或长期大规模使用，建议替换为正式翻译 API 或自建后端。

## 隐私

扩展仅在 LinkedIn 页面运行。需要翻译的英文文本会发送到翻译服务；扩展不会主动读取 LinkedIn 密码、Cookie、私信或表单输入。

## 从源码打包

Windows PowerShell：

```powershell
./tools/package.ps1
```

macOS / Linux：

```bash
./tools/package.sh
```

生成的 ZIP 位于 `dist/`。

## 项目结构

```text
LinkLingo/
├─ manifest.json
├─ background.js
├─ content.js
├─ content.css
├─ popup.html
├─ popup.css
├─ popup.js
├─ assets/
├─ tools/
└─ .github/workflows/
```

## License

MIT
